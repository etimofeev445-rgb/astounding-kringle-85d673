import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { topupOrders } from '../../../../db/schema.js'
import { OPERATORS, formatLocal } from '../../../data/operators'
import { fulfillTopup } from '../../../server/aggregator'
import { adminChatId, botApi, sendMessage, webhookSecret } from '../../../server/telegramBot'

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

async function onPaid(chatId: number, p: NonNullable<NonNullable<Update['message']>['successful_payment']>) {
  if (!isUuid(p.invoice_payload)) return
  // Conditional update keeps this idempotent if Telegram retries the update.
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
  if (!order) return

  const op = OPERATORS.find((o) => o.id === order.operator)
  const summary = `${op?.name ?? order.operator} +380 ${formatLocal(order.phone)} — ${order.amountKop / 100} ₴`
  const result = await fulfillTopup(order)

  if (result.ok) {
    await db
      .update(topupOrders)
      .set({ status: 'fulfilled', aggregatorRef: result.ref, updatedAt: new Date() })
      .where(eq(topupOrders.id, order.id))
    await sendMessage(chatId, `✅ Рахунок поповнено: ${summary}`)
    await sendMessage(adminChatId(), `✅ Поповнення виконано\n${summary}\nЗамовлення ${order.id}`)
  } else if (result.manual) {
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
      `⚠️ Помилка поповнення — потрібне повторення або повернення\n${summary}\nЗамовлення ${order.id}\nПомилка: ${result.error}\nPayment: ${p.provider_payment_charge_id}`,
    )
  }
}

export const Route = createFileRoute('/api/telegram/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = webhookSecret()
        if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
          return new Response('Forbidden', { status: 403 })
        }
        const update = (await request.json().catch(() => ({}))) as Update
        try {
          if (update.pre_checkout_query) await onPreCheckout(update.pre_checkout_query)
          const msg = update.message
          if (msg?.successful_payment) await onPaid(msg.chat.id, msg.successful_payment)
          // Helper so the owner can find the chat id for TELEGRAM_ADMIN_CHAT_ID.
          else if (msg?.text === '/myid') await sendMessage(msg.chat.id, `Ваш chat ID: ${msg.chat.id}`)
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
