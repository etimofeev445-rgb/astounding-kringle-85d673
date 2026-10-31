import { db } from '../../../db/index.js'
import { adminLog } from '../../../db/schema.js'
import type { InitUser } from '../telegramBot'

// Server-only helpers for the admin actions.

export type Admin = InitUser

// Thrown for bad admin input; reported back to the panel as "invalid" with the message.
export class InputError extends Error {}

export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s)

export const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
export const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
export const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
// LIKE pattern from user text, with wildcards escaped.
export const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

export async function log(admin: Admin, action: string, targetKind = '', targetId = '', details: Record<string, unknown> = {}) {
  try {
    await db.insert(adminLog).values({ adminId: admin.id, action, targetKind, targetId, details })
  } catch (e) {
    // The audit trail must not silently disappear, but a log failure shouldn't undo the action either.
    console.error('Admin log error:', e)
  }
}

export const displayName = (u: { username?: string; firstName?: string; lastName?: string } | undefined, id: string) =>
  u ? (u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ') || `ID ${id}`) : `ID ${id}`
