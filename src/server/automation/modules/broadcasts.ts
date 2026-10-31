import { and, eq, lte } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { broadcasts } from '../../../../db/schema.js'
import { countRecipients, sendNextBatch } from '../../broadcasting'
import { num, timeLeft, type Runner } from './types'

// "Керування розсилками": starts planned mailings when their time comes and keeps sending started
// ones in batches. Only mailings the admin created and confirmed exist in the table to begin with.
export const broadcastsRunner: Runner = async (ctx) => {
  const maxPerRun = num(ctx.settings.maxPerRun, 300)
  const due = await db
    .select()
    .from(broadcasts)
    .where(and(eq(broadcasts.status, 'scheduled'), lte(broadcasts.scheduledAt, new Date())))
  let started = 0
  for (const b of due) {
    const total = await countRecipients(b.audience)
    const [row] = await db
      .update(broadcasts)
      .set({ status: 'sending', total })
      .where(and(eq(broadcasts.id, b.id), eq(broadcasts.status, 'scheduled')))
      .returning()
    if (row) {
      started++
      await ctx.event('info', 'broadcast.started', `Запланована розсилка стартувала: ${total} одержувачів`, { subject: b.id })
    }
  }

  let processed = 0
  let finished = 0
  let waited = 0
  const sending = await db.select().from(broadcasts).where(eq(broadcasts.status, 'sending'))
  for (let b of sending) {
    while (b.status === 'sending' && processed < maxPerRun && timeLeft(ctx)) {
      const before = b.sent + b.failed
      const r = await sendNextBatch(b)
      b = r.broadcast
      processed += b.sent + b.failed - before
      if (r.finished) {
        finished++
        await ctx.event('info', 'broadcast.done', `Розсилку завершено: доставлено ${b.sent}, не доставлено ${b.failed}`, { subject: b.id })
      }
      // Telegram flood limit: stop here, the next run continues from the saved cursor.
      if (r.retryAfter) {
        waited = r.retryAfter
        break
      }
      await ctx.heartbeat(undefined, `Надіслано ${processed}`)
    }
    if (waited || processed >= maxPerRun || !timeLeft(ctx)) break
  }
  return {
    done: true,
    summary: `Стартувало ${started}, надіслано ${processed} повідомлень, завершено ${finished}${waited ? ` (ліміт Telegram, пауза ${waited} с)` : ''}`,
    result: { started, processed, finished },
  }
}
