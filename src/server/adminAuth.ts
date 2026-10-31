import { verifyInitUser, type InitUser } from './telegramBot'

// Server-only. The admin list is fixed in code: there is no API or setting that can add an admin.
const ADMIN_IDS: ReadonlySet<string> = new Set(['7888321842'])

// Admin initData must be fresh: reopening the Mini App issues a new one.
const ADMIN_MAX_AGE_SEC = 60 * 60

export const isAdminId = (id: string | null | undefined) => !!id && ADMIN_IDS.has(id)

export type AdminCheck = { ok: true; admin: InitUser } | { ok: false; error: 'forbidden' | 'expired' }

// Verifies the initData signature with the bot token, its age, and that the signed user id is an admin.
export function checkAdmin(initData: string): AdminCheck {
  const user = verifyInitUser(initData, ADMIN_MAX_AGE_SEC)
  if (user) return isAdminId(user.id) ? { ok: true, admin: user } : { ok: false, error: 'forbidden' }
  // Valid signature but too old for admin use → ask to reopen the app rather than a flat "forbidden".
  const stale = verifyInitUser(initData)
  return { ok: false, error: stale && isAdminId(stale.id) ? 'expired' : 'forbidden' }
}
