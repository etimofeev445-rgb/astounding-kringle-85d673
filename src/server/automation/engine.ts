import { and, asc, desc, eq, inArray, isNull, lt, lte, max, or } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { automationJobs } from '../../../db/schema.js'
import { MODULES, moduleDef, prevSlot, scheduleProblem, type AutomationConfig, type ModuleId } from '../../lib/automation'
import { RUNNERS } from './modules'
import { loadAutomation, recordEvent } from './store'

// Server-only job engine. A job runs in short steps; between steps its checkpoint lives in `state`,
// so long work survives the function time limit and a retried job continues where it stopped.
// Duplicates are prevented by the database: one unfinished job per module, one running job per
// lock group (partial unique indexes on automation_jobs).

export type Job = typeof automationJobs.$inferSelect
export type Trigger = 'schedule' | 'manual' | 'event'

const MIN = 60_000

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === '23505' || err?.cause?.code === '23505'
}

// Queues a job, or returns the module's job that is already waiting/running.
export async function enqueue(module: ModuleId, trigger: Trigger, opts: { createdBy?: string; scheduledFor?: Date } = {}) {
  const [job] = await db
    .insert(automationJobs)
    .values({
      module,
      lockGroup: moduleDef(module).lockGroup,
      trigger,
      createdBy: opts.createdBy ?? '',
      scheduledFor: opts.scheduledFor ?? null,
    })
    .onConflictDoNothing()
    .returning()
  if (job) return { job, duplicate: false }
  const [open] = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.module, module), inArray(automationJobs.status, ['queued', 'running', 'paused'])))
  return { job: open, duplicate: true }
}

// queued → running. Fails (null) if another job of the same lock group is running right now.
async function claim(job: Job) {
  try {
    const [row] = await db
      .update(automationJobs)
      .set({ status: 'running', startedAt: job.startedAt ?? new Date(), heartbeatAt: new Date() })
      .where(and(eq(automationJobs.id, job.id), eq(automationJobs.status, 'queued')))
      .returning()
    return row ?? null
  } catch (e) {
    if (isUniqueViolation(e)) return null
    throw e
  }
}

const jobLimits = (cfg: AutomationConfig) => ({
  stuckMinutes: Number(cfg.modules.jobs.settings.stuckMinutes) || 10,
  maxAttempts: Number(cfg.modules.jobs.settings.maxAttempts) || 3,
})

// Runs one step of a claimed job and stores the outcome. Returns whether the job is still queued.
async function step(job: Job, cfg: AutomationConfig, deadline: number): Promise<'done' | 'more' | 'retry' | 'failed'> {
  const id = job.id
  const module = job.module as ModuleId
  const runner = RUNNERS[module]
  const settings = cfg.modules[module]?.settings ?? {}
  try {
    if (!runner) throw new Error('Невідомий модуль')
    const r = await runner({
      job,
      config: cfg,
      settings,
      state: (job.state as Record<string, unknown>) ?? {},
      deadline,
      event: (level, kind, message, details = {}) => recordEvent(module, level, kind, message, details, id),
      heartbeat: async (progress, progressText) => {
        await db
          .update(automationJobs)
          .set({ heartbeatAt: new Date(), ...(progress != null ? { progress } : {}), ...(progressText != null ? { progressText } : {}) })
          .where(eq(automationJobs.id, id))
      },
    })
    if (r.done) {
      await db
        .update(automationJobs)
        .set({ status: 'done', progress: 100, progressText: '', summary: r.summary.slice(0, 1000), result: r.result ?? null, error: '', finishedAt: new Date() })
        .where(and(eq(automationJobs.id, id), eq(automationJobs.status, 'running')))
      return 'done'
    }
    // Not finished within the budget: back to the queue with its checkpoint (unless paused meanwhile).
    await db
      .update(automationJobs)
      .set({ status: 'queued', state: r.state, progress: r.progress ?? job.progress, progressText: r.progressText ?? '' })
      .where(and(eq(automationJobs.id, id), eq(automationJobs.status, 'running')))
    return 'more'
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500)
    const attempts = job.attempts + 1
    const failed = attempts >= jobLimits(cfg).maxAttempts
    await db
      .update(automationJobs)
      .set({ status: failed ? 'failed' : 'queued', attempts, error: message, ...(failed ? { finishedAt: new Date() } : {}) })
      .where(eq(automationJobs.id, id))
    if (failed) {
      await recordEvent(module, 'error', 'job.failed', `${moduleDef(module).title}: ${message}`, { subject: id, attempts }, id)
    }
    return failed ? 'failed' : 'retry'
  }
}

// Works through queued jobs until the deadline. `only` limits it to one job (manual "run now").
export async function runPending(deadline: number, only?: string) {
  const cfg = await loadAutomation()
  const ran: { id: string; module: string; outcome: string }[] = []
  const skip = new Set<string>()
  while (Date.now() < deadline - 2000) {
    const queued = await db
      .select()
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.status, 'queued'),
          only ? eq(automationJobs.id, only) : undefined,
          or(isNull(automationJobs.scheduledFor), lte(automationJobs.scheduledFor, new Date())),
        ),
      )
      .orderBy(asc(automationJobs.createdAt))
      .limit(20)
    const next = queued.find((j) => !skip.has(j.id))
    if (!next) break
    const module = next.module as ModuleId
    // A switched-off module (or global pause) doesn't run; its waiting jobs are cancelled.
    if (cfg.paused || !cfg.modules[module]?.enabled) {
      await db
        .update(automationJobs)
        .set({ status: 'cancelled', finishedAt: new Date(), summary: cfg.paused ? 'Автоматизацію призупинено' : 'Модуль вимкнено' })
        .where(and(eq(automationJobs.id, next.id), eq(automationJobs.status, 'queued')))
      skip.add(next.id)
      continue
    }
    const job = await claim(next)
    if (!job) {
      skip.add(next.id) // its lock group is busy; try again next tick
      continue
    }
    const outcome = await step(job, cfg, deadline)
    ran.push({ id: job.id, module, outcome })
    // A failed step waits for the next tick (natural back-off) instead of retrying immediately.
    if (outcome !== 'more') skip.add(job.id)
  }
  return ran
}

// Running jobs that stopped sending heartbeats (function killed mid-step) go back to the queue,
// or fail after the attempt limit. Always on, so a crash can never block a module forever.
export async function recoverStuck(cfg: AutomationConfig) {
  const { stuckMinutes, maxAttempts } = jobLimits(cfg)
  const stuck = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.status, 'running'), lt(automationJobs.heartbeatAt, new Date(Date.now() - stuckMinutes * MIN))))
  for (const j of stuck) {
    const attempts = j.attempts + 1
    const failed = attempts >= maxAttempts
    const [row] = await db
      .update(automationJobs)
      .set({
        status: failed ? 'failed' : 'queued',
        attempts,
        error: `Задача зависла (немає відповіді понад ${stuckMinutes} хв)`,
        ...(failed ? { finishedAt: new Date() } : {}),
      })
      .where(and(eq(automationJobs.id, j.id), eq(automationJobs.status, 'running')))
      .returning()
    if (row) {
      await recordEvent(
        j.module,
        failed ? 'error' : 'warn',
        failed ? 'job.failed' : 'job.stuck',
        `${moduleDef(j.module as ModuleId)?.title ?? j.module}: задача зависла${failed ? ' і зупинена після ліміту спроб' : ', повернута в чергу'}`,
        { subject: j.id, attempts },
        j.id,
      )
    }
  }
  return stuck.length
}

// Queues every enabled module whose latest schedule slot hasn't been queued yet. The slot time is
// stored as scheduled_for, so each slot runs at most once even if ticks overlap.
export async function scheduleDue(cfg: AutomationConfig, now = Date.now()) {
  const queued: string[] = []
  if (cfg.paused) return queued
  const last = await db
    .select({ module: automationJobs.module, at: max(automationJobs.scheduledFor) })
    .from(automationJobs)
    .where(eq(automationJobs.trigger, 'schedule'))
    .groupBy(automationJobs.module)
  const lastBy = new Map(last.map((r) => [r.module, r.at?.getTime() ?? 0]))
  for (const m of MODULES) {
    const mc = cfg.modules[m.id]
    if (!mc.enabled || !mc.schedule?.enabled || scheduleProblem(mc.schedule)) continue
    const slot = prevSlot(mc.schedule, now)
    if (slot == null || slot < Date.parse(mc.since) || slot <= (lastBy.get(m.id) ?? 0)) continue
    const r = await enqueue(m.id, 'schedule', { scheduledFor: new Date(slot) })
    if (!r.duplicate) queued.push(m.id)
  }
  return queued
}

// One scheduler wake-up (Netlify scheduled function, every 5 minutes).
export async function tick(budgetMs = 22_000) {
  const deadline = Date.now() + budgetMs
  const cfg = await loadAutomation()
  const recovered = await recoverStuck(cfg)
  const queued = await scheduleDue(cfg)
  const ran = cfg.paused ? [] : await runPending(deadline)
  return { recovered, queued, ran }
}

// Admin controls for one job.
export async function controlJob(id: string, op: 'pause' | 'resume' | 'cancel') {
  const from = op === 'pause' ? ['queued'] : op === 'resume' ? ['paused'] : ['queued', 'paused']
  const set =
    op === 'pause'
      ? { status: 'paused' }
      : op === 'resume'
        ? { status: 'queued' }
        : { status: 'cancelled', finishedAt: new Date(), summary: 'Скасовано адміністратором' }
  const [row] = await db
    .update(automationJobs)
    .set(set)
    .where(and(eq(automationJobs.id, id), inArray(automationJobs.status, from)))
    .returning()
  return row ?? null
}

export async function lastJobs() {
  // Latest job per module.
  const rows = await db
    .selectDistinctOn([automationJobs.module])
    .from(automationJobs)
    .orderBy(automationJobs.module, desc(automationJobs.createdAt))
  return new Map(rows.map((r) => [r.module, r]))
}

export async function lastDoneResult(module: ModuleId) {
  const [row] = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.module, module), eq(automationJobs.status, 'done')))
    .orderBy(desc(automationJobs.finishedAt))
    .limit(1)
  return row ?? null
}
