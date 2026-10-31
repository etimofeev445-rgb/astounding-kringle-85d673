import { and, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { adminLog, ads, appEvents, places, reports, topupOrders, users } from '../../../db/schema.js'
import { isAdminId } from '../adminAuth'
import { InputError, int, iso, like, log, obj, str, type Admin } from './util'

export interface AdminUser {
  id: string
  username: string
  name: string
  languageCode: string
  blocked: boolean
  blockedReason: string
  sessions: number
  firstSeenAt: string
  lastSeenAt: string
  ads: number
  places: number
  isAdmin: boolean
}

type UserRow = typeof users.$inferSelect

async function withCounts(rows: UserRow[]): Promise<AdminUser[]> {
  const ids = rows.map((r) => r.telegramUserId)
  const countBy = async (table: typeof ads | typeof places) => {
    if (!ids.length) return new Map<string, number>()
    const res = await db
      .select({ id: table.telegramUserId, n: count() })
      .from(table)
      .where(and(inArray(table.telegramUserId, ids), eq(table.status, 'active')))
      .groupBy(table.telegramUserId)
    return new Map(res.map((r) => [r.id, r.n]))
  }
  const [adCounts, placeCounts] = await Promise.all([countBy(ads), countBy(places)])
  return rows.map((r) => ({
    id: r.telegramUserId,
    username: r.username,
    name: [r.firstName, r.lastName].filter(Boolean).join(' '),
    languageCode: r.languageCode,
    blocked: r.blocked,
    blockedReason: r.blockedReason,
    sessions: r.sessions,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    ads: adCounts.get(r.telegramUserId) ?? 0,
    places: placeCounts.get(r.telegramUserId) ?? 0,
    isAdmin: isAdminId(r.telegramUserId),
  }))
}

const PAGE = 30

export async function listUsers(_: Admin, p: unknown) {
  const { q: rawQ, filter, offset: rawOffset } = obj(p)
  const q = str(rawQ, 80).replace(/^@/, '')
  const offset = int(rawOffset, 0, 100_000, 0)
  const conds = []
  if (q) {
    const pat = like(q)
    conds.push(or(ilike(users.telegramUserId, pat), ilike(users.username, pat), ilike(users.firstName, pat), ilike(users.lastName, pat)))
  }
  if (filter === 'blocked') conds.push(eq(users.blocked, true))
  if (filter === 'new') conds.push(gte(users.firstSeenAt, new Date(Date.now() - 7 * 86400_000)))
  const where = conds.length ? and(...conds) : undefined
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(users).where(where).orderBy(desc(users.lastSeenAt)).limit(PAGE).offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ])
  return { users: await withCounts(rows), total, pageSize: PAGE }
}

export async function getUser(_: Admin, p: unknown) {
  const id = str(obj(p).id, 30)
  if (!/^\d+$/.test(id)) throw new InputError('Невірний ID')
  const [row] = await db.select().from(users).where(eq(users.telegramUserId, id))
  if (!row) throw new InputError('Користувача не знайдено')
  const [[user], userAds, userPlaces, orders, filed, actions, [opens]] = await Promise.all([
    withCounts([row]),
    db.select().from(ads).where(eq(ads.telegramUserId, id)).orderBy(desc(ads.createdAt)).limit(50),
    db.select().from(places).where(eq(places.telegramUserId, id)).orderBy(desc(places.createdAt)).limit(50),
    db.select().from(topupOrders).where(eq(topupOrders.telegramUserId, id)).orderBy(desc(topupOrders.createdAt)).limit(50),
    db.select().from(reports).where(eq(reports.telegramUserId, id)).orderBy(desc(reports.createdAt)).limit(50),
    db
      .select()
      .from(adminLog)
      .where(eq(adminLog.targetId, id))
      .orderBy(desc(adminLog.createdAt))
      .limit(50),
    db
      .select({ n: count(), days: sql<number>`count(distinct date(${appEvents.createdAt}))`.mapWith(Number) })
      .from(appEvents)
      .where(and(eq(appEvents.telegramUserId, id), gte(appEvents.createdAt, new Date(Date.now() - 30 * 86400_000)))),
  ])

  // One timeline of everything this user did (and what admins did to them), newest first.
  type Entry = { at: string; kind: string; text: string }
  const history: Entry[] = [
    { at: row.firstSeenAt.toISOString(), kind: 'join', text: 'Перший вхід у застосунок' },
    ...userAds.map((a) => ({ at: a.createdAt.toISOString(), kind: 'ad', text: `Оголошення «${a.title}» (${a.status})` })),
    ...userPlaces.map((pl) => ({ at: pl.createdAt.toISOString(), kind: 'place', text: `Бізнес-картка «${pl.title}» (${pl.status})` })),
    ...orders.map((o) => ({ at: o.createdAt.toISOString(), kind: 'order', text: `Поповнення ${o.amountKop / 100} ₴ (${o.status})` })),
    ...filed.map((r) => ({ at: r.createdAt.toISOString(), kind: 'report', text: `Скарга: ${r.reason} (${r.status})` })),
    ...actions.map((a) => ({ at: a.createdAt.toISOString(), kind: 'admin', text: `Адмін: ${a.action}` })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    user,
    activity: { opens30d: opens?.n ?? 0, activeDays30d: opens?.days ?? 0 },
    ads: userAds.map((a) => ({ id: a.id, title: a.title, status: a.status, moderation: a.moderation, createdAt: a.createdAt.toISOString() })),
    places: userPlaces.map((pl) => ({ id: pl.id, title: pl.title, status: pl.status, moderation: pl.moderation, createdAt: pl.createdAt.toISOString() })),
    orders: orders.map((o) => ({ id: o.id, amount: o.amountKop / 100, status: o.status, createdAt: o.createdAt.toISOString(), updatedAt: iso(o.updatedAt) })),
    history,
  }
}

export async function setBlocked(admin: Admin, p: unknown) {
  const { id: rawId, blocked, reason } = obj(p)
  const id = str(rawId, 30)
  if (!/^\d+$/.test(id)) throw new InputError('Невірний ID')
  if (isAdminId(id)) throw new InputError('Адміністратора не можна заблокувати')
  const [row] = await db
    .update(users)
    .set({ blocked: blocked === true, blockedReason: blocked === true ? str(reason, 300) : '' })
    .where(eq(users.telegramUserId, id))
    .returning()
  if (!row) throw new InputError('Користувача не знайдено')
  await log(admin, blocked === true ? 'user.block' : 'user.unblock', 'user', id, { reason: row.blockedReason })
  return { blocked: row.blocked }
}
