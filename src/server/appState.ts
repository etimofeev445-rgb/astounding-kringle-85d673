import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { appSettings, users } from '../../db/schema.js'
import { sanitizeConfig, type AppConfig } from '../lib/appConfig'

// Server-only helpers shared by public and admin server functions.

export async function loadConfig(): Promise<AppConfig> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'config'))
  return sanitizeConfig(row?.value)
}

export async function isBlocked(userId: string) {
  const [row] = await db.select({ blocked: users.blocked }).from(users).where(eq(users.telegramUserId, userId))
  return !!row?.blocked
}
