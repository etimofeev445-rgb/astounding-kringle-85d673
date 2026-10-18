import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { topupOrders } from '../../db/schema.js'
import { OPERATORS, TOPUP_MAX, TOPUP_MIN, formatLocal, type OperatorId } from '../data/operators'
import { botApi, botToken, providerToken, verifyInitData } from './telegramBot'

export type InvoiceResult =
  | { ok: true; link: string; orderId: string }
  | { ok: false; reason: 'not_configured' | 'unauthorized' | 'invalid' | 'error'; message?: string }

// Creates a pending order and a Telegram Payments invoice link for it.
// The Mini App opens the link with WebApp.openInvoice.
export const createTopupInvoice = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; operator: string; phone: string; amount: number }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    operator: String(d.operator) as OperatorId,
    phone: String(d.phone).replace(/\D/g, ''),
    amount: Number(d.amount),
  }))
  .handler(async ({ data }): Promise<InvoiceResult> => {
    if (!botToken() || !providerToken()) return { ok: false, reason: 'not_configured' }

    const userId = verifyInitData(data.initData)
    if (!userId) return { ok: false, reason: 'unauthorized' }

    const op = OPERATORS.find((o) => o.id === data.operator)
    const amountKop = Math.round(data.amount * 100)
    if (
      !op ||
      data.phone.length !== 9 ||
      !op.codes.includes(data.phone.slice(0, 2)) ||
      !(amountKop >= TOPUP_MIN * 100 && amountKop <= TOPUP_MAX * 100)
    ) {
      return { ok: false, reason: 'invalid' }
    }

    const [order] = await db
      .insert(topupOrders)
      .values({ telegramUserId: userId, operator: op.id, phone: data.phone, amountKop })
      .returning()

    try {
      const label = `${op.name} +380 ${formatLocal(data.phone)}`
      const link = await botApi<string>('createInvoiceLink', {
        title: 'Поповнення мобільного',
        description: `${label} — ${data.amount} ₴`,
        payload: order.id,
        provider_token: providerToken(),
        currency: 'UAH',
        prices: [{ label, amount: amountKop }],
      })
      return { ok: true, link, orderId: order.id }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(message)
      await db.update(topupOrders).set({ status: 'failed', error: message, updatedAt: new Date() }).where(eq(topupOrders.id, order.id))
      return { ok: false, reason: 'error' }
    }
  })
