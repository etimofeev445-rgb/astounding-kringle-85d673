import { createHmac, timingSafeEqual } from 'node:crypto'

// Server-only helpers for the Telegram Bot API. Secrets come from env vars:
// TELEGRAM_BOT_TOKEN, TELEGRAM_PROVIDER_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ADMIN_CHAT_ID.

export const botToken = () => process.env.TELEGRAM_BOT_TOKEN ?? ''
export const providerToken = () => process.env.TELEGRAM_PROVIDER_TOKEN ?? ''
export const webhookSecret = () => process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
export const adminChatId = () => process.env.TELEGRAM_ADMIN_CHAT_ID ?? ''
// Channel where classified ads are published; the bot must be an admin there.
export const adsChannel = () => process.env.TELEGRAM_ADS_CHANNEL || '@UATmarket'
// Channel that holds the business catalog feed (defaults to the ads channel); the bot must be an admin there.
export const catalogChannel = () => process.env.TELEGRAM_CATALOG_CHANNEL || adsChannel()
// Optional direct Mini App link (https://t.me/<bot>/<app>) for "open in app" links under channel posts.
export const miniAppUrl = () => process.env.TELEGRAM_MINIAPP_URL ?? ''

export async function botApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  return call<T>(method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Multipart variant for uploading files (sendPhoto, editMessageMedia).
export async function botApiForm<T = unknown>(method: string, form: FormData): Promise<T> {
  return call<T>(method, { method: 'POST', body: form })
}

async function call<T>(method: string, init: RequestInit): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, init)
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null
  if (!data?.ok) throw new Error(`Telegram ${method}: ${data?.description ?? res.status}`)
  return data.result as T
}

export async function sendMessage(chatId: string | number, text: string) {
  if (!chatId) return
  try {
    await botApi('sendMessage', { chat_id: chatId, text })
  } catch (e) {
    console.error(e)
  }
}

const MAX_AGE_SEC = 24 * 60 * 60

// Verifies Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
// and returns the Telegram user id, or null if the signature is invalid or stale.
export function verifyInitData(initData: string): string | null {
  return verifyInitUser(initData)?.id ?? null
}

// Same check, also returning the signed @username (without "@", may be empty).
export function verifyInitUser(initData: string): { id: string; username: string } | null {
  const token = botToken()
  if (!token || !initData) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const expected = createHmac('sha256', secret).update(dataCheck).digest()
  const given = Buffer.from(hash, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null
  try {
    const user = JSON.parse(params.get('user') ?? '{}') as { id?: number; username?: string }
    return user.id ? { id: String(user.id), username: user.username ?? '' } : null
  } catch {
    return null
  }
}
