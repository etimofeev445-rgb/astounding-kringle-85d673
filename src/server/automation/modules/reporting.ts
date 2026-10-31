import { and, count, countDistinct, desc, eq, gt, gte, inArray, isNotNull, like, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { ads, appEvents, automationEvents, places, reports, supportTickets, topupOrders, users } from '../../../../db/schema.js'
import { AUTO_REPORTER } from '../../../lib/automation'
import { category } from '../../../lib/places'
import { getCursor, notifyAdmin, setCursor } from '../store'
import { DAY, num, type Runner } from './types'

// Notifications, daily reports and analytics. All figures are computed from the database at run
// time; nothing is estimated or invented.

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

async function eventsSince(since: Date, until: Date, where: ReturnType<typeof or>) {
  return db
    .select()
    .from(automationEvents)
    .where(and(gt(automationEvents.createdAt, since), lte(automationEvents.createdAt, until), where))
    .orderBy(desc(automationEvents.createdAt))
    .limit(50)
}

function section(title: string, lines: string[], total = lines.length) {
  if (!total) return ''
  const shown = lines.slice(0, 5).map((l) => `• ${l.slice(0, 200)}`)
  return `${title}${total > shown.length ? ` (${total})` : ''}\n${shown.join('\n')}${total > shown.length ? `\n… ще ${total - shown.length}` : ''}`
}

// ── Telegram notifications ───────────────────────────────────────────────────────────────────

export const notify: Runner = async (ctx) => {
  const s = ctx.settings
  const until = new Date()
  // First run: start from now instead of sending the whole history.
  const since = (await getCursor('notify')) ?? new Date(until.getTime() - 15 * 60_000)
  const parts: string[] = []
  const range = (col: Parameters<typeof gt>[0]) => and(gt(col, since), lte(col, until))

  if (s.newUsers) {
    const [{ n }] = await db.select({ n: count() }).from(users).where(range(users.firstSeenAt))
    if (n) parts.push(`👤 Нових користувачів: ${n}`)
  }
  if (s.newAds) {
    const [newAds, newPlaces] = await Promise.all([
      db.select({ title: ads.title }).from(ads).where(range(ads.createdAt)).orderBy(desc(ads.createdAt)).limit(50),
      db.select({ title: places.title }).from(places).where(range(places.createdAt)).orderBy(desc(places.createdAt)).limit(50),
    ])
    parts.push(section('📢 Нові оголошення', newAds.map((a) => a.title)), section('🏪 Нові картки бізнесу', newPlaces.map((p) => p.title)))
  }
  if (s.reports) {
    const rows = await db.select({ user: reports.telegramUserId, reason: reports.reason }).from(reports).where(range(reports.createdAt)).limit(50)
    const auto = rows.filter((r) => r.user === AUTO_REPORTER)
    const human = rows.filter((r) => r.user !== AUTO_REPORTER)
    parts.push(section('🚩 Скарги користувачів', human.map((r) => r.reason)), section('🤖 Автоперевірка: на модерацію', auto.map((r) => r.reason.replace(/^🤖 Автоперевірка: /, ''))))
  }
  const evSection = async (on: unknown, title: string, cond: ReturnType<typeof or>) => {
    if (!on) return
    const ev = await eventsSince(since, until, cond)
    parts.push(section(title, ev.map((e) => e.message)))
  }
  await evSection(s.suspicious, '🛡 Підозріла активність', or(eq(automationEvents.kind, 'users.suspicious'), eq(automationEvents.kind, 'security.alert')))
  await evSection(s.appErrors, '❗ Помилки застосунку та сервера', or(eq(automationEvents.kind, 'app.error'), like(automationEvents.kind, 'server.%')))
  await evSection(s.webhook, '🪝 Telegram webhook', or(like(automationEvents.kind, 'webhook.%')))
  await evSection(
    s.jobErrors,
    '⚙️ Фонові задачі',
    or(inArray(automationEvents.kind, ['job.failed', 'job.stuck', 'jobs.late_broadcast', 'jobs.order_attention'])),
  )
  await evSection(true, '💬 Підтримка', or(eq(automationEvents.kind, 'support.escalated')))

  const body = parts.filter(Boolean)
  if (body.length) {
    const ok = await notifyAdmin(`🔔 UAT Market — нове\n\n${body.join('\n\n')}`)
    // Not delivered: keep the cursor so the next attempt resends the same period.
    if (!ok) throw new Error('Telegram не прийняв повідомлення (перевірте чат сповіщень і чи запущено бота)')
  }
  await setCursor('notify', until)
  return { done: true, summary: body.length ? `Надіслано: ${body.length} розділ(ів)` : 'Нічого нового', result: { sections: body.length } }
}

// ── Daily report ─────────────────────────────────────────────────────────────────────────────

export async function dailyStats(includeOrders: boolean) {
  const since = new Date(Date.now() - DAY)
  const c = async (q: Promise<{ n: number }[]>) => (await q)[0].n
  const [newUsers, activeUsers, opens, newAds, newPlaces, userReports, autoReports, resolved, errors, jobFailures, tickets, escalated, orderRows] =
    await Promise.all([
      c(db.select({ n: count() }).from(users).where(gte(users.firstSeenAt, since))),
      c(db.select({ n: countDistinct(appEvents.telegramUserId) }).from(appEvents).where(gte(appEvents.createdAt, since))),
      c(db.select({ n: count() }).from(appEvents).where(gte(appEvents.createdAt, since))),
      c(db.select({ n: count() }).from(ads).where(gte(ads.createdAt, since))),
      c(db.select({ n: count() }).from(places).where(gte(places.createdAt, since))),
      c(db.select({ n: count() }).from(reports).where(and(gte(reports.createdAt, since), ne(reports.telegramUserId, AUTO_REPORTER)))),
      c(db.select({ n: count() }).from(reports).where(and(gte(reports.createdAt, since), eq(reports.telegramUserId, AUTO_REPORTER)))),
      c(db.select({ n: count() }).from(reports).where(and(isNotNull(reports.resolvedAt), gte(reports.resolvedAt, since)))),
      c(db.select({ n: count() }).from(automationEvents).where(and(gte(automationEvents.createdAt, since), eq(automationEvents.level, 'error')))),
      c(db.select({ n: count() }).from(automationEvents).where(and(gte(automationEvents.createdAt, since), eq(automationEvents.kind, 'job.failed')))),
      c(db.select({ n: count() }).from(supportTickets).where(gte(supportTickets.createdAt, since))),
      c(db.select({ n: count() }).from(supportTickets).where(and(isNotNull(supportTickets.escalatedAt), gte(supportTickets.escalatedAt, since)))),
      includeOrders
        ? db
            .select({ status: topupOrders.status, n: count(), sum: sql<number>`coalesce(sum(${topupOrders.amountKop}), 0)`.mapWith(Number) })
            .from(topupOrders)
            .where(gte(topupOrders.createdAt, since))
            .groupBy(topupOrders.status)
        : Promise.resolve([]),
    ])
  const [openReports, pendingAds, pendingPlaces] = await Promise.all([
    c(db.select({ n: count() }).from(reports).where(eq(reports.status, 'open'))),
    c(db.select({ n: count() }).from(ads).where(and(eq(ads.status, 'active'), eq(ads.moderation, 'pending')))),
    c(db.select({ n: count() }).from(places).where(and(eq(places.status, 'active'), eq(places.moderation, 'pending')))),
  ])
  const orders = Object.fromEntries(orderRows.map((r) => [r.status, { n: r.n, sum: r.sum / 100 }]))
  return {
    period: { from: since.toISOString(), to: new Date().toISOString() },
    users: { new: newUsers, active: activeUsers, opens },
    content: { newAds, newPlaces, pendingAds, pendingPlaces },
    reports: { user: userReports, auto: autoReports, resolved, open: openReports },
    support: { tickets, escalated },
    errors: { total: errors, jobFailures },
    orders: includeOrders ? orders : null,
  }
}

export function dailyText(r: Awaited<ReturnType<typeof dailyStats>>) {
  const o = r.orders
  const ordersLine = o
    ? `\n💳 Поповнення: виконано ${o.fulfilled?.n ?? 0} на ${o.fulfilled?.sum ?? 0} ₴; очікують/помилка ${(o.paid?.n ?? 0) + (o.processing?.n ?? 0) + (o.failed?.n ?? 0)}; неоплачених ${o.pending?.n ?? 0}`
    : ''
  return [
    '📊 UAT Market — звіт за 24 години',
    '',
    `👥 Нових користувачів: ${r.users.new} · активних: ${r.users.active} · відкриттів: ${r.users.opens}`,
    `📢 Нових оголошень: ${r.content.newAds} · карток бізнесу: ${r.content.newPlaces}`,
    `🕓 Чекають модерації: ${r.content.pendingAds} оголошень, ${r.content.pendingPlaces} карток`,
    `🚩 Скарг: ${r.reports.user} від користувачів, ${r.reports.auto} від автоперевірки · розглянуто ${r.reports.resolved} · відкритих ${r.reports.open}`,
    `💬 Звернень у підтримку: ${r.support.tickets} · передано адміністратору: ${r.support.escalated}`,
    `❗ Помилок: ${r.errors.total} · збоїв фонових задач: ${r.errors.jobFailures}`,
  ].join('\n') + ordersLine
}

export const dailyReport: Runner = async (ctx) => {
  const stats = await dailyStats(!!ctx.settings.includeOrders)
  const n = ctx.config.modules.notify
  const send = n.enabled && !!n.settings.dailyReport
  if (send && !(await notifyAdmin(dailyText(stats)))) throw new Error('Telegram не прийняв звіт')
  return { done: true, summary: send ? 'Звіт надіслано в Telegram' : 'Звіт сформовано (надсилання вимкнено в сповіщеннях)', result: stats }
}

// ── Analytics ────────────────────────────────────────────────────────────────────────────────

export const analytics: Runner = async (ctx) => {
  const topN = num(ctx.settings.topN, 5)
  const now = Date.now()
  const at = (d: number) => new Date(now - d * DAY)
  const distinctSince = async (d: number) =>
    (await db.select({ n: countDistinct(appEvents.telegramUserId) }).from(appEvents).where(gte(appEvents.createdAt, at(d))))[0].n

  const [authorsRow, retentionRow] = await Promise.all([
    db.execute(sql`select count(*)::int as n from (
        select telegram_user_id from ${ads} union select telegram_user_id from ${places}) t`),
    // D7 retention: of users who first came 8–14 days ago, the share that opened the app again 7+ days after their first visit.
    db.execute(sql`
      select count(*)::int as cohort,
        count(*) filter (where exists (
          select 1 from ${appEvents} e where e.telegram_user_id = u.telegram_user_id and e.created_at >= u.first_seen_at + interval '7 days'
        ))::int as returned
      from ${users} u where u.first_seen_at >= ${at(14)} and u.first_seen_at < ${at(8)}`),
  ])
  const [dau, wau, mau, totalUsers, sessions, categories, reported] = await Promise.all([
    distinctSince(1),
    distinctSince(7),
    distinctSince(30),
    db.select({ n: count() }).from(users).then((r) => r[0].n),
    db
      .select({ avg: sql<number>`coalesce(avg(${users.sessions}), 0)`.mapWith(Number) })
      .from(users)
      .where(gte(users.lastSeenAt, at(30)))
      .then((r) => r[0].avg),
    db
      .select({ category: places.category, n: count() })
      .from(places)
      .where(eq(places.status, 'active'))
      .groupBy(places.category)
      .orderBy(desc(count()))
      .limit(topN),
    db
      .select({ kind: reports.targetKind, id: reports.targetId, n: count() })
      .from(reports)
      .where(gte(reports.createdAt, at(30)))
      .groupBy(reports.targetKind, reports.targetId)
      .orderBy(desc(count()))
      .limit(topN),
  ])
  const rows = <T,>(r: unknown) => (Array.isArray(r) ? (r as T[]) : ((r as { rows: T[] }).rows ?? []))
  const authors = rows<{ n: number }>(authorsRow)[0]?.n ?? 0
  const ret = rows<{ cohort: number; returned: number }>(retentionRow)[0] ?? { cohort: 0, returned: 0 }

  const adIds = reported.filter((r) => r.kind === 'ad').map((r) => r.id)
  const placeIds = reported.filter((r) => r.kind === 'place').map((r) => r.id)
  const [adT, placeT] = await Promise.all([
    adIds.length ? db.select({ id: ads.id, title: ads.title }).from(ads).where(inArray(ads.id, adIds)) : [],
    placeIds.length ? db.select({ id: places.id, title: places.title }).from(places).where(inArray(places.id, placeIds)) : [],
  ])
  const titles = new Map([...adT, ...placeT].map((t) => [t.id, t.title]))

  const result = {
    dau,
    wau,
    mau,
    stickiness: pct(dau, mau),
    totalUsers,
    sessionsPerUser: Math.round(sessions * 10) / 10,
    authors,
    authorsShare: pct(authors, totalUsers),
    retentionD7: { cohort: ret.cohort, returned: ret.returned, pct: pct(ret.returned, ret.cohort) },
    topCategories: categories.map((c) => ({ id: c.category, label: category(c.category).label.uk, n: c.n })),
    topReported: reported.map((r) => ({ kind: r.kind, id: r.id, title: titles.get(r.id) ?? '—', n: r.n })),
  }
  return { done: true, summary: `DAU ${dau} · WAU ${wau} · MAU ${mau} · утримання D7 ${result.retentionD7.pct}%`, result }
}
