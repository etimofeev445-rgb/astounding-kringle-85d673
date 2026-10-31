import { and, count, desc, eq, gte, inArray, like as sqlLike, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { adminLog, ads, appEvents, places, reports, topupOrders, users } from '../../../db/schema.js'
import { OPERATORS, formatLocal } from '../../data/operators'
import { adminChatId, botToken, miniAppUrl, providerToken, sendMessage, webhookSecret } from '../telegramBot'
import { setupWebhook, webhookInfo } from '../webhookSetup'
import { InputError, displayName, int, isUuid, iso, log, obj, str, type Admin } from './util'

const DAY = 86400_000

// Opening the panel is the admin "login"; the log keeps one entry per opening.
export async function session(admin: Admin) {
  await log(admin, 'admin.login', 'admin', admin.id, { username: admin.username })
  return {
    admin: { id: admin.id, name: displayName(admin, admin.id) },
    // Which integrations are configured (booleans only — values never leave the server).
    env: {
      botToken: !!botToken(),
      webhookSecret: !!webhookSecret(),
      providerToken: !!providerToken(),
      adminChat: !!adminChatId(),
      aggregator: !!process.env.TOPUP_API_URL && !!process.env.TOPUP_API_KEY,
      miniAppUrl: !!miniAppUrl(),
    },
  }
}

export async function stats() {
  const now = Date.now()
  const today = new Date(new Date().setHours(0, 0, 0, 0))
  const since14 = new Date(today.getTime() - 13 * DAY)
  const countWhere = async (table: typeof users | typeof ads | typeof places | typeof reports, where?: ReturnType<typeof and>) =>
    (await db.select({ n: count() }).from(table).where(where))[0].n

  const [
    usersTotal,
    usersToday,
    users7d,
    users30d,
    active7d,
    blocked,
    adsActive,
    adsPending,
    placesActive,
    placesPending,
    reportsOpen,
    orderRows,
    opensByDay,
    newByDay,
  ] = await Promise.all([
    countWhere(users),
    countWhere(users, and(gte(users.firstSeenAt, today))),
    countWhere(users, and(gte(users.firstSeenAt, new Date(now - 7 * DAY)))),
    countWhere(users, and(gte(users.firstSeenAt, new Date(now - 30 * DAY)))),
    countWhere(users, and(gte(users.lastSeenAt, new Date(now - 7 * DAY)))),
    countWhere(users, and(eq(users.blocked, true))),
    countWhere(ads, and(eq(ads.status, 'active'))),
    countWhere(ads, and(eq(ads.status, 'active'), eq(ads.moderation, 'pending'))),
    countWhere(places, and(eq(places.status, 'active'))),
    countWhere(places, and(eq(places.status, 'active'), eq(places.moderation, 'pending'))),
    countWhere(reports, and(eq(reports.status, 'open'))),
    db
      .select({ status: topupOrders.status, n: count(), sum: sql<number>`coalesce(sum(${topupOrders.amountKop}), 0)`.mapWith(Number) })
      .from(topupOrders)
      .groupBy(topupOrders.status),
    db
      .select({
        day: sql<string>`to_char(date(${appEvents.createdAt}), 'YYYY-MM-DD')`,
        opens: count(),
        users: sql<number>`count(distinct ${appEvents.telegramUserId})`.mapWith(Number),
      })
      .from(appEvents)
      .where(gte(appEvents.createdAt, since14))
      .groupBy(sql`date(${appEvents.createdAt})`),
    db
      .select({ day: sql<string>`to_char(date(${users.firstSeenAt}), 'YYYY-MM-DD')`, n: count() })
      .from(users)
      .where(gte(users.firstSeenAt, since14))
      .groupBy(sql`date(${users.firstSeenAt})`),
  ])

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since14.getTime() + i * DAY)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const o = opensByDay.find((r) => r.day === key)
    return { day: key, opens: o?.opens ?? 0, users: o?.users ?? 0, newUsers: newByDay.find((r) => r.day === key)?.n ?? 0 }
  })

  const orders = Object.fromEntries(orderRows.map((r) => [r.status, { n: r.n, sum: r.sum / 100 }]))
  return {
    users: { total: usersTotal, today: usersToday, week: users7d, month: users30d, active7d, blocked },
    content: { adsActive, adsPending, placesActive, placesPending, reportsOpen },
    orders,
    // Paid but not credited automatically (manual mode, failures, interrupted processing).
    ordersAttention: (orders.paid?.n ?? 0) + (orders.failed?.n ?? 0) + (orders.processing?.n ?? 0),
    days,
  }
}

export async function listLog(_: Admin, p: unknown) {
  const o = obj(p)
  const group = str(o.group, 20)
  const offset = int(o.offset, 0, 100_000, 0)
  // Groups match action prefixes: admin.login, user.*, ad.* / place.* / report.*, settings.* …
  const prefixes: Record<string, string[]> = {
    login: ['admin.'],
    users: ['user.'],
    listings: ['ad.', 'place.', 'report.'],
    settings: ['settings.', 'asset.', 'document.', 'webhook.'],
    broadcasts: ['broadcast.'],
    orders: ['order.'],
  }
  const conds = (prefixes[group] ?? []).map((pre) => sqlLike(adminLog.action, `${pre}%`))
  const where = conds.length ? sql.join(conds, sql` or `) : undefined
  const rows = await db
    .select()
    .from(adminLog)
    .where(where ? sql`(${where})` : undefined)
    .orderBy(desc(adminLog.createdAt))
    .limit(50)
    .offset(offset)
  return {
    items: rows.map((r) => ({
      id: r.id,
      adminId: r.adminId,
      action: r.action,
      targetKind: r.targetKind,
      targetId: r.targetId,
      details: r.details as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    })),
    pageSize: 50,
  }
}

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'fulfilled', 'failed']

export async function listOrders(_: Admin, p: unknown) {
  const status = str(obj(p).status, 20)
  const where =
    status === 'attention'
      ? inArray(topupOrders.status, ['paid', 'processing', 'failed'])
      : ORDER_STATUSES.includes(status)
        ? eq(topupOrders.status, status)
        : undefined
  const rows = await db.select().from(topupOrders).where(where).orderBy(desc(topupOrders.createdAt)).limit(100)
  return {
    items: rows.map((o) => ({
      id: o.id,
      userId: o.telegramUserId,
      operator: OPERATORS.find((x) => x.id === o.operator)?.name ?? o.operator,
      phone: `+380 ${formatLocal(o.phone)}`,
      amount: o.amountKop / 100,
      status: o.status,
      error: o.error ?? '',
      aggregatorRef: o.aggregatorRef ?? '',
      providerChargeId: o.providerChargeId ?? '',
      createdAt: o.createdAt.toISOString(),
      updatedAt: iso(o.updatedAt),
    })),
  }
}

// For orders the admin has topped up by hand: records that and tells the customer.
// Only paid orders qualify — this never creates or credits a payment by itself.
export async function markOrderFulfilled(admin: Admin, p: unknown) {
  const o = obj(p)
  if (!isUuid(o.id)) throw new InputError('Невірний ID')
  const note = str(o.note, 200)
  const [order] = await db
    .update(topupOrders)
    .set({ status: 'fulfilled', aggregatorRef: `manual${note ? `: ${note}` : ''}`, updatedAt: new Date() })
    .where(and(eq(topupOrders.id, o.id), inArray(topupOrders.status, ['paid', 'processing', 'failed'])))
    .returning()
  if (!order) throw new InputError('Замовлення не оплачене або вже виконане')
  const op = OPERATORS.find((x) => x.id === order.operator)
  await sendMessage(order.telegramUserId, `✅ Рахунок поповнено: ${op?.name ?? order.operator} +380 ${formatLocal(order.phone)} — ${order.amountKop / 100} ₴`)
  await log(admin, 'order.manual_fulfilled', 'order', order.id, { amount: order.amountKop / 100, note })
  return { ok: true }
}

export async function getWebhook() {
  if (!botToken()) return { configured: false as const }
  try {
    return { configured: true as const, info: await webhookInfo(), expected: expectedWebhook() }
  } catch (e) {
    throw new InputError(e instanceof Error ? e.message : String(e))
  }
}

// Always the production site: a preview deploy must never steal the live bot's updates.
const expectedWebhook = () => (process.env.URL ? `${process.env.URL}/api/telegram/webhook` : '')

export async function resetWebhook(admin: Admin) {
  if (!botToken() || !webhookSecret()) throw new InputError('Не задано TELEGRAM_BOT_TOKEN або TELEGRAM_WEBHOOK_SECRET')
  if (!process.env.URL) throw new InputError('Невідома адреса сайту')
  try {
    const url = await setupWebhook(process.env.URL)
    await log(admin, 'webhook.setup', 'webhook', '', { url })
    return { url }
  } catch (e) {
    throw new InputError(e instanceof Error ? e.message : String(e))
  }
}
