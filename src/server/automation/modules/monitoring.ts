import { getStore } from '@netlify/blobs'
import { and, count, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { ads, automationEvents, broadcasts, places, reports, topupOrders, users } from '../../../../db/schema.js'
import { OPERATORS } from '../../../data/operators'
import { AUTO_REPORTER } from '../../../lib/automation'
import { botApi, botToken, webhookSecret } from '../../telegramBot'
import { setupWebhook, webhookInfo } from '../../webhookSetup'
import { getMemo, seenRecently, setMemo } from '../store'
import { DAY, HOUR, num, type RunCtx, type Runner } from './types'

// Monitoring modules. They only record events (picked up by "Telegram-сповіщення") and never
// change users, listings or orders. Repeated findings are de-duplicated.

async function once(ctx: RunCtx, kind: string, subject: string, windowMs: number, message: string, level: 'warn' | 'error' = 'warn', details = {}) {
  if (await seenRecently(kind, subject, windowMs)) return false
  await ctx.event(level, kind, message, { subject, ...details })
  return true
}

// ── Users ────────────────────────────────────────────────────────────────────────────────────

export const usersMonitor: Runner = async (ctx) => {
  const s = ctx.settings
  const now = Date.now()
  const found: string[] = []

  const maxPosts = num(s.maxPostsPerDay, 5)
  const since24 = new Date(now - DAY)
  const [adPosts, placePosts] = await Promise.all([
    db.select({ user: ads.telegramUserId, n: count() }).from(ads).where(gte(ads.createdAt, since24)).groupBy(ads.telegramUserId),
    db.select({ user: places.telegramUserId, n: count() }).from(places).where(gte(places.createdAt, since24)).groupBy(places.telegramUserId),
  ])
  const posts = new Map<string, number>()
  for (const r of [...adPosts, ...placePosts]) posts.set(r.user, (posts.get(r.user) ?? 0) + r.n)
  for (const [user, n] of posts) {
    if (n > maxPosts && (await once(ctx, 'users.suspicious', `posts:${user}`, DAY, `Користувач ID ${user}: ${n} публікацій за 24 год (поріг ${maxPosts})`, 'warn', { userId: user })))
      found.push(`posts:${user}`)
  }

  const maxAgainst = num(s.maxReportsAgainst, 3)
  const since7 = new Date(now - 7 * DAY)
  const against = await db.execute<{ user: string; n: number }>(sql`
    select t.user, count(*)::int as n from (
      select a.telegram_user_id as user from ${reports} r join ${ads} a on r.target_kind = 'ad' and a.id = r.target_id
        where r.created_at >= ${since7} and r.telegram_user_id <> ${AUTO_REPORTER}
      union all
      select p.telegram_user_id as user from ${reports} r join ${places} p on r.target_kind = 'place' and p.id = r.target_id
        where r.created_at >= ${since7} and r.telegram_user_id <> ${AUTO_REPORTER}
    ) t group by t.user having count(*) > ${maxAgainst}`)
  for (const r of rowsOf<{ user: string; n: number }>(against)) {
    if (await once(ctx, 'users.suspicious', `reported:${r.user}`, 7 * DAY, `На публікації користувача ID ${r.user} — ${r.n} скарг за 7 днів (поріг ${maxAgainst})`, 'warn', { userId: r.user }))
      found.push(`reported:${r.user}`)
  }

  const perHour = num(s.signupsPerHour, 50)
  const [{ n: signups }] = await db.select({ n: count() }).from(users).where(gte(users.firstSeenAt, new Date(now - HOUR)))
  const bucket = Math.floor(now / HOUR)
  if (signups > perHour && (await once(ctx, 'users.suspicious', `signups:${bucket}`, 2 * HOUR, `Сплеск реєстрацій: ${signups} нових користувачів за годину (поріг ${perHour})`)))
    found.push('signups')

  return { done: true, summary: found.length ? `Нових сигналів: ${found.length}` : 'Незвичної активності не знайдено', result: { found, signupsLastHour: signups } }
}

// drizzle's execute() returns rows directly or as { rows } depending on the driver.
function rowsOf<T>(r: unknown): T[] {
  return Array.isArray(r) ? (r as T[]) : (((r as { rows?: T[] })?.rows ?? []) as T[])
}

// ── Security ─────────────────────────────────────────────────────────────────────────────────

const SIGNALS = [
  { kind: 'security.admin_denied', key: 'adminDenied', label: 'Відмов у доступі до адмін-панелі' },
  { kind: 'security.webhook_secret', key: 'webhookSecret', label: 'Запитів до webhook з невірним секретом' },
  { kind: 'security.blocked_action', key: 'blockedActions', label: 'Спроб дій від заблокованих користувачів' },
] as const

export const securityMonitor: Runner = async (ctx) => {
  const s = ctx.settings
  const windowMs = num(s.windowMinutes, 60) * 60_000
  const since = new Date(Date.now() - windowMs)
  const counts = await db
    .select({ kind: automationEvents.kind, n: count() })
    .from(automationEvents)
    .where(and(inArray(automationEvents.kind, SIGNALS.map((x) => x.kind)), gte(automationEvents.createdAt, since)))
    .groupBy(automationEvents.kind)
  const result: Record<string, number> = {}
  const alerts: string[] = []
  for (const sig of SIGNALS) {
    const n = counts.find((c) => c.kind === sig.kind)?.n ?? 0
    result[sig.key] = n
    const limit = num(s[sig.key], 3)
    if (n >= limit && (await once(ctx, 'security.alert', sig.kind, windowMs, `${sig.label}: ${n} за ${num(s.windowMinutes, 60)} хв (поріг ${limit})`)))
      alerts.push(sig.key)
  }

  const perUser = num(s.reportsPerUser, 10)
  const heavy = await db
    .select({ user: reports.telegramUserId, n: count() })
    .from(reports)
    .where(and(gte(reports.createdAt, new Date(Date.now() - DAY)), ne(reports.telegramUserId, AUTO_REPORTER)))
    .groupBy(reports.telegramUserId)
    .having(sql`count(*) >= ${perUser}`)
  for (const h of heavy) {
    if (await once(ctx, 'security.alert', `reports:${h.user}`, DAY, `Масові скарги: користувач ID ${h.user} подав ${h.n} скарг за 24 год`, 'warn', { userId: h.user }))
      alerts.push(`reports:${h.user}`)
  }
  return { done: true, summary: alerts.length ? `Тривог: ${alerts.length}` : 'Загроз не виявлено', result: { ...result, massReporters: heavy.length } }
}

// ── Server ───────────────────────────────────────────────────────────────────────────────────

interface Check {
  name: string
  ok: boolean
  ms: number
  error: string
}

async function timed(name: string, fn: () => Promise<unknown>): Promise<Check> {
  const t = Date.now()
  try {
    await fn()
    return { name, ok: true, ms: Date.now() - t, error: '' }
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) }
  }
}

export const serverMonitor: Runner = async (ctx) => {
  const s = ctx.settings
  const slow = num(s.slowMs, 3000)
  const checks = await Promise.all([
    timed('База даних', () => db.execute(sql`select 1`)),
    s.checkBlobs ? timed('Файлове сховище', () => getStore({ name: 'app-assets' }).get('healthcheck')) : null,
    s.checkTelegram && botToken() ? timed('Telegram Bot API', () => botApi('getMe', {})) : null,
    s.checkNbu
      ? timed('API курсів НБУ', async () => {
          const r = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json', { signal: AbortSignal.timeout(10_000) })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
        })
      : null,
  ]).then((l) => l.filter((c): c is Check => !!c))

  // Report only changes: down / slow / recovered.
  const prev = (await getMemo<Record<string, 'ok' | 'slow' | 'down'>>('server')) ?? {}
  const next: Record<string, 'ok' | 'slow' | 'down'> = {}
  for (const c of checks) {
    const st = !c.ok ? 'down' : c.ms > slow ? 'slow' : 'ok'
    next[c.name] = st
    if (st === prev[c.name]) continue
    if (st === 'down') await ctx.event('error', 'server.down', `${c.name} недоступне: ${c.error}`, { subject: c.name })
    else if (st === 'slow') await ctx.event('warn', 'server.slow', `${c.name} відповідає повільно: ${c.ms} мс (поріг ${slow} мс)`, { subject: c.name })
    else if (prev[c.name]) await ctx.event('info', 'server.recovered', `${c.name} знову працює (${c.ms} мс)`, { subject: c.name })
  }
  await setMemo('server', next)
  const bad = checks.filter((c) => next[c.name] !== 'ok')
  return {
    done: true,
    summary: bad.length ? `Проблеми: ${bad.map((c) => c.name).join(', ')}` : `Усе працює (${checks.length} перевірок)`,
    result: { checks, slowMs: slow },
  }
}

// ── Telegram webhook ─────────────────────────────────────────────────────────────────────────

export const webhookMonitor: Runner = async (ctx) => {
  const s = ctx.settings
  if (!botToken()) return { done: true, summary: 'TELEGRAM_BOT_TOKEN не задано — перевірку пропущено', result: { configured: false } }
  const info = await webhookInfo()
  const expected = process.env.URL ? `${process.env.URL}/api/telegram/webhook` : ''
  const problems: string[] = []
  let restored = false
  if (expected && info.url !== expected) {
    if (s.autoRestore && webhookSecret() && process.env.URL) {
      await setupWebhook(process.env.URL)
      restored = true
      await ctx.event('info', 'webhook.restored', `Адресу webhook відновлено: ${expected} (було: ${info.url || 'порожньо'})`, { subject: 'url' })
    } else problems.push(`адреса webhook ${info.url ? `«${info.url}»` : 'порожня'} замість ${expected}`)
  }
  if (info.pendingUpdateCount > num(s.maxPending, 50)) problems.push(`у черзі ${info.pendingUpdateCount} оновлень`)
  if (info.lastErrorDate && Date.parse(info.lastErrorDate) > Date.now() - num(s.errorMinutes, 30) * 60_000)
    problems.push(`помилка доставки: ${info.lastErrorMessage || 'невідома'}`)

  const key = problems.join(' | ')
  const prev = (await getMemo<{ key: string }>('webhook'))?.key ?? ''
  if (key && key !== prev) await ctx.event('warn', 'webhook.problem', `Telegram webhook: ${problems.join('; ')}`, { subject: key })
  if (!key && prev) await ctx.event('info', 'webhook.ok', 'Telegram webhook знову в нормі', { subject: 'ok' })
  await setMemo('webhook', { key })
  return {
    done: true,
    summary: problems.length ? problems.join('; ') : restored ? 'Адресу відновлено' : 'Webhook у нормі',
    result: { ...info, expected, problems, restored },
  }
}

// ── Background work ──────────────────────────────────────────────────────────────────────────

export const jobsMonitor: Runner = async (ctx) => {
  const s = ctx.settings
  const now = Date.now()
  const warnings: string[] = []
  const broadcastsOn = ctx.config.modules.broadcasts.enabled && !ctx.config.paused

  const late = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.status, 'scheduled'), lt(broadcasts.scheduledAt, new Date(now - num(s.lateMinutes, 15) * 60_000))))
  for (const b of late) {
    if (await once(ctx, 'jobs.late_broadcast', b.id, 7 * DAY, `Запланована розсилка не стартувала (час: ${b.scheduledAt?.toISOString().slice(0, 16).replace('T', ' ')} UTC)${broadcastsOn ? '' : ' — модуль «Керування розсилками» вимкнено'}`))
      warnings.push(b.id)
  }

  const orders = await db
    .select()
    .from(topupOrders)
    .where(and(inArray(topupOrders.status, ['paid', 'processing', 'failed']), lt(topupOrders.updatedAt, new Date(now - num(s.orderMinutes, 30) * 60_000))))
    .limit(50)
  for (const o of orders) {
    const op = OPERATORS.find((x) => x.id === o.operator)?.name ?? o.operator
    if (await once(ctx, 'jobs.order_attention', o.id, 30 * DAY, `Оплачене поповнення без зарахування: ${op}, ${o.amountKop / 100} ₴, статус «${o.status}», замовлення ${o.id.slice(0, 8)}`))
      warnings.push(o.id)
  }

  return {
    done: true,
    summary: `Нових попереджень: ${warnings.length} (розсилок із запізненням: ${late.length}, поповнень без зарахування: ${orders.length})`,
    result: { lateBroadcasts: late.length, ordersAttention: orders.length },
  }
}
