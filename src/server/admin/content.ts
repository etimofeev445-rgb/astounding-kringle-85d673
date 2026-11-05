import { getStore } from '@netlify/blobs'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { appSettings, broadcasts, documents } from '../../../db/schema.js'
import { isBuiltinMenuId, isHttpsUrl, menuListErrors, sanitizeConfig } from '../../lib/appConfig'
import { isAudience, type BroadcastAudience } from '../../lib/automation'
import { loadConfig } from '../appState'
import { broadcastMessage, countRecipients, sendNextBatch } from '../broadcasting'
import { TelegramError, botApi } from '../telegramBot'
import { InputError, int, isUuid, iso, log, obj, str, type Admin } from './util'

// ── App configuration (home page, menu, settings) ────────────────────────────────────────────

export const getConfig = () => loadConfig()

export async function saveConfig(admin: Admin, p: unknown) {
  const before = await loadConfig()
  // The sanitizer silently drops bad entries; the admin must be told instead of losing them.
  const rawMenu = (obj(p).config as { menu?: { items?: unknown } } | undefined)?.menu?.items
  if (rawMenu !== undefined) {
    const errors = menuListErrors(rawMenu)
    if (errors.length) throw new InputError(`Меню не збережено:\n${errors.slice(0, 4).join('\n')}`)
  }
  const next = sanitizeConfig(obj(p).config)
  await db
    .insert(appSettings)
    .values({ key: 'config', value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  // Log which top-level areas changed, e.g. ["home", "features"].
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]))
  const ids = (c: typeof next) => c.menu.items.filter((i) => !isBuiltinMenuId(i.id)).map((i) => i.id)
  const menuAdded = ids(next).filter((id) => !ids(before).includes(id))
  const menuRemoved = ids(before).filter((id) => !ids(next).includes(id))
  await log(admin, 'settings.update', 'settings', String(obj(p).area ?? ''), {
    changed,
    ...(menuAdded.length || menuRemoved.length ? { menuAdded, menuRemoved } : {}),
  })
  return next
}

// ── Image uploads (logo, banners) → `app-assets` blob store, served by /api/assets/$key ─────────

const assets = () => getStore({ name: 'app-assets', consistency: 'strong' })
const MAX_ASSET_BYTES = 1_500_000

export async function uploadAsset(admin: Admin, p: unknown) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(str(obj(p).dataUrl, 2_100_000))
  if (!m) throw new InputError('Підтримуються JPEG, PNG або WebP')
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw new InputError('Файл завеликий (до 1,5 МБ)')
  const key = crypto.randomUUID()
  await assets().set(key, bytes.buffer, { metadata: { type: m[1] } })
  await log(admin, 'asset.upload', 'asset', key, { type: m[1], bytes: bytes.length })
  return { url: `/api/assets/${key}` }
}

export async function readAsset(key: string) {
  if (!isUuid(key)) return null
  const res = await assets().getWithMetadata(key, { type: 'arrayBuffer' })
  return res ? { bytes: new Uint8Array(res.data), type: String(res.metadata.type ?? 'image/jpeg') } : null
}

// ── Information materials ("Документи") ──────────────────────────────────────────────────────

const docView = (d: typeof documents.$inferSelect) => ({
  id: d.id,
  title: d.title,
  body: d.body,
  url: d.url,
  published: d.published,
  sortOrder: d.sortOrder,
  updatedAt: d.updatedAt.toISOString(),
})

export async function listDocs() {
  const rows = await db.select().from(documents).orderBy(asc(documents.sortOrder), asc(documents.createdAt))
  return { items: rows.map(docView) }
}

export async function saveDoc(admin: Admin, p: unknown) {
  const o = obj(p)
  const url = str(o.url, 500)
  const values = {
    title: str(o.title, 120),
    body: str(o.body, 10_000),
    url: url && isHttpsUrl(url) ? url : '',
    published: o.published !== false,
    sortOrder: int(o.sortOrder, -1000, 1000, 0),
  }
  if (!values.title) throw new InputError('Вкажіть назву')
  if (url && !values.url) throw new InputError('Посилання має починатися з https://')
  if (o.id) {
    if (!isUuid(o.id)) throw new InputError('Невірний ID')
    const [row] = await db.update(documents).set({ ...values, updatedAt: new Date() }).where(eq(documents.id, o.id)).returning()
    if (!row) throw new InputError('Документ не знайдено')
    await log(admin, 'document.edit', 'document', row.id, { title: row.title })
    return docView(row)
  }
  const [row] = await db.insert(documents).values(values).returning()
  await log(admin, 'document.create', 'document', row.id, { title: row.title })
  return docView(row)
}

export async function deleteDoc(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [row] = await db.delete(documents).where(eq(documents.id, id)).returning()
  if (row) await log(admin, 'document.delete', 'document', id, { title: row.title })
  return { ok: !!row }
}

// ── Bot broadcasts ───────────────────────────────────────────────────────────────────────────

function parseMessage(p: unknown) {
  const o = obj(p)
  const text = str(o.text, 4000)
  const buttonText = str(o.buttonText, 40)
  const buttonUrl = str(o.buttonUrl, 500)
  if (!text) throw new InputError('Введіть текст повідомлення')
  if (buttonText && !isHttpsUrl(buttonUrl)) throw new InputError('Посилання кнопки має починатися з https://')
  return { text, buttonText: buttonUrl ? buttonText : '', buttonUrl: buttonText ? buttonUrl : '' }
}

const audienceOf = (v: unknown): BroadcastAudience => (isAudience(v) ? v : 'all')

const broadcastView = (b: typeof broadcasts.$inferSelect) => ({
  id: b.id,
  text: b.text,
  buttonText: b.buttonText,
  buttonUrl: b.buttonUrl,
  status: b.status,
  audience: b.audience,
  scheduledAt: iso(b.scheduledAt),
  total: b.total,
  sent: b.sent,
  failed: b.failed,
  createdAt: b.createdAt.toISOString(),
  finishedAt: iso(b.finishedAt),
})

export async function listBroadcasts() {
  const [rows, audience] = await Promise.all([
    db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(30),
    countRecipients('all'),
  ])
  return { items: rows.map(broadcastView), audience }
}

// Review step before the confirmation: how many users the chosen audience reaches right now.
export async function previewBroadcast(_: Admin, p: unknown) {
  const msg = parseMessage(p)
  const audience = audienceOf(obj(p).audience)
  return { ...msg, audience, recipients: await countRecipients(audience) }
}

// Sends the message to the admin's own chat so it can be checked in Telegram before the mailing.
export async function testBroadcast(admin: Admin, p: unknown) {
  const msg = parseMessage(p)
  try {
    await botApi('sendMessage', { chat_id: admin.id, ...broadcastMessage(msg) })
  } catch (e) {
    throw new InputError(
      e instanceof TelegramError && e.code === 403
        ? 'Бот не може написати вам: відкрийте чат з ботом і натисніть «Start»'
        : `Telegram: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
  await log(admin, 'broadcast.test', 'broadcast', '', { length: msg.text.length })
  return { ok: true }
}

// Creating the mailing is the confirmed step. The server accepts it only with an explicit
// confirmation of the recipient count the admin was shown, and only if that count is still current.
// Immediate mailings are then pulled batch by batch by the panel (sendBroadcastBatch); planned ones
// (scheduledAt) are started by the "broadcasts" automation module.
export async function createBroadcast(admin: Admin, p: unknown) {
  const o = obj(p)
  const msg = parseMessage(p)
  const audience = audienceOf(o.audience)
  if (o.confirm !== true) throw new InputError('Потрібне підтвердження розсилки')
  const n = await countRecipients(audience)
  if (o.recipients !== n) throw new InputError(`Кількість одержувачів змінилася (${n}). Перегляньте розсилку й підтвердьте ще раз.`)
  if (!n) throw new InputError('У вибраній аудиторії немає одержувачів')
  let scheduledAt: Date | null = null
  if (o.scheduledAt) {
    scheduledAt = new Date(String(o.scheduledAt))
    if (Number.isNaN(scheduledAt.getTime())) throw new InputError('Невірний час розсилки')
    if (scheduledAt.getTime() < Date.now() - 60_000) throw new InputError('Час розсилки вже минув')
    if (scheduledAt.getTime() > Date.now() + 90 * 86400_000) throw new InputError('Можна планувати не далі ніж на 90 днів')
  }
  const [row] = await db
    .insert(broadcasts)
    .values({ ...msg, audience, scheduledAt, status: scheduledAt ? 'scheduled' : 'sending', total: n, createdBy: admin.id })
    .returning()
  await log(admin, scheduledAt ? 'broadcast.schedule' : 'broadcast.create', 'broadcast', row.id, {
    total: n,
    audience,
    scheduledAt: iso(scheduledAt),
    text: msg.text.slice(0, 200),
  })
  return broadcastView(row)
}

export async function sendBroadcastBatch(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id))
  if (!b) throw new InputError('Розсилку не знайдено')
  const r = await sendNextBatch(b)
  if (r.finished) await log(admin, 'broadcast.done', 'broadcast', b.id, { sent: r.broadcast.sent, failed: r.broadcast.failed })
  return { broadcast: broadcastView(r.broadcast), retryAfter: r.retryAfter }
}

// Ends a mailing that is being sent, or cancels a planned one before it starts.
export async function stopBroadcast(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [row] = await db
    .update(broadcasts)
    .set({ status: 'done', finishedAt: new Date() })
    .where(and(eq(broadcasts.id, id), inArray(broadcasts.status, ['sending', 'scheduled'])))
    .returning()
  if (row) await log(admin, 'broadcast.stop', 'broadcast', id, { sent: row.sent, failed: row.failed })
  return { ok: true }
}
