import { createFileRoute } from '@tanstack/react-router'
import { botToken, safeEqual, webhookSecret } from '../../../server/telegramBot'
import { setupWebhook } from '../../../server/webhookSetup'

// Points the bot's webhook at this site. The easiest way is the button in the admin panel
// (Налаштування → Telegram webhook). From a terminal:
//   curl -X POST -H "Authorization: Bearer <TELEGRAM_WEBHOOK_SECRET>" https://<site>/api/telegram/setup
// The secret travels in a header only — URLs end up in logs and browser history.
export const Route = createFileRoute('/api/telegram/setup')({
  server: {
    handlers: {
      GET: async () => new Response('Use POST with an Authorization header, or the admin panel.', { status: 405 }),
      POST: async ({ request }) => {
        const secret = webhookSecret()
        if (!botToken() || !secret) return new Response('TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET not set', { status: 500 })
        const auth = request.headers.get('authorization') ?? ''
        if (!safeEqual(auth, `Bearer ${secret}`)) return new Response('Forbidden', { status: 403 })
        try {
          const url = await setupWebhook(new URL(request.url).origin)
          return new Response(`Webhook set to ${url}`)
        } catch (e) {
          return new Response(e instanceof Error ? e.message : String(e), { status: 502 })
        }
      },
    },
  },
})
