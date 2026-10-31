import type { places } from '../../db/schema.js'
import { category, placeLocation } from '../lib/places'
import { storedPlacePhoto } from './placePhotos'
import { botApi, botApiForm, botToken, catalogChannel, miniAppUrl } from './telegramBot'

// Server-only: mirrors catalog cards to the Telegram catalog channel via the Bot API.
// A card is one post: a text message, a photo (cover or logo) or an album (cover + logo)
// whose first message carries the caption. The bot token never leaves the server.

type Place = typeof places.$inferSelect
type Bytes = Uint8Array<ArrayBuffer>
type Slot = 'cover' | 'photo'
export type NewImages = Partial<Record<Slot, Bytes>>
export type ChannelPost = { chatId: string; ids: number[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// What Telegram counts against the caption limit: text without HTML tags/entities.
const visibleLength = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot);/g, '_').length
const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…`)

// Images of a card in post order: the cover leads (it carries the caption), the logo follows.
const slots = (p: Place): Slot[] => [...(p.hasCover ? ['cover' as const] : []), ...(p.hasPhoto ? ['photo' as const] : [])]

function build(p: Place, description: string, price: string) {
  const c = category(p.category)
  const tag = c.label.uk.split(' ')[0].toLowerCase()
  const tg = p.tgContact.startsWith('@') ? p.tgContact : ''
  const location = placeLocation(p)
  const app = miniAppUrl() ? `${miniAppUrl()}?startapp=store_${p.storeKey}` : ''
  return [
    `🏪 <b>${esc(p.title)}</b>`,
    `${c.emoji} ${esc(c.label.uk)} · #${esc(tag)}`,
    location ? `📍 <b>Локація:</b> ${esc(location)}` : null,
    '',
    esc(description),
    p.hours ? `\n🕒 <b>Графік:</b> ${esc(p.hours)}` : null,
    price ? `\n💰 <b>Прайс / послуги:</b>\n${esc(price)}` : null,
    '',
    p.phone ? `📞 ${esc(p.phone)}` : null,
    p.instagram ? `📱 <a href="https://instagram.com/${esc(p.instagram)}">Instagram @${esc(p.instagram)}</a>` : null,
    tg ? `✈️ ${esc(tg)}` : null,
    p.mapUrl ? `🗺 <a href="${esc(p.mapUrl)}">Відкрити на мапі</a>` : null,
    app ? `\n👉 <a href="${esc(app)}">Відкрити в UAT Market</a>` : null,
  ]
    .filter((l) => l != null)
    .join('\n')
}

// Photo captions are capped at 1024 chars, text posts at 4096: long description/price get shortened.
export function caption(p: Place, limit = slots(p).length ? 1024 : 4096) {
  let description = p.description
  let price = p.price
  let text = build(p, description, price)
  while (visibleLength(text) > limit && (description.length > 40 || price.length > 0)) {
    const excess = visibleLength(text) - limit + 1
    if (price.length >= description.length || description.length <= 40) price = price.length > excess + 20 ? cut(price, price.length - excess) : ''
    else description = cut(description, Math.max(40, description.length - excess))
    text = build(p, description, price)
  }
  return text
}

const formOf = (fields: Record<string, string | number>, files: [string, Bytes][]) => {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v))
  for (const [name, bytes] of files) form.append(name, new Blob([bytes], { type: 'image/jpeg' }), `${name}.jpg`)
  return form
}

const loadImages = async (p: Place, fresh: NewImages) =>
  Promise.all(
    slots(p).map(async (s): Promise<[Slot, Bytes]> => {
      const bytes = fresh[s] ?? (await storedPlacePhoto(p.id, s))
      if (!bytes) throw new Error(`Missing ${s} image for place ${p.id}`)
      return [s, bytes]
    }),
  )

// Publishes a fresh post. Throws if Telegram refuses (bot isn't an admin of the channel, etc.).
export async function publish(p: Place, fresh: NewImages = {}): Promise<ChannelPost> {
  if (!botToken()) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const chatId = catalogChannel()
  const images = await loadImages(p, fresh)
  const text = caption(p)
  if (images.length === 0) {
    const msg = await botApi<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    })
    return { chatId, ids: [msg.message_id] }
  }
  if (images.length === 1) {
    const msg = await botApiForm<{ message_id: number }>(
      'sendPhoto',
      formOf({ chat_id: chatId, caption: text, parse_mode: 'HTML', photo: `attach://${images[0][0]}` }, images),
    )
    return { chatId, ids: [msg.message_id] }
  }
  const media = images.map(([s], i) => ({
    type: 'photo',
    media: `attach://${s}`,
    ...(i === 0 ? { caption: text, parse_mode: 'HTML' } : {}),
  }))
  const msgs = await botApiForm<{ message_id: number }[]>(
    'sendMediaGroup',
    formOf({ chat_id: chatId, media: JSON.stringify(media) }, images),
  )
  return { chatId, ids: msgs.map((m) => m.message_id) }
}

// Removes the post; Telegram refuses to delete messages older than 48h, so those get marked as withdrawn.
export async function withdraw(p: Place, note = 'Картку видалено автором.') {
  if (!p.channelChatId || p.channelMessageIds.length === 0 || !botToken()) return
  try {
    await botApi('deleteMessages', { chat_id: p.channelChatId, message_ids: p.channelMessageIds })
  } catch {
    const media = p.hasCover || p.hasPhoto
    await botApi(media ? 'editMessageCaption' : 'editMessageText', {
      chat_id: p.channelChatId,
      message_id: p.channelMessageIds[0],
      [media ? 'caption' : 'text']: `❌ <s>${esc(p.title)}</s>\n${esc(note)}`,
      parse_mode: 'HTML',
    }).catch((e) => console.error('Withdraw post error:', e))
  }
}

// Brings the post in line with the edited card: edits it in place when the set of images is the
// same, otherwise replaces it with a new post. Returns null if the channel can't be reached.
export async function sync(prev: Place, next: Place, fresh: NewImages): Promise<ChannelPost | null> {
  const layout = slots(next)
  const sameLayout = slots(prev).join() === layout.join()
  if (sameLayout && prev.channelChatId === catalogChannel() && prev.channelMessageIds.length === Math.max(1, layout.length) && botToken()) {
    const chat_id = prev.channelChatId
    const ids = prev.channelMessageIds
    const text = caption(next)
    try {
      let captioned = false
      for (const [i, s] of layout.entries()) {
        const bytes = fresh[s]
        if (!bytes) continue
        const media = { type: 'photo', media: `attach://${s}`, ...(i === 0 ? { caption: text, parse_mode: 'HTML' } : {}) }
        await botApiForm('editMessageMedia', formOf({ chat_id, message_id: ids[i], media: JSON.stringify(media) }, [[s, bytes]]))
        if (i === 0) captioned = true
      }
      if (!captioned) {
        await botApi(layout.length ? 'editMessageCaption' : 'editMessageText', {
          chat_id,
          message_id: ids[0],
          [layout.length ? 'caption' : 'text']: text,
          parse_mode: 'HTML',
          ...(layout.length ? {} : { link_preview_options: { is_disabled: true } }),
        }).catch((e) => {
          if (!String(e).includes('message is not modified')) throw e
        })
      }
      return { chatId: chat_id, ids }
    } catch (e) {
      console.error('Edit post error, reposting:', e)
    }
  }
  await withdraw(prev)
  try {
    return await publish(next, fresh)
  } catch (e) {
    console.error('Repost error:', e)
    return null
  }
}

export function postUrl(p: Pick<Place, 'channelChatId' | 'channelMessageIds'>) {
  const id = p.channelMessageIds[0]
  if (!id || !p.channelChatId) return null
  if (p.channelChatId.startsWith('@')) return `https://t.me/${p.channelChatId.slice(1)}/${id}`
  // Private channel (-100…): the link works for channel members.
  if (p.channelChatId.startsWith('-100')) return `https://t.me/c/${p.channelChatId.slice(4)}/${id}`
  return null
}
