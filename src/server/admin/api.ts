import { createServerFn } from '@tanstack/react-start'
import { checkAdmin } from '../adminAuth'
import { ACTIONS } from './actions'
import { InputError, type Admin } from './util'

export type AdminError = 'forbidden' | 'expired' | 'invalid' | 'server'
export type AdminResponse = { ok: true; data: any } | { ok: false; error: AdminError; message?: string }

// The single admin endpoint. Each call carries the Mini App initData; the signature (bot token),
// its age and the signed Telegram ID are checked here before any action runs.
export const adminApi = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; action: string; payload?: unknown }) => ({
    initData: String(d?.initData ?? '').slice(0, 4096),
    action: String(d?.action ?? ''),
    payload: d?.payload ?? {},
  }))
  .handler(async ({ data }): Promise<AdminResponse> => {
    const auth = checkAdmin(data.initData)
    if (!auth.ok) return { ok: false, error: auth.error }
    if (!Object.hasOwn(ACTIONS, data.action)) return { ok: false, error: 'invalid', message: 'Unknown action' }
    const action = ACTIONS[data.action as keyof typeof ACTIONS] as (admin: Admin, payload: unknown) => Promise<unknown>
    try {
      return { ok: true, data: await action(auth.admin, data.payload) }
    } catch (e) {
      if (e instanceof InputError) return { ok: false, error: 'invalid', message: e.message }
      console.error(`Admin ${data.action} error:`, e)
      return { ok: false, error: 'server' }
    }
  })
