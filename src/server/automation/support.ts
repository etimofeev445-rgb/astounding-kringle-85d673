import Anthropic from '@anthropic-ai/sdk'
import { and, asc, count, eq, gte, inArray, ne } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { supportMessages, supportTickets, users } from '../../../db/schema.js'
import { moduleDef } from '../../lib/automation'
import { isBlocked, loadConfig } from '../appState'
import { sendMessage, type InitUser } from '../telegramBot'
import { loadAutomation, notifyAdmin, recordError, recordEvent } from './store'

// Server-only: the "Підтримка" conversations. The AI consultant (Claude via Netlify AI Gateway)
// answers while a ticket is open; anything it shouldn't handle goes to the admin.

export type Ticket = typeof supportTickets.$inferSelect
export type SupportMessage = typeof supportMessages.$inferSelect

export const MAX_MESSAGE = 1000

const settings = async () => {
  const cfg = await loadAutomation()
  const mod = cfg.modules.support
  return { on: !cfg.paused && mod.enabled, s: mod.settings }
}

export async function openTicket(userId: string) {
  const [row] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.telegramUserId, userId), ne(supportTickets.status, 'closed')))
  return row ?? null
}

export const ticketMessages = (ticketId: string) =>
  db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticketId)).orderBy(asc(supportMessages.createdAt)).limit(200)

async function addMessage(ticketId: string, role: 'user' | 'ai' | 'admin' | 'system', text: string) {
  await db.insert(supportMessages).values({ ticketId, role, text })
}

const who = (u: { username?: string; firstName?: string; lastName?: string }, id: string) =>
  u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ') || `ID ${id}`

export async function escalate(ticket: Ticket, reason: string, lastText: string, user: { username?: string; firstName?: string; lastName?: string }) {
  const [row] = await db
    .update(supportTickets)
    .set({ status: 'escalated', escalatedReason: reason.slice(0, 200), escalatedAt: new Date(), unread: true, updatedAt: new Date() })
    .where(and(eq(supportTickets.id, ticket.id), eq(supportTickets.status, 'open')))
    .returning()
  if (!row) return
  await addMessage(ticket.id, 'system', 'Звернення передано адміністратору. Відповідь з’явиться тут і прийде в чат з ботом.')
  const name = who(user, ticket.telegramUserId)
  await recordEvent('support', 'warn', 'support.escalated', `Звернення від ${name} (${reason}): ${lastText.slice(0, 200)}`, {
    subject: ticket.id,
    userId: ticket.telegramUserId,
  })
  const { s } = await settings()
  if (s.notifyAdmin !== false) {
    await notifyAdmin(`💬 Звернення в підтримку потребує відповіді\nВід: ${name}\nПричина: ${reason}\n\n${lastText.slice(0, 1000)}\n\nВідповісти: адмін-панель → Підтримка`)
  }
}

// ── AI consultant ────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-opus-5-5'

const APP_GUIDE = `UAT Market — Telegram Mini App (відкривається кнопкою меню бота) для українців. Розділи:
- Карта: каталог бізнесів (магазини, салони краси, житло, кафе, послуги, робота, авто). «Додати бізнес» у Меню або на Карті: назва, категорія, країна і місто, опис, години роботи, ціни, обкладинка і логотип, телефон / Instagram / Telegram, посилання на адресу. Картка публікується в Telegram-каналі каталогу; редагувати й видаляти може лише автор (фільтр «Мої»). До 10 карток на користувача. Є вітрина продавця з усіма його картками.
- Оголошення: подати, переглянути, редагувати свої оголошення; вони публікуються в Telegram-каналі.
- Поповнення мобільного: оплата всередині Telegram (Telegram Payments). Після оплати номер поповнюється автоматично або адміністратором вручну.
- Курс валют (НБУ, ПриватБанк, monobank), Банки України (МФО, ЄДРПОУ, гарячі лінії), ДП Документи (центри видачі документів), Калькулятор (звичайний, ПДВ, депозит, кредит), Нова пошта (відстеження ТТН, відділення), Календар свят, Відкрити карту (Kraken, Simple, Kolo), Новини, Кошик (збережене), Пошук по всьому застосунку, Інформація.
- Під оголошенням чи карткою є «Поскаржитися» — скаргу розглядає модератор.
- Заблоковані модератором користувачі можуть переглядати застосунок, але не можуть публікувати чи скаржитися.`

const SYSTEM = (extra: string, appName: string) => `Ти — консультант служби підтримки застосунку «${appName}».
Відповідай мовою користувача (українською або російською), коротко й по суті, звичайним текстом без Markdown.

Що ти знаєш про застосунок:
${APP_GUIDE}
${extra ? `\nДодаткова інформація від адміністратора:\n${extra}\n` : ''}
Правила:
- Спирайся лише на інформацію вище. Якщо відповіді немає або ти не впевнений — не вигадуй, а передай звернення адміністратору.
- Передавай адміністратору (escalate = true): проблеми з оплатою, поповненням чи поверненням грошей; скарги на інших користувачів чи шахрайство; блокування акаунта; видалення чи модерацію конкретних публікацій; юридичні питання; прохання поговорити з людиною; усе, що потребує доступу до даних користувача.
- Ніколи не проси номер картки, CVV, паролі чи коди з SMS. Не обіцяй повернень, строків чи винятків від імені адміністрації.
- Коли передаєш звернення, у reply коротко скажи, що адміністратор відповість, і за потреби попроси деталі (номер замовлення, дату, суму).
Поверни JSON: reply — текст відповіді; escalate — чи передати адміністратору; reason — коротка причина передачі (порожньо, якщо не передаєш).`

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    escalate: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['reply', 'escalate', 'reason'],
  additionalProperties: false,
}

async function askAi(history: SupportMessage[], extra: string): Promise<{ reply: string; escalate: boolean; reason: string } | null> {
  const appName = (await loadConfig().catch(() => null))?.appName || 'UAT Market'
  // Credentials come from Netlify AI Gateway (injected env vars); nothing is configured in code.
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 })
  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    if (m.role === 'system') continue
    const role = m.role === 'user' ? 'user' : 'assistant'
    const text = m.role === 'admin' ? `[Відповідь адміністратора] ${m.text}` : m.text
    const last = messages[messages.length - 1]
    if (last?.role === role) last.content = `${last.content}\n\n${text}`
    else messages.push({ role, content: text })
  }
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM(extra, appName),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: messages.slice(-20),
  })
  // A refusal or a cut-off answer is handed to the admin instead.
  if (res.stop_reason !== 'end_turn') return null
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? ''
  try {
    const out = JSON.parse(text) as { reply?: unknown; escalate?: unknown; reason?: unknown }
    const reply = typeof out.reply === 'string' ? out.reply.trim().slice(0, 3000) : ''
    if (!reply && out.escalate !== true) return null
    return { reply, escalate: out.escalate === true, reason: typeof out.reason === 'string' ? out.reason.slice(0, 200) : '' }
  } catch {
    return null
  }
}

// ── User side ────────────────────────────────────────────────────────────────────────────────

export type SendResult = { ok: true } | { ok: false; reason: 'blocked' | 'rate' | 'invalid' }

export async function handleUserMessage(user: InitUser, raw: string): Promise<SendResult> {
  const text = raw.trim().slice(0, MAX_MESSAGE)
  if (!text) return { ok: false, reason: 'invalid' }
  if (await isBlocked(user.id)) {
    await recordEvent('security', 'warn', 'security.blocked_action', `Заблокований користувач ID ${user.id} пише в підтримку`, { userId: user.id, action: 'support' })
    return { ok: false, reason: 'blocked' }
  }
  const { on, s } = await settings()
  const perHour = Number(s.perHour) || 20
  const mine = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.telegramUserId, user.id))
  if (mine.length) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(supportMessages)
      .where(
        and(
          inArray(supportMessages.ticketId, mine.map((t) => t.id)),
          eq(supportMessages.role, 'user'),
          gte(supportMessages.createdAt, new Date(Date.now() - 3600_000)),
        ),
      )
    if (n >= perHour) return { ok: false, reason: 'rate' }
  }

  await db.insert(supportTickets).values({ telegramUserId: user.id }).onConflictDoNothing()
  const ticket = (await openTicket(user.id))!
  await addMessage(ticket.id, 'user', text)
  await db.update(supportTickets).set({ updatedAt: new Date(), unread: true }).where(eq(supportTickets.id, ticket.id))

  if (ticket.status === 'escalated') {
    // Already with the admin: just let them know there is a new message.
    if (s.notifyAdmin !== false) await notifyAdmin(`💬 Нове повідомлення в зверненні від ${who(user, user.id)}:\n\n${text}`)
    return { ok: true }
  }
  if (!on) {
    await escalate(ticket, 'AI-консультант вимкнений', text, user)
    return { ok: true }
  }
  const lower = text.toLowerCase()
  const word = (s.escalateWords as string[] | undefined)?.find((w) => w && lower.includes(w))
  if (word) {
    await escalate(ticket, `ключове слово «${word}»`, text, user)
    return { ok: true }
  }
  if (ticket.aiReplies >= (Number(s.maxAiReplies) || 6)) {
    await escalate(ticket, 'досягнуто ліміт відповідей AI', text, user)
    return { ok: true }
  }

  let answer: Awaited<ReturnType<typeof askAi>> = null
  try {
    answer = await askAi(await ticketMessages(ticket.id), String(s.extraInfo ?? ''))
  } catch (e) {
    console.error('Support AI error:', e)
    await recordError('support.ai', e)
  }
  if (!answer) {
    await escalate(ticket, 'AI не зміг відповісти', text, user)
    return { ok: true }
  }
  if (answer.reply) await addMessage(ticket.id, 'ai', answer.reply)
  await db
    .update(supportTickets)
    .set({ aiReplies: ticket.aiReplies + 1, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id))
  if (answer.escalate) await escalate(ticket, answer.reason || 'AI передав складне звернення', text, user)
  return { ok: true }
}

// "Покликати адміністратора" in the chat.
export async function requestHuman(user: InitUser) {
  const ticket = await openTicket(user.id)
  if (!ticket || ticket.status !== 'open') return false
  const [last] = (await ticketMessages(ticket.id)).filter((m) => m.role === 'user').slice(-1)
  await escalate(ticket, 'користувач попросив адміністратора', last?.text ?? '', user)
  return true
}

// ── Admin side ───────────────────────────────────────────────────────────────────────────────

export async function adminReply(ticketId: string, text: string) {
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId))
  if (!ticket || ticket.status === 'closed') return null
  await addMessage(ticket.id, 'admin', text)
  await db
    .update(supportTickets)
    .set({ status: 'escalated', escalatedAt: ticket.escalatedAt ?? new Date(), unread: false, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id))
  const delivered = await sendMessage(ticket.telegramUserId, `💬 Відповідь підтримки UAT Market:\n\n${text}\n\nПродовжити розмову: Меню → Підтримка`)
  return { delivered }
}

export async function closeTicket(ticketId: string) {
  const [row] = await db
    .update(supportTickets)
    .set({ status: 'closed', closedAt: new Date(), unread: false, updatedAt: new Date() })
    .where(and(eq(supportTickets.id, ticketId), ne(supportTickets.status, 'closed')))
    .returning()
  if (row) await addMessage(row.id, 'system', 'Звернення закрито. Якщо питання залишилося — просто напишіть нове повідомлення.')
  return row ?? null
}

export async function userNames(ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const rows = await db.select().from(users).where(inArray(users.telegramUserId, [...new Set(ids)]))
  return new Map(rows.map((u) => [u.telegramUserId, who(u, u.telegramUserId)]))
}

export const supportTitle = moduleDef('support').title
