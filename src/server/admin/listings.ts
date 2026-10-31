import { and, count, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { ads, cartItems, places, reports, users } from '../../../db/schema.js'
import { storedPhoto } from '../adPhotos'
import { parseAdInput, post, repost, unpost } from '../adsChannel'
import { postUrl as placePostUrl, publish, sync, withdraw } from '../catalogChannel'
import { parsePlaceInput } from '../placeView'
import { adsChannel } from '../telegramBot'
import { AUTO_REPORTER } from '../../lib/automation'
import { InputError, int, isUuid, like, log, obj, str, type Admin } from './util'

// Moderation of both kinds of user content: classified ads and catalog (business) cards.
// Nothing is ever hard-deleted: reject/delete only change the status and withdraw the channel post.

type Kind = 'ad' | 'place'
type Ad = typeof ads.$inferSelect
type Place = typeof places.$inferSelect

export interface AdminListing {
  kind: Kind
  id: string
  title: string
  description: string
  price: string
  status: string
  moderation: string
  userId: string
  author: string
  photoUrl: string | null
  postUrl: string | null
  openReports: number
  createdAt: string
  updatedAt: string
  // Raw editable fields (AdInput / PlaceInput).
  fields: Record<string, string>
}

const kindOf = (v: unknown): Kind => {
  if (v === 'ad' || v === 'place') return v
  throw new InputError('Невідомий тип')
}

const adPostUrl = (a: Ad) =>
  a.channelMessageId && a.channelChatId?.startsWith('@') ? `https://t.me/${a.channelChatId.slice(1)}/${a.channelMessageId}` : null

function adListing(a: Ad, author: string, reportsOpen: number): AdminListing {
  return {
    kind: 'ad',
    id: a.id,
    title: a.title,
    description: a.description,
    price: a.price == null ? 'Договірна' : `${a.price.toLocaleString('uk-UA')} ₴`,
    status: a.status,
    moderation: a.moderation,
    userId: a.telegramUserId,
    author,
    photoUrl: a.hasPhoto && a.status === 'active' ? `/api/ads/photo/${a.id}?v=${a.updatedAt.getTime()}` : null,
    postUrl: a.status === 'active' ? adPostUrl(a) : null,
    openReports: reportsOpen,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    fields: {
      title: a.title,
      description: a.description,
      price: a.price == null ? '' : String(a.price),
      phone: a.phone,
      tgContact: a.tgContact,
    },
  }
}

function placeListing(p: Place, author: string, reportsOpen: number): AdminListing {
  const img = p.hasCover ? 'slot=cover&' : ''
  return {
    kind: 'place',
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    status: p.status,
    moderation: p.moderation,
    userId: p.telegramUserId,
    author,
    photoUrl: (p.hasCover || p.hasPhoto) && p.status === 'active' ? `/api/places/photo/${p.id}?${img}v=${p.updatedAt.getTime()}` : null,
    postUrl: p.status === 'active' ? placePostUrl(p) : null,
    openReports: reportsOpen,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    fields: {
      category: p.category,
      country: p.country,
      city: p.city,
      title: p.title,
      description: p.description,
      hours: p.hours,
      price: p.price,
      mapUrl: p.mapUrl,
      phone: p.phone,
      instagram: p.instagram,
      tgContact: p.tgContact,
    },
  }
}

async function authors(ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const rows = await db.select().from(users).where(inArray(users.telegramUserId, [...new Set(ids)]))
  return new Map(
    rows.map((u) => [u.telegramUserId, u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ')]),
  )
}

async function openReportCounts(kind: Kind, ids: string[]) {
  if (!ids.length) return new Map<string, number>()
  const rows = await db
    .select({ id: reports.targetId, n: count() })
    .from(reports)
    .where(and(eq(reports.targetKind, kind), eq(reports.status, 'open'), inArray(reports.targetId, ids)))
    .groupBy(reports.targetId)
  return new Map(rows.map((r) => [r.id, r.n]))
}

async function toListings(kind: Kind, rows: (Ad | Place)[]) {
  const ids = rows.map((r) => r.id)
  const [names, counts] = await Promise.all([authors(rows.map((r) => r.telegramUserId)), openReportCounts(kind, ids)])
  return rows.map((r) => {
    const author = names.get(r.telegramUserId) || `ID ${r.telegramUserId}`
    const n = counts.get(r.id) ?? 0
    return kind === 'ad' ? adListing(r as Ad, author, n) : placeListing(r as Place, author, n)
  })
}

const PAGE = 20

// filter: pending (active, not reviewed yet) | approved | rejected | deleted | reported | all
export async function listListings(_: Admin, p: unknown) {
  const o = obj(p)
  const kind = kindOf(o.kind)
  const q = str(o.q, 80)
  const offset = int(o.offset, 0, 100_000, 0)
  const t = kind === 'ad' ? ads : places
  const conds: (SQL | undefined)[] = []
  switch (o.filter) {
    case 'pending':
      conds.push(eq(t.status, 'active'), eq(t.moderation, 'pending'))
      break
    case 'approved':
      conds.push(eq(t.status, 'active'), eq(t.moderation, 'approved'))
      break
    case 'rejected':
      conds.push(eq(t.status, 'rejected'))
      break
    case 'deleted':
      conds.push(eq(t.status, 'deleted'))
      break
    // Moderation queue of the automatic check: items with an open "🤖 Автоперевірка" report.
    case 'flagged': {
      const flagged = await db
        .selectDistinct({ id: reports.targetId })
        .from(reports)
        .where(and(eq(reports.targetKind, kind), eq(reports.status, 'open'), eq(reports.telegramUserId, AUTO_REPORTER)))
      if (!flagged.length) return { items: [], total: 0, pageSize: PAGE }
      conds.push(inArray(t.id, flagged.map((r) => r.id)))
      break
    }
    case 'reported': {
      const reported = await db
        .selectDistinct({ id: reports.targetId })
        .from(reports)
        .where(and(eq(reports.targetKind, kind), eq(reports.status, 'open')))
      if (!reported.length) return { items: [], total: 0, pageSize: PAGE }
      conds.push(inArray(t.id, reported.map((r) => r.id)))
      break
    }
    default:
      conds.push(ne(t.status, 'deleted'))
  }
  if (q) conds.push(or(ilike(t.title, like(q)), ilike(t.description, like(q)), eq(t.telegramUserId, q)))
  const where = and(...conds)
  const rows =
    kind === 'ad'
      ? await db.select().from(ads).where(where).orderBy(desc(ads.createdAt)).limit(PAGE).offset(offset)
      : await db.select().from(places).where(where).orderBy(desc(places.createdAt)).limit(PAGE).offset(offset)
  const [{ total }] = await db.select({ total: count() }).from(t).where(where)
  return { items: await toListings(kind, rows), total, pageSize: PAGE }
}

async function loadAd(id: unknown) {
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [row] = await db.select().from(ads).where(eq(ads.id, id))
  if (!row) throw new InputError('Оголошення не знайдено')
  return row
}

async function loadPlace(id: unknown) {
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [row] = await db.select().from(places).where(eq(places.id, id))
  if (!row) throw new InputError('Картку не знайдено')
  return row
}

async function single(kind: Kind, id: string) {
  const row = kind === 'ad' ? await loadAd(id) : await loadPlace(id)
  const [item] = await toListings(kind, [row])
  return item
}

// Approve keeps (or, for a rejected item, re-publishes) the post; reject withdraws it from the channel.
export async function moderate(admin: Admin, p: unknown) {
  const o = obj(p)
  const kind = kindOf(o.kind)
  const decision = o.decision === 'approve' ? 'approve' : o.decision === 'reject' ? 'reject' : null
  if (!decision) throw new InputError('Невідома дія')
  const note = str(o.note, 300)

  if (kind === 'ad') {
    const ad = await loadAd(o.id)
    if (ad.status === 'deleted') throw new InputError('Оголошення видалене')
    if (decision === 'reject') {
      if (ad.status === 'active') await unpost(ad, 'Оголошення знято модератором.')
      await db.update(ads).set({ status: 'rejected', moderation: 'rejected', updatedAt: new Date() }).where(eq(ads.id, ad.id))
    } else if (ad.status === 'rejected') {
      const messageId = await post(ad, ad.hasPhoto ? await storedPhoto(ad.id) : null)
      await db
        .update(ads)
        .set({ status: 'active', moderation: 'approved', channelChatId: messageId ? adsChannel() : null, channelMessageId: messageId, updatedAt: new Date() })
        .where(eq(ads.id, ad.id))
    } else {
      await db.update(ads).set({ moderation: 'approved' }).where(eq(ads.id, ad.id))
    }
  } else {
    const place = await loadPlace(o.id)
    if (place.status === 'deleted') throw new InputError('Картку видалено')
    if (decision === 'reject') {
      if (place.status === 'active') await withdraw(place, 'Картку знято модератором.')
      await db.update(places).set({ status: 'rejected', moderation: 'rejected', updatedAt: new Date() }).where(eq(places.id, place.id))
    } else if (place.status === 'rejected') {
      // The catalog only lists cards that really are in the channel, so re-publishing must succeed.
      const post = await publish(place).catch((e) => {
        console.error('Republish place error:', e)
        throw new InputError('Канал недоступний — картку не опубліковано')
      })
      await db
        .update(places)
        .set({ status: 'active', moderation: 'approved', channelChatId: post.chatId, channelMessageIds: post.ids, updatedAt: new Date() })
        .where(eq(places.id, place.id))
    } else {
      await db.update(places).set({ moderation: 'approved' }).where(eq(places.id, place.id))
    }
  }
  await log(admin, `${kind}.${decision}`, kind, String(o.id), note ? { note } : {})
  return single(kind, String(o.id))
}

export async function updateListing(admin: Admin, p: unknown) {
  const o = obj(p)
  const kind = kindOf(o.kind)
  const fields = obj(o.fields)
  if (kind === 'ad') {
    const prev = await loadAd(o.id)
    if (prev.status === 'deleted') throw new InputError('Оголошення видалене')
    const input = parseAdInput({ ...fields, price: fields.price === '' ? null : (fields.price as number) })
    if (!input) throw new InputError('Перевірте поля: назва, опис і контакт обовʼязкові')
    const [next] = await db.update(ads).set({ ...input, updatedAt: new Date() }).where(eq(ads.id, prev.id)).returning()
    if (next.status === 'active') {
      const messageId = await repost(prev, next, null)
      await db.update(ads).set({ channelChatId: messageId ? adsChannel() : null, channelMessageId: messageId }).where(eq(ads.id, prev.id))
    }
    await db.update(cartItems).set({ title: next.title }).where(and(eq(cartItems.kind, 'ad'), eq(cartItems.ref, next.id)))
    await log(admin, 'ad.edit', 'ad', prev.id, { before: { title: prev.title }, after: { title: next.title } })
  } else {
    const prev = await loadPlace(o.id)
    if (prev.status === 'deleted') throw new InputError('Картку видалено')
    const input = parsePlaceInput(fields)
    if (!input) throw new InputError('Перевірте поля: назва, опис, категорія, країна, місто і хоча б один контакт')
    const [next] = await db.update(places).set({ ...input, updatedAt: new Date() }).where(eq(places.id, prev.id)).returning()
    if (next.status === 'active') {
      const post = await sync(prev, next, {})
      await db
        .update(places)
        .set({ channelChatId: post?.chatId ?? null, channelMessageIds: post?.ids ?? [] })
        .where(eq(places.id, prev.id))
    }
    await log(admin, 'place.edit', 'place', prev.id, { before: { title: prev.title }, after: { title: next.title } })
  }
  return single(kind, String(o.id))
}

// Soft delete (status "deleted"): the row, photos and history stay in the database.
export async function deleteListing(admin: Admin, p: unknown) {
  const o = obj(p)
  const kind = kindOf(o.kind)
  if (kind === 'ad') {
    const ad = await loadAd(o.id)
    if (ad.status === 'deleted') return single(kind, ad.id)
    if (ad.status === 'active') await unpost(ad, 'Оголошення видалено модератором.')
    await db.update(ads).set({ status: 'deleted', updatedAt: new Date() }).where(eq(ads.id, ad.id))
  } else {
    const place = await loadPlace(o.id)
    if (place.status === 'deleted') return single(kind, place.id)
    if (place.status === 'active') await withdraw(place, 'Картку видалено модератором.')
    await db.update(places).set({ status: 'deleted', updatedAt: new Date() }).where(eq(places.id, place.id))
  }
  await log(admin, `${kind}.delete`, kind, String(o.id))
  return single(kind, String(o.id))
}

export interface AdminReport {
  id: string
  kind: Kind
  targetId: string
  targetTitle: string
  targetStatus: string
  reason: string
  status: string
  reporter: string
  reporterId: string
  createdAt: string
}

export async function listReports(_: Admin, p: unknown) {
  const status = obj(p).status
  const where = status === 'resolved' || status === 'dismissed' || status === 'open' ? eq(reports.status, status) : undefined
  const rows = await db.select().from(reports).where(where).orderBy(desc(reports.createdAt)).limit(100)
  const adIds = rows.filter((r) => r.targetKind === 'ad').map((r) => r.targetId)
  const placeIds = rows.filter((r) => r.targetKind === 'place').map((r) => r.targetId)
  const [adRows, placeRows, names] = await Promise.all([
    adIds.length ? db.select({ id: ads.id, title: ads.title, status: ads.status }).from(ads).where(inArray(ads.id, adIds)) : [],
    placeIds.length
      ? db.select({ id: places.id, title: places.title, status: places.status }).from(places).where(inArray(places.id, placeIds))
      : [],
    authors(rows.map((r) => r.telegramUserId)),
  ])
  const targets = new Map([...adRows, ...placeRows].map((t) => [t.id, t]))
  const items: AdminReport[] = rows.map((r) => ({
    id: r.id,
    kind: r.targetKind as Kind,
    targetId: r.targetId,
    targetTitle: targets.get(r.targetId)?.title ?? '—',
    targetStatus: targets.get(r.targetId)?.status ?? 'unknown',
    reason: r.reason,
    status: r.status,
    reporter: r.telegramUserId === AUTO_REPORTER ? '🤖 Автоперевірка' : names.get(r.telegramUserId) || `ID ${r.telegramUserId}`,
    reporterId: r.telegramUserId,
    createdAt: r.createdAt.toISOString(),
  }))
  return { items }
}

// Closes a report; with rejectTarget the reported item is also rejected (and every other open
// report about it is resolved together).
export async function resolveReport(admin: Admin, p: unknown) {
  const o = obj(p)
  if (!isUuid(o.id)) throw new InputError('Невірний ID')
  const status = o.status === 'dismissed' ? 'dismissed' : 'resolved'
  const [report] = await db.select().from(reports).where(eq(reports.id, o.id))
  if (!report) throw new InputError('Скаргу не знайдено')
  if (o.rejectTarget === true) {
    await moderate(admin, { kind: report.targetKind, id: report.targetId, decision: 'reject', note: `Скарга: ${report.reason}` })
    await db
      .update(reports)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(and(eq(reports.targetKind, report.targetKind), eq(reports.targetId, report.targetId), eq(reports.status, 'open')))
  } else {
    await db.update(reports).set({ status, resolvedAt: new Date() }).where(eq(reports.id, report.id))
  }
  await log(admin, `report.${o.rejectTarget === true ? 'reject_target' : status}`, 'report', report.id, {
    target: `${report.targetKind}:${report.targetId}`,
  })
  return { ok: true }
}
