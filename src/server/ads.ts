import { createServerFn } from '@tanstack/react-start'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ads, cartItems } from '../../db/schema.js'
import { AD_LIMITS, type AdInput, type AdView } from '../lib/ads'
import { deletePhoto, savePhoto } from './adPhotos'
import { adView, decodePhoto, parseAdInput, post, priceText, repost, unpost } from './adsChannel'
import { isBlocked, loadConfig } from './appState'
import { adsChannel, verifyInitData } from './telegramBot'

export type AdResult =
  | { ok: true; ad: AdView; published: boolean }
  | { ok: false; reason: 'unauthorized' | 'invalid' | 'limit' | 'not_found' | 'blocked' | 'disabled' }

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

export const listAds = createServerFn({ method: 'POST' })
  .validator((d: { initData?: string; mine?: boolean }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    mine: !!d.mine,
  }))
  .handler(async ({ data }): Promise<{ ads: AdView[]; authorized: boolean }> => {
    const userId = verifyInitData(data.initData)
    if (data.mine && !userId) return { ads: [], authorized: false }
    const where = data.mine
      ? and(eq(ads.status, 'active'), eq(ads.telegramUserId, userId!))
      : eq(ads.status, 'active')
    const rows = await db.select().from(ads).where(where).orderBy(desc(ads.createdAt)).limit(100)
    return { ads: rows.map((r) => adView(r, userId)), authorized: !!userId }
  })

export const saveAd = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; id?: string; ad: AdInput; photo?: string; removePhoto?: boolean }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    id: d.id ? String(d.id) : undefined,
    ad: d.ad ?? ({} as AdInput),
    photo: String(d.photo ?? ''),
    removePhoto: !!d.removePhoto,
  }))
  .handler(async ({ data }): Promise<AdResult> => {
    const userId = verifyInitData(data.initData)
    if (!userId) return { ok: false, reason: 'unauthorized' }
    const input = parseAdInput(data.ad)
    const photo = decodePhoto(data.photo)
    if (!input || photo === 'invalid') return { ok: false, reason: 'invalid' }
    if (await isBlocked(userId)) return { ok: false, reason: 'blocked' }

    if (!data.id) {
      if (!(await loadConfig()).features.adsPosting) return { ok: false, reason: 'disabled' }
      const [{ n }] = await db
        .select({ n: count() })
        .from(ads)
        .where(and(eq(ads.telegramUserId, userId), eq(ads.status, 'active')))
      if (n >= AD_LIMITS.perUser) return { ok: false, reason: 'limit' }

      const [ad] = await db
        .insert(ads)
        .values({ ...input, telegramUserId: userId, hasPhoto: !!photo })
        .returning()
      if (photo) await savePhoto(ad.id, photo)
      const messageId = await post(ad, photo)
      const [saved] = await db
        .update(ads)
        .set({ channelChatId: messageId ? adsChannel() : null, channelMessageId: messageId })
        .where(eq(ads.id, ad.id))
        .returning()
      return { ok: true, ad: adView(saved, userId), published: !!messageId }
    }

    if (!isUuid(data.id)) return { ok: false, reason: 'not_found' }
    const [prev] = await db
      .select()
      .from(ads)
      .where(and(eq(ads.id, data.id), eq(ads.telegramUserId, userId), eq(ads.status, 'active')))
    if (!prev) return { ok: false, reason: 'not_found' }

    const hasPhoto = photo ? true : data.removePhoto ? false : prev.hasPhoto
    if (photo) await savePhoto(prev.id, photo)
    else if (prev.hasPhoto && !hasPhoto) await deletePhoto(prev.id)

    const [updated] = await db
      .update(ads)
      .set({ ...input, hasPhoto, updatedAt: new Date() })
      .where(eq(ads.id, prev.id))
      .returning()
    const messageId = await repost(prev, updated, photo)
    const [saved] = await db
      .update(ads)
      .set({ channelChatId: messageId ? adsChannel() : null, channelMessageId: messageId })
      .where(eq(ads.id, prev.id))
      .returning()
    await db
      .update(cartItems)
      .set({ title: saved.title, subtitle: priceText(saved.price) })
      .where(and(eq(cartItems.kind, 'ad'), eq(cartItems.ref, saved.id)))
    return { ok: true, ad: adView(saved, userId), published: !!messageId }
  })

export const deleteAd = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; id: string }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    id: String(d.id ?? ''),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const userId = verifyInitData(data.initData)
    if (!userId || !isUuid(data.id)) return { ok: false }
    const [ad] = await db
      .update(ads)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(and(eq(ads.id, data.id), eq(ads.telegramUserId, userId), eq(ads.status, 'active')))
      .returning()
    if (!ad) return { ok: false }
    await unpost(ad)
    if (ad.hasPhoto) await deletePhoto(ad.id)
    await db.delete(cartItems).where(and(eq(cartItems.kind, 'ad'), eq(cartItems.ref, ad.id)))
    return { ok: true }
  })
