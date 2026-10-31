import { createServerFn } from '@tanstack/react-start'
import { handleUserMessage, openTicket, requestHuman, ticketMessages } from './automation/support'
import { loadAutomation, recordError } from './automation/store'
import { verifyInitUser } from './telegramBot'

// "Підтримка" chat in the Mini App. The user is always the one from verified initData.

export interface SupportChatMessage {
  id: string
  role: 'user' | 'ai' | 'admin' | 'system'
  text: string
  createdAt: string
}

export interface SupportChat {
  authorized: boolean
  aiOn: boolean
  status: 'none' | 'open' | 'escalated'
  messages: SupportChatMessage[]
}

export type SupportSendResult = { ok: true; chat: SupportChat } | { ok: false; reason: 'unauthorized' | 'blocked' | 'rate' | 'invalid' | 'server' }

async function chatOf(userId: string | null): Promise<SupportChat> {
  const cfg = await loadAutomation()
  const aiOn = !cfg.paused && cfg.modules.support.enabled
  if (!userId) return { authorized: false, aiOn, status: 'none', messages: [] }
  const ticket = await openTicket(userId)
  const rows = ticket ? await ticketMessages(ticket.id) : []
  return {
    authorized: true,
    aiOn,
    status: ticket ? (ticket.status as 'open' | 'escalated') : 'none',
    messages: rows.map((m) => ({ id: m.id, role: m.role as SupportChatMessage['role'], text: m.text, createdAt: m.createdAt.toISOString() })),
  }
}

export const getSupportChat = createServerFn({ method: 'POST' })
  .validator((d: { initData: string }) => ({ initData: String(d?.initData ?? '').slice(0, 4096) }))
  .handler(async ({ data }): Promise<SupportChat> => chatOf(verifyInitUser(data.initData)?.id ?? null))

export const sendSupportMessage = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; text: string }) => ({
    initData: String(d?.initData ?? '').slice(0, 4096),
    text: String(d?.text ?? '').slice(0, 2000),
  }))
  .handler(async ({ data }): Promise<SupportSendResult> => {
    const user = verifyInitUser(data.initData)
    if (!user) return { ok: false, reason: 'unauthorized' }
    try {
      const r = await handleUserMessage(user, data.text)
      if (!r.ok) return r
      return { ok: true, chat: await chatOf(user.id) }
    } catch (e) {
      console.error('Support send error:', e)
      await recordError('support.send', e)
      return { ok: false, reason: 'server' }
    }
  })

export const askForHuman = createServerFn({ method: 'POST' })
  .validator((d: { initData: string }) => ({ initData: String(d?.initData ?? '').slice(0, 4096) }))
  .handler(async ({ data }): Promise<SupportSendResult> => {
    const user = verifyInitUser(data.initData)
    if (!user) return { ok: false, reason: 'unauthorized' }
    try {
      await requestHuman(user)
      return { ok: true, chat: await chatOf(user.id) }
    } catch (e) {
      console.error('Support escalate error:', e)
      await recordError('support.escalate', e)
      return { ok: false, reason: 'server' }
    }
  })
