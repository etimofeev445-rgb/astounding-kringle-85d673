import { getStore } from '@netlify/blobs'
import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { appSettings, broadcasts, documents, users } from '../../../db/schema.js'
import { isHttpsUrl, sanitizeConfig } from '../../lib/appConfig'
import { loadConfig } from '../appState'
import { TelegramError, botApi } from '../telegramBot'
import { InputError, int, isUuid, iso, log, obj, str, type Admin } from './util'

// ── App configuration (home page, menu, settings) ────────────────────────────────────────────

export const getConfig = () => loadConfig()

export async function saveConfig(admin: Admin, p: unknown) {
  const before = await loadConfig()
  const next = sanitizeConfig(obj(p).config)
  await db
    .insert(appSettings)
    .values({ key: 'config', value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  // Log which top-level areas changed, e.g. ["home", "features"].
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(before[k]))
  await log(admin, 'settings.update', 'settings', String(obj(p).area ?? ''), { changed })
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

function message(o: { text: string; buttonText: string; buttonUrl: string }) {
  return {
    text: o.text,
    link_preview_options: { is_disabled: true },
    ...(o.buttonText && o.buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: o.buttonText, url: o.buttonUrl }]] } } : {}),
  }
}

function parseMessage(p: unknown) {
  const o = obj(p)
  const text = str(o.text, 4000)
  const buttonText = str(o.buttonText, 40)
  const buttonUrl = str(o.buttonUrl, 500)
  if (!text) throw new InputError('Введіть текст повідомлення')
  if (buttonText && !isHttpsUrl(buttonUrl)) throw new InputError('Посилання кнопки має починатися з https://')
  return { text, buttonText: buttonUrl ? buttonText : '', buttonUrl: buttonText ? buttonUrl : '' }
}

const recipients = () => eq(users.blocked, false)

const broadcastView = (b: typeof broadcasts.$inferSelect) => ({
  id: b.id,
  text: b.text,
  buttonText: b.buttonText,
  buttonUrl: b.buttonUrl,
  status: b.status,
  total: b.total,
  sent: b.sent,
  failed: b.failed,
  createdAt: b.createdAt.toISOString(),
  finishedAt: iso(b.finishedAt),
})

export async function listBroadcasts() {
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt)).limit(30),
    db.select({ n: count() }).from(users).where(recipients()),
  ])
  return { items: rows.map(broadcastView), audience: n }
}

// Sends the message to the admin's own chat so it can be checked in Telegram before the mailing.
export async function testBroadcast(admin: Admin, p: unknown) {
  const msg = parseMessage(p)
  try {
    await botApi('sendMessage', { chat_id: admin.id, ...message(msg) })
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

// Creating the mailing is the confirmed step; batches are then pulled by sendBroadcastBatch.
export async function createBroadcast(admin: Admin, p: unknown) {
  const msg = parseMessage(p)
  if (obj(p).confirm !== true) throw new InputError('Потрібне підтвердження розсилки')
  const [{ n }] = await db.select({ n: count() }).from(users).where(recipients())
  const [row] = await db
    .insert(broadcasts)
    .values({ ...msg, status: 'sending', total: n, createdBy: admin.id })
    .returning()
  await log(admin, 'broadcast.create', 'broadcast', row.id, { total: n, text: msg.text.slice(0, 200) })
  return broadcastView(row)
}

const BATCH = 20

// Sends the next batch. The batch is claimed by moving the cursor first (compare-and-set), so two
// open panels can't send the same messages twice.
export async function sendBroadcastBatch(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [b] = await db.select().from(broadcasts).where(eq(broadcasts.id, id))
  if (!b) throw new InputError('Розсилку не знайдено')
  if (b.status !== 'sending') return { broadcast: broadcastView(b), retryAfter: 0 }

  const batch = await db
    .select({ id: users.telegramUserId })
    .from(users)
    .where(and(recipients(), gt(users.telegramUserId, b.cursor)))
    .orderBy(asc(users.telegramUserId))
    .limit(BATCH)

  if (!batch.length) {
    const [done] = await db
      .update(broadcasts)
      .set({ status: 'done', finishedAt: new Date() })
      .where(and(eq(broadcasts.id, b.id), eq(broadcasts.status, 'sending')))
      .returning()
    if (done) await log(admin, 'broadcast.done', 'broadcast', b.id, { sent: done.sent, failed: done.failed })
    return { broadcast: broadcastView(done ?? b), retryAfter: 0 }
  }

  const [claimed] = await db
    .update(broadcasts)
    .set({ cursor: batch[batch.length - 1].id })
    .where(and(eq(broadcasts.id, b.id), eq(broadcasts.cursor, b.cursor), eq(broadcasts.status, 'sending')))
    .returning()
  if (!claimed) {
    const [now] = await db.select().from(broadcasts).where(eq(broadcasts.id, b.id))
    return { broadcast: broadcastView(now), retryAfter: 1 }
  }

  const payload = message(b)
  let sent = 0
  let failed = 0
  let retryAfter = 0
  for (const [i, u] of batch.entries()) {
    try {
      await botApi('sendMessage', { chat_id: u.id, ...payload })
      sent++
    } catch (e) {
      if (e instanceof TelegramError && e.code === 429) {
        // Flood limit: hand the unsent rest of the batch back by rewinding the cursor.
        retryAfter = Number(/retry after (\d+)/i.exec(e.message)?.[1] ?? 5)
        await db
          .update(broadcasts)
          .set({ cursor: i === 0 ? b.cursor : batch[i - 1].id })
          .where(eq(broadcasts.id, b.id))
        break
      }
      // 403 = the user never started the bot or blocked it; 400 = chat not found.
      failed++
    }
  }
  const [row] = await db
    .update(broadcasts)
    .set({ sent: sql`${broadcasts.sent} + ${sent}`, failed: sql`${broadcasts.failed} + ${failed}` })
    .where(eq(broadcasts.id, b.id))
    .returning()
  return { broadcast: broadcastView(row), retryAfter }
}

export async function stopBroadcast(admin: Admin, p: unknown) {
  const id = obj(p).id
  if (!isUuid(id)) throw new InputError('Невірний ID')
  const [row] = await db
    .update(broadcasts)
    .set({ status: 'done', finishedAt: new Date() })
    .where(and(eq(broadcasts.id, id), eq(broadcasts.status, 'sending')))
    .returning()
  if (row) await log(admin, 'broadcast.stop', 'broadcast', id, { sent: row.sent, failed: row.failed })
  return { ok: true }
}
