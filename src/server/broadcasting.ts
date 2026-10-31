import { and, asc, count, eq, gt, gte, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { broadcasts, users } from '../../db/schema.js'
import type { BroadcastAudience } from '../lib/automation'
import { TelegramError, botApi } from './telegramBot'

// Server-only: sending bot mailings in batches. Used by the admin panel ("Надіслати всім") and by the
// "broadcasts" automation module (planned mailings).

const DAY = 86400_000

export type Broadcast = typeof broadcasts.$inferSelect

export function broadcastMessage(o: { text: string; buttonText: string; buttonUrl: string }) {
  return {
    text: o.text,
    link_preview_options: { is_disabled: true },
    ...(o.buttonText && o.buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: o.buttonText, url: o.buttonUrl }]] } } : {}),
  }
}

// Non-blocked users of the chosen audience.
export function recipients(audience: string) {
  const a = audience as BroadcastAudience
  const since = (days: number) => new Date(Date.now() - days * DAY)
  return and(
    eq(users.blocked, false),
    a === 'active7'
      ? gte(users.lastSeenAt, since(7))
      : a === 'active30'
        ? gte(users.lastSeenAt, since(30))
        : a === 'new7'
          ? gte(users.firstSeenAt, since(7))
          : undefined,
  )
}

export async function countRecipients(audience: string) {
  const [{ n }] = await db.select({ n: count() }).from(users).where(recipients(audience))
  return n
}

const BATCH = 20

// Sends the next batch. The batch is claimed by moving the cursor first (compare-and-set), so two
// senders (two open panels, or the panel and the scheduler) can't send the same messages twice.
// Returns the updated row, Telegram's flood-wait in seconds (0 if none) and whether it just finished.
export async function sendNextBatch(b: Broadcast): Promise<{ broadcast: Broadcast; retryAfter: number; finished: boolean }> {
  if (b.status !== 'sending') return { broadcast: b, retryAfter: 0, finished: false }

  const batch = await db
    .select({ id: users.telegramUserId })
    .from(users)
    .where(and(recipients(b.audience), gt(users.telegramUserId, b.cursor)))
    .orderBy(asc(users.telegramUserId))
    .limit(BATCH)

  if (!batch.length) {
    const [done] = await db
      .update(broadcasts)
      .set({ status: 'done', finishedAt: new Date() })
      .where(and(eq(broadcasts.id, b.id), eq(broadcasts.status, 'sending')))
      .returning()
    return { broadcast: done ?? b, retryAfter: 0, finished: !!done }
  }

  const [claimed] = await db
    .update(broadcasts)
    .set({ cursor: batch[batch.length - 1].id })
    .where(and(eq(broadcasts.id, b.id), eq(broadcasts.cursor, b.cursor), eq(broadcasts.status, 'sending')))
    .returning()
  if (!claimed) {
    const [now] = await db.select().from(broadcasts).where(eq(broadcasts.id, b.id))
    return { broadcast: now, retryAfter: 1, finished: false }
  }

  const payload = broadcastMessage(b)
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
  return { broadcast: row, retryAfter, finished: false }
}
