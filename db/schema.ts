import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// One row per mobile top-up paid through Telegram Payments.
// status: pending → paid (money received) → fulfilled | failed (aggregator result).
export const topupOrders = pgTable(
  'topup_orders',
  {
  id: uuid().primaryKey().defaultRandom(),
  telegramUserId: text('telegram_user_id').notNull(),
  operator: text().notNull(),
  phone: text().notNull(),
  amountKop: integer('amount_kop').notNull(),
  status: text().notNull().default('pending'),
  telegramChargeId: text('telegram_charge_id'),
  providerChargeId: text('provider_charge_id'),
  aggregatorRef: text('aggregator_ref'),
  error: text(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  // A Telegram charge can only ever be credited to one order.
  (t) => [uniqueIndex('topup_orders_tg_charge_idx').on(t.telegramChargeId)],
)

// Classified ads posted from the Mini App and mirrored to the Telegram channel.
// status: active | deleted. Photo bytes live in the `ad-photos` blob store keyed by id.
export const ads = pgTable(
  'ads',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    title: text().notNull(),
    description: text().notNull(),
    price: integer(),
    phone: text().notNull().default(''),
    tgContact: text('tg_contact').notNull().default(''),
    hasPhoto: boolean('has_photo').notNull().default(false),
    channelChatId: text('channel_chat_id'),
    channelMessageId: integer('channel_message_id'),
    status: text().notNull().default('active'),
    // Admin review: pending | approved | rejected (rejected ads also get status 'rejected').
    moderation: text().notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('ads_status_created_idx').on(t.status, t.createdAt), index('ads_user_idx').on(t.telegramUserId)],
)

// Per-user "Кошик": snapshots of anything saved from the app (ads, cards, banks, services, channels).
export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    kind: text().notNull(),
    ref: text().notNull(),
    title: text().notNull(),
    subtitle: text().notNull().default(''),
    url: text().notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('cart_items_user_kind_ref_idx').on(t.telegramUserId, t.kind, t.ref)],
)

// Business catalog. Every card is published as a post in the Telegram catalog channel; this table is
// the index of those posts (ids of the channel messages) so the app can list, edit and delete them.
// storeKey is the owner's Telegram @username (lowercased) or `id<telegram id>`, used for the public
// storefront (?store=<key>). Logo/cover bytes live in the `place-photos` blob store.
export const places = pgTable(
  'places',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    storeKey: text('store_key').notNull(),
    category: text().notNull(),
    country: text().notNull().default(''),
    city: text().notNull().default(''),
    title: text().notNull(),
    description: text().notNull(),
    hours: text().notNull().default(''),
    price: text().notNull().default(''),
    mapUrl: text('map_url').notNull().default(''),
    phone: text().notNull().default(''),
    instagram: text().notNull().default(''),
    tgContact: text('tg_contact').notNull().default(''),
    hasPhoto: boolean('has_photo').notNull().default(false),
    hasCover: boolean('has_cover').notNull().default(false),
    // Channel post: one message, or an album (cover + logo) whose first message carries the caption.
    channelChatId: text('channel_chat_id'),
    channelMessageIds: integer('channel_message_ids').array().notNull().default([]),
    status: text().notNull().default('active'),
    moderation: text().notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('places_status_idx').on(t.status, t.createdAt),
    index('places_store_idx').on(t.storeKey),
    index('places_user_idx').on(t.telegramUserId),
  ],
)

// Everyone who opened the Mini App with valid initData (upserted on each open). Blocked users can
// still browse but can't publish ads/cards or file reports.
export const users = pgTable(
  'users',
  {
    telegramUserId: text('telegram_user_id').primaryKey(),
    username: text().notNull().default(''),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    languageCode: text('language_code').notNull().default(''),
    blocked: boolean().notNull().default(false),
    blockedReason: text('blocked_reason').notNull().default(''),
    sessions: integer().notNull().default(0),
    firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  },
  (t) => [index('users_first_seen_idx').on(t.firstSeenAt), index('users_last_seen_idx').on(t.lastSeenAt)],
)

// App activity (one "open" row per Mini App launch) for the admin dashboard.
export const appEvents = pgTable(
  'app_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    type: text().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('app_events_created_idx').on(t.createdAt), index('app_events_user_idx').on(t.telegramUserId)],
)

// User complaints about an ad or a catalog card. status: open | resolved | dismissed.
export const reports = pgTable(
  'reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text().notNull(),
    status: text().notNull().default('open'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('reports_user_target_idx').on(t.telegramUserId, t.targetKind, t.targetId),
    index('reports_status_idx').on(t.status, t.createdAt),
  ],
)

// Audit trail of everything done from the admin panel (logins included).
export const adminLog = pgTable(
  'admin_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    adminId: text('admin_id').notNull(),
    action: text().notNull(),
    targetKind: text('target_kind').notNull().default(''),
    targetId: text('target_id').notNull().default(''),
    details: jsonb().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('admin_log_created_idx').on(t.createdAt), index('admin_log_target_idx').on(t.targetKind, t.targetId)],
)

// Admin-editable app configuration (key "config" holds the AppConfig JSON from src/lib/appConfig.ts).
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Information materials managed by the admin, shown on the "Документи" screen.
export const documents = pgTable(
  'documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    body: text().notNull().default(''),
    url: text().notNull().default(''),
    published: boolean().notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('documents_order_idx').on(t.sortOrder)],
)

// Bot broadcasts. Sent in small batches (cursor = last processed telegram_user_id) so a long
// mailing never hits the function timeout. status: scheduled | sending | done.
// audience: all | active7 | active30 | new7. Planned mailings (scheduled_at set) are sent by the
// "broadcasts" automation module once their time comes.
export const broadcasts = pgTable('broadcasts', {
  id: uuid().primaryKey().defaultRandom(),
  text: text().notNull(),
  buttonText: text('button_text').notNull().default(''),
  buttonUrl: text('button_url').notNull().default(''),
  status: text().notNull().default('draft'),
  total: integer().notNull().default(0),
  sent: integer().notNull().default(0),
  failed: integer().notNull().default(0),
  cursor: text().notNull().default(''),
  audience: text().notNull().default('all'),
  scheduledAt: timestamp('scheduled_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
})

// Automation job queue (src/server/automation/engine.ts). Jobs run in short steps; `state` is the
// checkpoint between steps, so a paused, interrupted or retried job continues where it stopped.
// status: queued | running | paused | done | failed | cancelled. trigger: schedule | manual | event.
export const automationJobs = pgTable(
  'automation_jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    module: text().notNull(),
    lockGroup: text('lock_group').notNull(),
    trigger: text().notNull(),
    status: text().notNull().default('queued'),
    progress: integer().notNull().default(0),
    progressText: text('progress_text').notNull().default(''),
    state: jsonb().notNull().default({}),
    result: jsonb(),
    summary: text().notNull().default(''),
    error: text().notNull().default(''),
    attempts: integer().notNull().default(0),
    createdBy: text('created_by').notNull().default(''),
    scheduledFor: timestamp('scheduled_for'),
    startedAt: timestamp('started_at'),
    heartbeatAt: timestamp('heartbeat_at'),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    // Never two unfinished jobs for the same module…
    uniqueIndex('automation_jobs_module_open_idx').on(t.module).where(sql`status in ('queued', 'running', 'paused')`),
    // …and never two running jobs that conflict (e.g. everything that sends Telegram messages).
    uniqueIndex('automation_jobs_lock_running_idx').on(t.lockGroup).where(sql`status = 'running'`),
    index('automation_jobs_module_created_idx').on(t.module, t.createdAt),
    index('automation_jobs_status_idx').on(t.status, t.createdAt),
  ],
)

// Events for the automation modules: security signals recorded at their source (refused admin
// access, wrong webhook secret, blocked users), module findings and errors. level: info | warn | error.
export const automationEvents = pgTable(
  'automation_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    module: text().notNull(),
    level: text().notNull().default('info'),
    kind: text().notNull(),
    message: text().notNull(),
    details: jsonb().notNull().default({}),
    jobId: uuid('job_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('automation_events_created_idx').on(t.createdAt), index('automation_events_kind_idx').on(t.kind, t.createdAt)],
)

// Support conversations from the Mini App ("Підтримка"). The AI consultant answers while the ticket
// is open; escalated tickets wait for the admin, whose replies also go to the user via the bot.
// status: open | escalated | closed. At most one unclosed ticket per user.
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid().primaryKey().defaultRandom(),
    telegramUserId: text('telegram_user_id').notNull(),
    status: text().notNull().default('open'),
    escalatedReason: text('escalated_reason').notNull().default(''),
    aiReplies: integer('ai_replies').notNull().default(0),
    unread: boolean().notNull().default(false),
    escalatedAt: timestamp('escalated_at'),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('support_tickets_user_open_idx').on(t.telegramUserId).where(sql`status <> 'closed'`),
    index('support_tickets_status_idx').on(t.status, t.updatedAt),
  ],
)

// Messages of a support ticket. role: user | ai | admin | system.
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull(),
    role: text().notNull(),
    text: text().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('support_messages_ticket_idx').on(t.ticketId, t.createdAt)],
)
