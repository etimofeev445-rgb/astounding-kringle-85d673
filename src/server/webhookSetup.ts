import { botApi, webhookSecret } from './telegramBot'

// Server-only: registers /api/telegram/webhook with Telegram. Telegram then sends the secret back in
// the X-Telegram-Bot-Api-Secret-Token header of every update.
export async function setupWebhook(origin: string) {
  const url = `${origin}/api/telegram/webhook`
  await botApi('setWebhook', {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'pre_checkout_query'],
  })
  return url
}

export interface WebhookInfo {
  url: string
  pendingUpdateCount: number
  lastErrorDate: string | null
  lastErrorMessage: string
}

export async function webhookInfo(): Promise<WebhookInfo> {
  const info = await botApi<{ url: string; pending_update_count: number; last_error_date?: number; last_error_message?: string }>(
    'getWebhookInfo',
    {},
  )
  return {
    url: info.url,
    pendingUpdateCount: info.pending_update_count,
    lastErrorDate: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
    lastErrorMessage: info.last_error_message ?? '',
  }
}
