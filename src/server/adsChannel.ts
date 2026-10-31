import type { ads } from '../../db/schema.js'
import { AD_LIMITS, normalizePhone, normalizeTg, type AdInput, type AdView } from '../lib/ads'
import { storedPhoto } from './adPhotos'
import { adsChannel, botApi, botApiForm, botToken } from './telegramBot'

// Server-only: ad view/parsing and the Telegram channel post of an ad. Kept out of ads.ts because
// that file is also imported by the client (server function stubs), which must not reach the Bot API code.

type Ad = typeof ads.$inferSelect

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const priceText = (p: number | null) => (p == null ? 'Договірна' : `${p.toLocaleString('uk-UA')} ₴`)

export function caption(ad: Ad) {
  const lines = [`📢 <b>${esc(ad.title)}</b>`, '', esc(ad.description), '', `💰 <b>${priceText(ad.price)}</b>`]
  if (ad.phone) lines.push(`📞 ${esc(ad.phone)}`)
  if (ad.tgContact) lines.push(`✈️ ${ad.tgContact.startsWith('@') ? ad.tgContact : `Telegram ID ${ad.tgContact}`}`)
  return lines.join('\n')
}

export function postUrl(ad: Ad) {
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

export const photoForm = (fields: Record<string, string>, photo: Uint8Array<ArrayBuffer>) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'photo.jpg')
  return form
}

// Posts a fresh channel message; returns its id, or null if the channel isn't reachable.
export async function post(ad: Ad, photo: Uint8Array<ArrayBuffer> | null): Promise<number | null> {
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

export async function unpost(ad: Ad, note = 'Оголошення знято з публікації.') {
  if (!ad.channelMessageId || !ad.channelChatId || !botToken()) return
  const target = { chat_id: ad.channelChatId, message_id: ad.channelMessageId }
  try {
    await botApi('deleteMessage', target)
  } catch {
    // Telegram refuses to delete old messages; mark the post as withdrawn instead.
    const text = `❌ <s>${esc(ad.title)}</s>\n${esc(note)}`
    await botApi(ad.hasPhoto ? 'editMessageCaption' : 'editMessageText', {
      ...target,
      [ad.hasPhoto ? 'caption' : 'text']: text,
      parse_mode: 'HTML',
    }).catch((e) => console.error(e))
  }
}

// Updates the existing post in place when possible, otherwise reposts.
export async function repost(prev: Ad, next: Ad, newPhoto: Uint8Array<ArrayBuffer> | null): Promise<number | null> {
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

export function parseAdInput(d: Partial<AdInput>): AdInput | null {
  const title = String(d.title ?? '').trim().slice(0, AD_LIMITS.title)
  const description = String(d.description ?? '').trim().slice(0, AD_LIMITS.description)
  const rawPrice = d.price == null || (d.price as unknown) === '' ? null : Math.round(Number(d.price))
  const phone = normalizePhone(String(d.phone ?? ''))
  const tgContact = normalizeTg(String(d.tgContact ?? ''))
  if (!title || !description || (!phone && !tgContact)) return null
  if (rawPrice != null && !(rawPrice >= 0 && rawPrice <= AD_LIMITS.price)) return null
  return { title, description, price: rawPrice, phone, tgContact }
}

