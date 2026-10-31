import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { topupOrders } from '../../../../db/schema.js'
import { OPERATORS, formatLocal } from '../../../data/operators'
import { fulfillTopup } from '../../../server/aggregator'
import { recordError, recordEvent } from '../../../server/automation/store'
import { adminChatId, botApi, safeEqual, sendMessage, webhookSecret } from '../../../server/telegramBot'

interface Update {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string }
  message?: {
    chat: { id: number }
    text?: string
    successful_payment?: {
      currency: string
      total_amount: number
      invoice_payload: string
      telegram_payment_charge_id: string
      provider_payment_charge_id: string
    }
  }
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

async function findOrder(id: string) {
  if (!isUuid(id)) return undefined
  const [order] = await db.select().from(topupOrders).where(eq(topupOrders.id, id))
  return order
}

// Telegram must get an answer within 10 seconds, so this only checks the order still matches.
async function onPreCheckout(q: NonNullable<Update['pre_checkout_query']>) {
  const order = await findOrder(q.invoice_payload)
  const ok = !!order && order.status === 'pending' && q.currency === 'UAH' && q.total_amount === order.amountKop
  await botApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: q.id,
    ok,
    ...(ok ? {} : { error_message: 'Замовлення застаріло. Спробуйте ще раз.' }),
  })
}

type Payment = NonNullable<NonNullable<Update['message']>['successful_payment']>

const describe = (order: typeof topupOrders.$inferSelect) => {
  const op = OPERATORS.find((o) => o.id === order.operator)
  return `${op?.name ?? order.operator} +380 ${formatLocal(order.phone)} — ${order.amountKop / 100} ₴`
}

// Step 1 (must not be lost): record the payment. Throws on DB errors so the webhook answers 500
// and Telegram redelivers the update; a redelivered update is recognised by its charge id.
async function recordPayment(chatId: number, p: Payment) {
  if (!isUuid(p.invoice_payload)) {
    await sendMessage(adminChatId(), `⚠️ Оплата з невідомим замовленням\nPayload: ${p.invoice_payload}\nPayment: ${p.provider_payment_charge_id}`)
    return null
  }
  const [order] = await db
    .update(topupOrders)
    .set({
      status: 'paid',
      telegramChargeId: p.telegram_payment_charge_id,
      providerChargeId: p.provider_payment_charge_id,
      updatedAt: new Date(),
    })
    .where(and(eq(topupOrders.id, p.invoice_payload), eq(topupOrders.status, 'pending')))
    .returning()
    // Unique charge id: the same payment can never be attached to a second order.
    .catch(async (e) => {
      if ((await findByCharge(p.telegram_payment_charge_id))) return []
      throw e
    })
  if (order) {
    if (p.currency !== 'UAH' || p.total_amount !== order.amountKop) {
      // Pre-checkout already checks this; if it ever differs, don't top up automatically.
      await db.update(topupOrders).set({ status: 'failed', error: 'amount mismatch', updatedAt: new Date() }).where(eq(topupOrders.id, order.id))
      await sendMessage(
        adminChatId(),
        `⚠️ Сума оплати не збігається із замовленням — перевірте вручну\n${describe(order)}\nОплачено: ${p.total_amount / 100} ${p.currency}\nЗамовлення ${order.id}\nPayment: ${p.provider_payment_charge_id}`,
      )
      await sendMessage(chatId, '✅ Оплату отримано. Ми перевіримо замовлення і звʼяжемося з вами.')
      return null
    }
    return order
  }

  // Not pending any more: either Telegram redelivered this update (same charge, nothing to do)
  // or the customer paid an order that was already paid/closed — that money must be refunded.
  if (await findByCharge(p.telegram_payment_charge_id)) return null
  const existing = await findOrder(p.invoice_payload)
  await sendMessage(
    adminChatId(),
    `⚠️ Повторна оплата замовлення — потрібне повернення коштів\n${existing ? describe(existing) : p.invoice_payload}\nСтатус: ${existing?.status ?? 'не знайдено'}\nСума: ${p.total_amount / 100} ${p.currency}\nPayment: ${p.provider_payment_charge_id}\nTelegram charge: ${p.telegram_payment_charge_id}`,
  )
  await sendMessage(chatId, '✅ Оплату отримано. Ми перевіримо замовлення і звʼяжемося з вами.')
  return null
}

async function findByCharge(chargeId: string) {
  const [row] = await db.select({ id: topupOrders.id }).from(topupOrders).where(eq(topupOrders.telegramChargeId, chargeId))
  return row
}

// Step 2: credit the number. The order is claimed (paid → processing) first, so concurrent or
// repeated processing can never send the same order to the aggregator twice.
async function fulfill(chatId: number, paid: typeof topupOrders.$inferSelect, p: Payment) {
  const [order] = await db
    .update(topupOrders)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(and(eq(topupOrders.id, paid.id), eq(topupOrders.status, 'paid')))
    .returning()
  if (!order) return

  const summary = describe(order)
  const result = await fulfillTopup(order)

  if (result.ok) {
    await db
      .update(topupOrders)
      .set({ status: 'fulfilled', aggregatorRef: result.ref, error: null, updatedAt: new Date() })
      .where(eq(topupOrders.id, order.id))
    await sendMessage(chatId, `✅ Рахунок поповнено: ${summary}`)
    await sendMessage(adminChatId(), `✅ Поповнення виконано\n${summary}\nЗамовлення ${order.id}`)
  } else if (result.manual) {
    // Back to "paid": waiting for the admin to top up by hand (and mark it done in the admin panel).
    await db.update(topupOrders).set({ status: 'paid', updatedAt: new Date() }).where(eq(topupOrders.id, order.id))
    await sendMessage(chatId, `✅ Оплату отримано: ${summary}. Поповнення буде зараховано найближчим часом.`)
    await sendMessage(adminChatId(), `💰 Нова оплата — поповніть вручну\n${summary}\nЗамовлення ${order.id}`)
  } else {
    await db
      .update(topupOrders)
      .set({ status: 'failed', error: result.error, updatedAt: new Date() })
      .where(eq(topupOrders.id, order.id))
    await sendMessage(chatId, `⚠️ Оплату отримано, але поповнення не пройшло. Ми повернемо кошти або повторимо поповнення.`)
    await sendMessage(
      adminChatId(),
      `⚠️ Помилка поповнення — потрібне повторення або повернення\n${summary}\nЗамовлення ${order.id}\nПомилка: ${result.error}${
        result.uncertain ? '\n❗ Результат невідомий: перевірте у агрегатора, чи поповнення не пройшло, перш ніж повторювати.' : ''
      }\nPayment: ${p.provider_payment_charge_id}`,
    )
  }
}

export const Route = createFileRoute('/api/telegram/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = webhookSecret()
        // Telegram sends the secret in a header (set via setWebhook secret_token), never in the URL.
        if (!secret || !safeEqual(request.headers.get('x-telegram-bot-api-secret-token') ?? '', secret)) {
          if (secret) await recordEvent('security', 'warn', 'security.webhook_secret', 'Запит до Telegram webhook з невірним секретом')
          return new Response('Forbidden', { status: 403 })
        }
        const update = (await request.json().catch(() => ({}))) as Update
        const msg = update.message
        if (msg?.successful_payment) {
          let order: Awaited<ReturnType<typeof recordPayment>>
          try {
            order = await recordPayment(msg.chat.id, msg.successful_payment)
          } catch (e) {
            // The payment isn't stored yet: a non-2xx makes Telegram retry this update later.
            console.error('Record payment error:', e)
            await recordError('webhook.recordPayment', e)
            return new Response('retry', { status: 500 })
          }
          try {
            if (order) await fulfill(msg.chat.id, order, msg.successful_payment)
          } catch (e) {
            // Payment is safely recorded; the order stays paid/processing for the admin to finish.
            console.error('Fulfill error:', e)
            await recordError('webhook.fulfill', e)
            await sendMessage(adminChatId(), `⚠️ Оплачене замовлення ${order?.id} не оброблено автоматично — перевірте в адмін-панелі.`)
          }
          return new Response('ok')
        }
        try {
          if (update.pre_checkout_query) await onPreCheckout(update.pre_checkout_query)
          // Helper so the owner can find the chat id for TELEGRAM_ADMIN_CHAT_ID.
          if (msg?.text === '/myid') await sendMessage(msg.chat.id, `Ваш chat ID: ${msg.chat.id}`)
          else if (msg?.text?.startsWith('/start'))
            await sendMessage(msg.chat.id, 'Відкрийте UAT Market кнопкою меню внизу 👇')
        } catch (e) {
          console.error(e)
        }
        // Always 200 so Telegram doesn't redeliver updates we already handled.
        return new Response('ok')
      },
    },
  },
})
