import { createFileRoute } from '@tanstack/react-router'
import { botApi, botToken, webhookSecret } from '../../../server/telegramBot'

// One-time setup: open /api/telegram/setup?key=<TELEGRAM_WEBHOOK_SECRET> after deploy
// to point the bot's webhook at this site.
export const Route = createFileRoute('/api/telegram/setup')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const secret = webhookSecret()
        if (!botToken() || !secret) return new Response('TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET not set', { status: 500 })
        if (url.searchParams.get('key') !== secret) return new Response('Forbidden', { status: 403 })
        try {
          await botApi('setWebhook', {
            url: `${url.origin}/api/telegram/webhook`,
            secret_token: secret,
            allowed_updates: ['message', 'pre_checkout_query'],
          })
          return new Response(`Webhook set to ${url.origin}/api/telegram/webhook`)
        } catch (e) {
          return new Response(e instanceof Error ? e.message : String(e), { status: 502 })
        }
      },
    },
  },
})
