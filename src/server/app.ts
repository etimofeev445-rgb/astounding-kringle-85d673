import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ads, appEvents, documents, places, reports, users } from '../../db/schema.js'
import { DEFAULT_CONFIG, type AppConfig } from '../lib/appConfig'
import { isAdminId } from './adminAuth'
import { isBlocked, loadConfig } from './appState'
import { verifyInitData, verifyInitUser } from './telegramBot'

export interface DocView {
  id: string
  title: string
  body: string
  url: string
}

// Called once per Mini App launch: records the user and the session, and tells the client whether
// to show the admin entry. The answer is only a UI hint — every admin call re-verifies on the server.
export const openApp = createServerFn({ method: 'POST' })
  .validator((d: { initData: string }) => ({ initData: String(d.initData ?? '').slice(0, 4096) }))
  .handler(async ({ data }): Promise<{ admin: boolean; blocked: boolean }> => {
    const user = verifyInitUser(data.initData)
    if (!user) return { admin: false, blocked: false }
    try {
      const profile = { username: user.username, firstName: user.firstName, lastName: user.lastName, languageCode: user.languageCode }
      const [row] = await db
        .insert(users)
        .values({ telegramUserId: user.id, ...profile, sessions: 1 })
        .onConflictDoUpdate({
          target: users.telegramUserId,
          set: { ...profile, sessions: sql`${users.sessions} + 1`, lastSeenAt: new Date() },
        })
        .returning({ blocked: users.blocked })
      await db.insert(appEvents).values({ telegramUserId: user.id, type: 'open' })
      return { admin: isAdminId(user.id), blocked: row.blocked }
    } catch (e) {
      console.error('Track open error:', e)
      return { admin: isAdminId(user.id), blocked: false }
    }
  })

export const getAppConfig = createServerFn({ method: 'GET' }).handler(async (): Promise<AppConfig> => {
  try {
    return await loadConfig()
  } catch (e) {
    console.error('Load config error:', e)
    return DEFAULT_CONFIG
  }
})

export const listDocuments = createServerFn({ method: 'GET' }).handler(async (): Promise<DocView[]> => {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.published, true))
    .orderBy(asc(documents.sortOrder), asc(documents.createdAt))
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, url: r.url }))
})

export type ReportResult = { ok: true } | { ok: false; reason: 'unauthorized' | 'invalid' | 'blocked' | 'disabled' | 'server' }

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

// "Поскаржитися" on an ad or a catalog card. One report per user per item.
export const reportContent = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; kind: string; id: string; reason: string }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    kind: d.kind === 'place' ? ('place' as const) : d.kind === 'ad' ? ('ad' as const) : null,
    id: String(d.id ?? ''),
    reason: String(d.reason ?? '').trim().slice(0, 500),
  }))
  .handler(async ({ data }): Promise<ReportResult> => {
    const userId = verifyInitData(data.initData)
    if (!userId) return { ok: false, reason: 'unauthorized' }
    if (!data.kind || !isUuid(data.id) || !data.reason) return { ok: false, reason: 'invalid' }
    try {
      if (!(await loadConfig()).features.reports) return { ok: false, reason: 'disabled' }
      if (await isBlocked(userId)) return { ok: false, reason: 'blocked' }
      const table = data.kind === 'ad' ? ads : places
      const [target] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, data.id), eq(table.status, 'active')))
      if (!target) return { ok: false, reason: 'invalid' }
      await db
        .insert(reports)
        .values({ telegramUserId: userId, targetKind: data.kind, targetId: data.id, reason: data.reason })
        .onConflictDoNothing()
      return { ok: true }
    } catch (e) {
      console.error('Report error:', e)
      return { ok: false, reason: 'server' }
    }
  })
