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

export class TelegramError extends Error {
  constructor(
    method: string,
    message: string,
    readonly code: number,
  ) {
    super(`Telegram ${method}: ${message}`)
  }
}

async function call<T>(method: string, init: RequestInit): Promise<T> {
  if (!botToken()) throw new TelegramError(method, 'TELEGRAM_BOT_TOKEN is not set', 0)
  let res: Response
  try {
    // Bounded so a hung Bot API request can't eat the whole function time budget.
    res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    // Network errors carry the request URL (with the token) in some runtimes; never surface it.
    throw new TelegramError(method, e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network error', 0)
  }
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string; error_code?: number } | null
  if (!data?.ok) throw new TelegramError(method, data?.description ?? `HTTP ${res.status}`, data?.error_code ?? res.status)
  return data.result as T
}

// Best-effort notification: returns whether Telegram accepted it, never throws.
export async function sendMessage(chatId: string | number, text: string): Promise<boolean> {
  if (!chatId) return false
  try {
    await botApi('sendMessage', { chat_id: chatId, text })
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

// Constant-time string comparison for shared secrets.
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const MAX_AGE_SEC = 24 * 60 * 60

export interface InitUser {
  id: string
  username: string
  firstName: string
  lastName: string
  languageCode: string
}

// Verifies Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
// and returns the Telegram user id, or null if the signature is invalid or stale.
export function verifyInitData(initData: string): string | null {
  return verifyInitUser(initData)?.id ?? null
}

// Same check, also returning the signed profile fields (@username without "@", may be empty).
export function verifyInitUser(initData: string, maxAgeSec = MAX_AGE_SEC): InitUser | null {
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
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null
  try {
    const user = JSON.parse(params.get('user') ?? '{}') as {
      id?: number
      username?: string
      first_name?: string
      last_name?: string
      language_code?: string
    }
    return user.id
      ? {
          id: String(user.id),
          username: user.username ?? '',
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          languageCode: user.language_code ?? '',
        }
      : null
  } catch {
    return null
  }
}
