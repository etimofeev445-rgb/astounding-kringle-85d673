import { and, count, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { automationEvents, automationJobs, reports, supportMessages, supportTickets } from '../../../db/schema.js'
import {
  AUTO_REPORTER,
  MODULES,
  isModuleId,
  moduleDef,
  nextSlot,
  sanitizeAutomation,
  scheduleProblem,
  type AutomationConfig,
} from '../../lib/automation'
import { adminChatId, botToken } from '../telegramBot'
import { controlJob, enqueue, lastDoneResult, lastJobs, runPending } from '../automation/engine'
import { dailyStats } from '../automation/modules/reporting'
import { loadAutomation, notifyAdmin, storeAutomation } from '../automation/store'
import { adminReply, closeTicket, ticketMessages, userNames } from '../automation/support'
import { InputError, int, isUuid, iso, log, obj, str, type Admin } from './util'

// Admin actions of the "Автоматизація" and "Підтримка" sections.

const jobView = (j: typeof automationJobs.$inferSelect) => ({
  id: j.id,
  module: j.module,
  trigger: j.trigger,
  status: j.status,
  progress: j.progress,
  progressText: j.progressText,
  summary: j.summary,
  error: j.error,
  attempts: j.attempts,
  scheduledFor: iso(j.scheduledFor),
  startedAt: iso(j.startedAt),
  finishedAt: iso(j.finishedAt),
  createdAt: j.createdAt.toISOString(),
})

export async function overview() {
  const [config, last, open, errors24, queueFlagged, supportWaiting] = await Promise.all([
    loadAutomation(),
    lastJobs(),
    db.select().from(automationJobs).where(inArray(automationJobs.status, ['queued', 'running', 'paused'])),
    db
      .select({ n: count() })
      .from(automationEvents)
      .where(and(eq(automationEvents.level, 'error'), gte(automationEvents.createdAt, new Date(Date.now() - 86400_000))))
      .then((r) => r[0].n),
    db
      .select({ n: count() })
      .from(reports)
      .where(and(eq(reports.telegramUserId, AUTO_REPORTER), eq(reports.status, 'open')))
      .then((r) => r[0].n),
    db.select({ n: count() }).from(supportTickets).where(and(eq(supportTickets.status, 'escalated'), eq(supportTickets.unread, true))).then((r) => r[0].n),
  ])
  const now = Date.now()
  const modules = MODULES.map((m) => {
    const mc = config.modules[m.id]
    const lj = last.get(m.id)
    const oj = open.find((j) => j.module === m.id)
    const runs = !config.paused && mc.enabled && mc.schedule?.enabled && !scheduleProblem(mc.schedule)
    return {
      id: m.id,
      lastJob: lj ? jobView(lj) : null,
      openJob: oj ? jobView(oj) : null,
      nextRun: runs && mc.schedule ? iso(new Date(nextSlot(mc.schedule, now) ?? 0)) : null,
      problem: mc.schedule ? scheduleProblem(mc.schedule) : null,
    }
  })
  return {
    config,
    modules,
    stats: { errors24, queueFlagged, supportWaiting },
    env: {
      // Netlify runs scheduled functions on the published (production) deploy only.
      production: process.env.CONTEXT === 'production',
      bot: !!botToken(),
      adminChat: !!adminChatId(),
    },
  }
}

// Saves the switches, settings and schedules. Unsupported schedules are refused with the reason.
export async function saveAutomation(admin: Admin, p: unknown) {
  const before = await loadAutomation()
  const next = sanitizeAutomation(obj(p).config)
  for (const m of MODULES) {
    const s = next.modules[m.id].schedule
    if (s && s.enabled) {
      const problem = scheduleProblem(s)
      if (problem) throw new InputError(`${m.title}: ${problem}`)
    }
    // Switching a module on (or changing its schedule) never fires the slots it "missed" meanwhile.
    const was = before.modules[m.id]
    const cur = next.modules[m.id]
    if ((!was.enabled && cur.enabled) || JSON.stringify(was.schedule) !== JSON.stringify(cur.schedule)) cur.since = new Date().toISOString()
    else cur.since = was.since
  }
  await storeAutomation(next)
  const changed = MODULES.filter((m) => JSON.stringify(before.modules[m.id]) !== JSON.stringify(next.modules[m.id])).map((m) => m.id)
  const toggled = MODULES.filter((m) => before.modules[m.id].enabled !== next.modules[m.id].enabled).map((m) => `${m.id}:${next.modules[m.id].enabled ? 'on' : 'off'}`)
  await log(admin, 'automation.update', 'automation', '', { changed, toggled, paused: before.paused !== next.paused ? next.paused : undefined })
  return next satisfies AutomationConfig
}

// "Запустити зараз": queues the module and works on it for up to ~20 s right here; whatever is left
// continues on the next scheduler tick.
export async function runNow(admin: Admin, p: unknown) {
  const id = obj(p).module
  if (!isModuleId(id) || !moduleDef(id).manual) throw new InputError('Невідомий модуль')
  const cfg = await loadAutomation()
  if (cfg.paused) throw new InputError('Автоматизацію призупинено — спершу відновіть її')
  if (!cfg.modules[id].enabled) throw new InputError('Модуль вимкнено — увімкніть його, щоб запустити')
  const { job, duplicate } = await enqueue(id, 'manual', { createdBy: admin.id })
  await log(admin, 'automation.run', 'automation', id, { job: job.id, duplicate })
  if (job.status === 'queued') await runPending(Date.now() + 20_000, job.id)
  const [row] = await db.select().from(automationJobs).where(eq(automationJobs.id, job.id))
  return { job: jobView(row), duplicate }
}

export async function jobControl(admin: Admin, p: unknown) {
  const o = obj(p)
  if (!isUuid(o.id)) throw new InputError('Невірний ID')
  const op = o.op === 'pause' || o.op === 'resume' || o.op === 'cancel' ? o.op : null
  if (!op) throw new InputError('Невідома дія')
  const row = await controlJob(o.id, op)
  if (!row) throw new InputError('Задачу вже завершено або стан змінився')
  await log(admin, `automation.job_${op}`, 'job', o.id, { module: row.module })
  return jobView(row)
}

export async function listJobs(_: Admin, p: unknown) {
  const o = obj(p)
  const module = str(o.module, 30)
  const status = str(o.status, 20)
  const offset = int(o.offset, 0, 100_000, 0)
  const rows = await db
    .select()
    .from(automationJobs)
    .where(and(isModuleId(module) ? eq(automationJobs.module, module) : undefined, status ? eq(automationJobs.status, status) : undefined))
    .orderBy(desc(automationJobs.createdAt))
    .limit(30)
    .offset(offset)
  return { items: rows.map(jobView), pageSize: 30 }
}

export async function jobResult(_: Admin, p: unknown) {
  const o = obj(p)
  if (isUuid(o.id)) {
    const [row] = await db.select().from(automationJobs).where(eq(automationJobs.id, o.id))
    return row ? { job: jobView(row), result: row.result } : null
  }
  if (!isModuleId(o.module)) throw new InputError('Невідомий модуль')
  const row = await lastDoneResult(o.module)
  return row ? { job: jobView(row), result: row.result } : null
}

const EVENT_GROUPS: Record<string, string[]> = {
  security: ['security.%', 'users.%'],
  errors: ['app.%', 'server.%', 'job.%'],
  webhook: ['webhook.%'],
  jobs: ['job.%', 'jobs.%', 'broadcast.%'],
  support: ['support.%'],
}

export async function listEvents(_: Admin, p: unknown) {
  const o = obj(p)
  const group = str(o.group, 20)
  const level = str(o.level, 10)
  const offset = int(o.offset, 0, 100_000, 0)
  const pats = EVENT_GROUPS[group]
  const rows = await db
    .select()
    .from(automationEvents)
    .where(
      and(
        pats ? sql`(${sql.join(pats.map((x) => sql`${automationEvents.kind} like ${x}`), sql` or `)})` : undefined,
        level === 'warn' || level === 'error' || level === 'info' ? eq(automationEvents.level, level) : undefined,
      ),
    )
    .orderBy(desc(automationEvents.createdAt))
    .limit(50)
    .offset(offset)
  return {
    items: rows.map((e) => ({
      id: e.id,
      module: e.module,
      level: e.level,
      kind: e.kind,
      message: e.message,
      details: e.details as Record<string, unknown>,
      createdAt: e.createdAt.toISOString(),
    })),
    pageSize: 50,
  }
}

export async function testNotification(admin: Admin) {
  const ok = await notifyAdmin('✅ Тестове сповіщення UAT Market: автоматизація може писати вам у цей чат.')
  await log(admin, 'automation.test_notify', 'automation', '', { ok })
  if (!ok) throw new InputError('Telegram не прийняв повідомлення: відкрийте чат з ботом і натисніть «Start» або перевірте чат сповіщень')
  return { ok }
}

export const previewDaily = () => dailyStats(true)

// ── Support ──────────────────────────────────────────────────────────────────────────────────

export async function listTickets(_: Admin, p: unknown) {
  const status = str(obj(p).status, 20)
  const where =
    status === 'open' || status === 'escalated' || status === 'closed'
      ? eq(supportTickets.status, status)
      : ne(supportTickets.status, 'closed')
  const rows = await db.select().from(supportTickets).where(where).orderBy(desc(supportTickets.updatedAt)).limit(100)
  const names = await userNames(rows.map((r) => r.telegramUserId))
  const lastMsgs = rows.length
    ? await db
        .selectDistinctOn([supportMessages.ticketId])
        .from(supportMessages)
        .where(inArray(supportMessages.ticketId, rows.map((r) => r.id)))
        .orderBy(supportMessages.ticketId, desc(supportMessages.createdAt))
    : []
  const last = new Map(lastMsgs.map((m) => [m.ticketId, m]))
  return {
    items: rows.map((t) => ({
      id: t.id,
      userId: t.telegramUserId,
      user: names.get(t.telegramUserId) ?? `ID ${t.telegramUserId}`,
      status: t.status,
      reason: t.escalatedReason,
      unread: t.unread,
      aiReplies: t.aiReplies,
      lastText: last.get(t.id)?.text.slice(0, 160) ?? '',
      updatedAt: t.updatedAt.toISOString(),
    })),
  }
}

export async function getTicket(_: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id))
  if (!t) throw new InputError('Звернення не знайдено')
  const [msgs, names] = await Promise.all([ticketMessages(t.id), userNames([t.telegramUserId])])
  return {
    id: t.id,
    userId: t.telegramUserId,
    user: names.get(t.telegramUserId) ?? `ID ${t.telegramUserId}`,
    status: t.status,
    reason: t.escalatedReason,
    messages: msgs.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt.toISOString() })),
  }
}

export async function replyTicket(admin: Admin, p: unknown) {
  const o = obj(p)
  if (!isUuid(o.id)) throw new InputError('Невірний ID')
  const text = str(o.text, 3000)
  if (!text) throw new InputError('Введіть відповідь')
  const r = await adminReply(o.id, text)
  if (!r) throw new InputError('Звернення закрите або не знайдене')
  await log(admin, 'support.reply', 'ticket', o.id, { length: text.length, delivered: r.delivered })
  return r
}

export async function closeTicketAction(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const row = await closeTicket(id)
  if (row) await log(admin, 'support.close', 'ticket', id)
  return { ok: !!row }
}
