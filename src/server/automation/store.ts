import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { appSettings, automationEvents } from '../../../db/schema.js'
import { sanitizeAutomation, type AutomationConfig, type ModuleId } from '../../lib/automation'
import { adminChatId, sendMessage } from '../telegramBot'

// Server-only: automation config, the event journal, per-module cursors and admin notifications.

// The only admin (same as ADMIN_IDS in ../adminAuth.ts): the fallback chat for notifications.
const OWNER_CHAT = '7888321842'

export async function loadAutomation(): Promise<AutomationConfig> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'automation'))
  return sanitizeAutomation(row?.value)
}

export async function storeAutomation(next: AutomationConfig) {
  await db
    .insert(appSettings)
    .values({ key: 'automation', value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
}

// Whether a module may act right now (global pause and its own switch).
export async function moduleOn(id: ModuleId) {
  try {
    const cfg = await loadAutomation()
    return !cfg.paused && cfg.modules[id].enabled ? cfg.modules[id] : null
  } catch (e) {
    console.error('Load automation error:', e)
    return null
  }
}

// ── Per-module cursors ("everything after this moment is new") ───────────────────────────────

const cursorKey = (module: string) => `automation.cursor.${module}`

export async function getCursor(module: string): Promise<Date | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, cursorKey(module)))
  const v = (row?.value as { at?: string } | undefined)?.at
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null
}

export async function setCursor(module: string, at: Date) {
  const value = { at: at.toISOString() }
  await db
    .insert(appSettings)
    .values({ key: cursorKey(module), value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

// Small JSON memo per module (last known statuses, for reporting only changes).
const memoKey = (module: string) => `automation.memo.${module}`

export async function getMemo<T>(module: string): Promise<T | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, memoKey(module)))
  return (row?.value as T) ?? null
}

export async function setMemo(module: string, value: unknown) {
  await db
    .insert(appSettings)
    .values({ key: memoKey(module), value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

// ── Event journal ────────────────────────────────────────────────────────────────────────────

export type Level = 'info' | 'warn' | 'error'

// At most this many events of one kind per hour, so a flood of bad requests can't flood the table.
const KIND_CAP_PER_HOUR = 200

// Records an event; never throws (a journal failure must not break the request that reports it).
export async function recordEvent(
  module: string,
  level: Level,
  kind: string,
  message: string,
  details: Record<string, unknown> = {},
  jobId?: string,
) {
  try {
    const [{ n }] = await db
      .select({ n: count() })
      .from(automationEvents)
      .where(and(eq(automationEvents.kind, kind), gte(automationEvents.createdAt, new Date(Date.now() - 3600_000))))
    if (n >= KIND_CAP_PER_HOUR) return
    await db.insert(automationEvents).values({ module, level, kind, message: message.slice(0, 1000), details, jobId })
  } catch (e) {
    console.error('Record event error:', e)
  }
}

// Shortcut for unexpected server errors, picked up by "Помилки застосунку" notifications.
export const recordError = (where: string, e: unknown) =>
  recordEvent('app', 'error', 'app.error', `${where}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500), { where })

// Whether an event of this kind about this subject was already recorded recently (de-duplication).
export async function seenRecently(kind: string, subject: string, sinceMs: number) {
  const rows = await db
    .select({ details: automationEvents.details })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, kind), gte(automationEvents.createdAt, new Date(Date.now() - sinceMs))))
    .limit(500)
  return rows.some((r) => (r.details as { subject?: string })?.subject === subject)
}

// ── Admin notifications ──────────────────────────────────────────────────────────────────────

export async function notifyChat() {
  const cfg = await loadAutomation().catch(() => null)
  const custom = String(cfg?.modules.notify.settings.chatId ?? '')
  return custom || adminChatId() || OWNER_CHAT
}

// Sends a bot message to the admin chat. Returns whether Telegram accepted it.
export async function notifyAdmin(text: string) {
  return sendMessage(await notifyChat(), text.slice(0, 4000))
}
