import { createServerFn } from '@tanstack/react-start'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ads, cartItems } from '../../db/schema.js'
import { AD_LIMITS, normalizePhone, normalizeTg, type AdInput, type AdView } from '../lib/ads'
import { deletePhoto, savePhoto, storedPhoto } from './adPhotos'
import { adsChannel, botApi, botApiForm, botToken, verifyInitData } from './telegramBot'

type Ad = typeof ads.$inferSelect

export type AdResult =
  | { ok: true; ad: AdView; published: boolean }
  | { ok: false; reason: 'unauthorized' | 'invalid' | 'limit' | 'not_found' }

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const priceText = (p: number | null) => (p == null ? 'Договірна' : `${p.toLocaleString('uk-UA')} ₴`)

function caption(ad: Ad) {
  const lines = [`📢 <b>${esc(ad.title)}</b>`, '', esc(ad.description), '', `💰 <b>${priceText(ad.price)}</b>`]
  if (ad.phone) lines.push(`📞 ${esc(ad.phone)}`)
  if (ad.tgContact) lines.push(`✈️ ${ad.tgContact.startsWith('@') ? ad.tgContact : `Telegram ID ${ad.tgContact}`}`)
  return lines.join('\n')
}

function postUrl(ad: Ad) {
  if (!ad.channelMessageId || !ad.channelChatId?.startsWith('@')) return null
  return `https://t.me/${ad.channelChatId.slice(1)}/${ad.channelMessageId}`
}

export function adView(ad: Ad, userId: string | null): AdView {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: ad.price,
    phone: ad.phone,
    tgContact: ad.tgContact,
    photoUrl: ad.hasPhoto ? `/api/ads/photo/${ad.id}?v=${ad.updatedAt.getTime()}` : null,
    postUrl: postUrl(ad),
    createdAt: ad.createdAt.toISOString(),
    mine: ad.telegramUserId === userId,
  }
}

export function decodePhoto(dataUrl: string): Uint8Array<ArrayBuffer> | null | 'invalid' {
  if (!dataUrl) return null
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) return 'invalid'
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))
  return bytes.length > 0 && bytes.length <= AD_LIMITS.photoBytes ? bytes : 'invalid'
}

const photoForm = (fields: Record<string, string>, photo: Uint8Array<ArrayBuffer>) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg')
  return form
}

// Posts a fresh channel message; returns its id, or null if the channel isn't reachable.
async function post(ad: Ad, photo: Uint8Array<ArrayBuffer> | null): Promise<number | null> {
  if (!botToken()) return null
  const chat = adsChannel()
  try {
    const msg = photo
      ? await botApiForm<{ message_id: number }>(
          'sendPhoto',
          photoForm({ chat_id: chat, caption: caption(ad), parse_mode: 'HTML' }, photo),
        )
      : await botApi<{ message_id: number }>('sendMessage', { chat_id: chat, text: caption(ad), parse_mode: 'HTML' })
    return msg.message_id
  } catch (e) {
    console.error(e)
    return null
  }
}

async function unpost(ad: Ad) {
  if (!ad.channelMessageId || !ad.channelChatId || !botToken()) return
  const target = { chat_id: ad.channelChatId, message_id: ad.channelMessageId }
  try {
    await botApi('deleteMessage', target)
  } catch {
    // Telegram refuses to delete old messages; mark the post as withdrawn instead.
    const text = `❌ <s>${esc(ad.title)}</s>\nОголошення знято з публікації.`
    await botApi(ad.hasPhoto ? 'editMessageCaption' : 'editMessageText', {
      ...target,
      [ad.hasPhoto ? 'caption' : 'text']: text,
      parse_mode: 'HTML',
    }).catch((e) => console.error(e))
  }
}

// Updates the existing post in place when possible, otherwise reposts.
async function repost(prev: Ad, next: Ad, newPhoto: Uint8Array<ArrayBuffer> | null): Promise<number | null> {
  if (prev.channelMessageId && prev.channelChatId === adsChannel() && botToken()) {
    const target = { chat_id: prev.channelChatId, message_id: prev.channelMessageId }
    try {
      if (newPhoto && prev.hasPhoto) {
        await botApiForm(
          'editMessageMedia',
          photoForm(
            {
              ...Object.fromEntries(Object.entries(target).map(([k, v]) => [k, String(v)])),
              media: JSON.stringify({ type: 'photo', media: 'attach://photo', caption: caption(next), parse_mode: 'HTML' }),
            },
            newPhoto,
          ),
        )
        return prev.channelMessageId
      }
      if (!newPhoto && prev.hasPhoto === next.hasPhoto) {
        await botApi(next.hasPhoto ? 'editMessageCaption' : 'editMessageText', {
          ...target,
          [next.hasPhoto ? 'caption' : 'text']: caption(next),
          parse_mode: 'HTML',
        })
        return prev.channelMessageId
      }
    } catch (e) {
      if (String(e).includes('message is not modified')) return prev.channelMessageId
      console.error(e)
    }
  }
  await unpost(prev)
  return post(next, newPhoto ?? (next.hasPhoto ? await storedPhoto(next.id) : null))
}

function parseInput(d: Partial<AdInput>): AdInput | null {
  const title = String(d.title ?? '').trim().slice(0, AD_LIMITS.title)
  const description = String(d.description ?? '').trim().slice(0, AD_LIMITS.description)
  const rawPrice = d.price == null || (d.price as unknown) === '' ? null : Math.round(Number(d.price))
  const phone = normalizePhone(String(d.phone ?? ''))
  const tgContact = normalizeTg(String(d.tgContact ?? ''))
  if (!title || !description || (!phone && !tgContact)) return null
  if (rawPrice != null && !(rawPrice >= 0 && rawPrice <= AD_LIMITS.price)) return null
  return { title, description, price: rawPrice, phone, tgContact }
}

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
    const input = parseInput(data.ad)
    const photo = decodePhoto(data.photo)
    if (!input || photo === 'invalid') return { ok: false, reason: 'invalid' }

    if (!data.id) {
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
