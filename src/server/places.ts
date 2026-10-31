import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ads, places } from '../../db/schema.js'
import type { AdView } from '../lib/ads'
import { PLACE_LIMITS, normalizeStoreKey, type PlaceInput, type PlaceView } from '../lib/places'
import { adView, decodePhoto } from './adsChannel'
import { parsePlaceInput, placeView } from './placeView'
import { publish, sync, withdraw, type NewImages } from './catalogChannel'
import { deletePlacePhoto, savePlacePhoto } from './placePhotos'
import { isBlocked, loadConfig } from './appState'
import { verifyInitData, verifyInitUser } from './telegramBot'

// Catalog cards. "Опублікувати" posts the card to the Telegram catalog channel; the row here only
// indexes that post so the in-app feed, edits and deletions stay in sync with the channel.

export type PlaceResult =
  | { ok: true; place: PlaceView; published: boolean }
  | { ok: false; reason: 'unauthorized' | 'invalid' | 'limit' | 'not_found' | 'channel' | 'server' | 'blocked' | 'disabled' }

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

export const listPlaces = createServerFn({ method: 'POST' })
  .validator((d: { initData?: string }) => ({ initData: String(d.initData ?? '').slice(0, 4096) }))
  .handler(async ({ data }): Promise<{ places: PlaceView[] }> => {
    const userId = verifyInitData(data.initData)
    const rows = await db.select().from(places).where(eq(places.status, 'active')).orderBy(desc(places.createdAt)).limit(500)
    return { places: rows.map((r) => placeView(r, userId)) }
  })

export const getStorefront = createServerFn({ method: 'POST' })
  .validator((d: { initData?: string; store: string }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    store: normalizeStoreKey(String(d.store ?? '')),
  }))
  .handler(async ({ data }): Promise<{ business: PlaceView | null; items: PlaceView[]; ads: AdView[] }> => {
    if (!data.store) return { business: null, items: [], ads: [] }
    const userId = verifyInitData(data.initData)
    const rows = await db
      .select()
      .from(places)
      .where(and(eq(places.storeKey, data.store), eq(places.status, 'active')))
      .orderBy(asc(places.createdAt))
    // The owner's first card heads the storefront; the rest are listed below it.
    const business = rows[0] ?? null
    const items = rows.slice(1)
    // Also list the seller's classic channel ads (same Telegram account).
    const ownerId = rows[0]?.telegramUserId
    const adRows = ownerId
      ? await db
          .select()
          .from(ads)
          .where(and(eq(ads.telegramUserId, ownerId), eq(ads.status, 'active')))
          .orderBy(desc(ads.createdAt))
          .limit(50)
      : []
    return {
      business: business && placeView(business, userId),
      items: items.map((r) => placeView(r, userId)),
      ads: adRows.map((r) => adView(r, userId)),
    }
  })

export const savePlace = createServerFn({ method: 'POST' })
  .validator(
    (d: {
      initData: string
      id?: string
      place: PlaceInput
      photo?: string
      cover?: string
      removePhoto?: boolean
      removeCover?: boolean
    }) => ({
      initData: String(d.initData ?? '').slice(0, 4096),
      id: d.id ? String(d.id) : undefined,
      place: d.place ?? ({} as PlaceInput),
      photo: String(d.photo ?? ''),
      cover: String(d.cover ?? ''),
      removePhoto: !!d.removePhoto,
      removeCover: !!d.removeCover,
    }),
  )
  .handler(async ({ data }): Promise<PlaceResult> => {
    // DB/Blobs failures come back as a typed reason instead of a thrown network error.
    try {
      return data.id ? await updatePlace({ ...data, id: data.id }) : await createPlace(data)
    } catch (e) {
      console.error('Save place error:', e)
      return { ok: false, reason: 'server' }
    }
  })

type SaveData = {
  initData: string
  place: PlaceInput
  photo: string
  cover: string
  removePhoto: boolean
  removeCover: boolean
}

function prepare(data: SaveData) {
  const user = verifyInitUser(data.initData)
  if (!user) return { error: 'unauthorized' as const }
  const input = parsePlaceInput(data.place)
  const photo = decodePhoto(data.photo)
  const cover = decodePhoto(data.cover)
  if (!input || photo === 'invalid' || cover === 'invalid') return { error: 'invalid' as const }
  // The storefront key always comes from the signed Telegram identity.
  const storeKey = user.username ? user.username.toLowerCase() : `id${user.id}`
  return { user, input, storeKey, photo, cover }
}

async function createPlace(data: SaveData): Promise<PlaceResult> {
  const r = prepare(data)
  if ('error' in r) return { ok: false, reason: r.error! }
  const { user, input, storeKey, photo, cover } = r
  if (await isBlocked(user.id)) return { ok: false, reason: 'blocked' }
  if (!(await loadConfig()).features.catalogPosting) return { ok: false, reason: 'disabled' }
  const [{ n }] = await db
    .select({ n: count() })
    .from(places)
    .where(and(eq(places.telegramUserId, user.id), eq(places.status, 'active')))
  if (n >= PLACE_LIMITS.perUser) return { ok: false, reason: 'limit' }

  const [row] = await db
    .insert(places)
    .values({ ...input, storeKey, telegramUserId: user.id, hasPhoto: !!photo, hasCover: !!cover })
    .returning()
  const fresh: NewImages = { ...(photo ? { photo } : {}), ...(cover ? { cover } : {}) }
  try {
    if (photo) await savePlacePhoto(row.id, 'photo', photo)
    if (cover) await savePlacePhoto(row.id, 'cover', cover)
    const post = await publish(row, fresh)
    const [saved] = await db
      .update(places)
      .set({ channelChatId: post.chatId, channelMessageIds: post.ids })
      .where(eq(places.id, row.id))
      .returning()
    return { ok: true, place: placeView(saved, user.id), published: true }
  } catch (e) {
    // No channel post → no card: the feed only shows what is actually in the channel.
    console.error('Publish place error:', e)
    await db.delete(places).where(eq(places.id, row.id))
    if (photo) await deletePlacePhoto(row.id, 'photo').catch(() => {})
    if (cover) await deletePlacePhoto(row.id, 'cover').catch(() => {})
    return { ok: false, reason: 'channel' }
  }
}

async function updatePlace(data: SaveData & { id: string }): Promise<PlaceResult> {
  const r = prepare(data)
  if ('error' in r) return { ok: false, reason: r.error! }
  const { user, input, storeKey, photo, cover } = r
  if (!isUuid(data.id)) return { ok: false, reason: 'not_found' }
  if (await isBlocked(user.id)) return { ok: false, reason: 'blocked' }
  // Only the author (same Telegram ID) can edit a card.
  const [prev] = await db
    .select()
    .from(places)
    .where(and(eq(places.id, data.id), eq(places.telegramUserId, user.id), eq(places.status, 'active')))
  if (!prev) return { ok: false, reason: 'not_found' }

  const hasPhoto = photo ? true : data.removePhoto ? false : prev.hasPhoto
  const hasCover = cover ? true : data.removeCover ? false : prev.hasCover
  if (photo) await savePlacePhoto(prev.id, 'photo', photo)
  else if (prev.hasPhoto && !hasPhoto) await deletePlacePhoto(prev.id, 'photo')
  if (cover) await savePlacePhoto(prev.id, 'cover', cover)
  else if (prev.hasCover && !hasCover) await deletePlacePhoto(prev.id, 'cover')

  const [updated] = await db
    .update(places)
    .set({ ...input, storeKey, hasPhoto, hasCover, updatedAt: new Date() })
    .where(eq(places.id, prev.id))
    .returning()
  const post = await sync(prev, updated, { ...(photo ? { photo } : {}), ...(cover ? { cover } : {}) })
  const [saved] = await db
    .update(places)
    .set({ channelChatId: post?.chatId ?? null, channelMessageIds: post?.ids ?? [] })
    .where(eq(places.id, prev.id))
    .returning()
  // Keep every card of this user on the same storefront if their @username changed.
  await db
    .update(places)
    .set({ storeKey })
    .where(and(eq(places.telegramUserId, user.id), eq(places.status, 'active')))
  return { ok: true, place: placeView(saved, user.id), published: !!post }
}

export const deletePlace = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; id: string }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    id: String(d.id ?? ''),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const userId = verifyInitData(data.initData)
    if (!userId || !isUuid(data.id)) return { ok: false }
    const [place] = await db
      .update(places)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(and(eq(places.id, data.id), eq(places.telegramUserId, userId), eq(places.status, 'active')))
      .returning()
    if (!place) return { ok: false }
    await withdraw(place)
    if (place.hasPhoto) await deletePlacePhoto(place.id, 'photo')
    if (place.hasCover) await deletePlacePhoto(place.id, 'cover')
    return { ok: true }
  })
