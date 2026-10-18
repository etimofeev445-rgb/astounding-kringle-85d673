import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// One row per mobile top-up paid through Telegram Payments.
// status: pending → paid (money received) → fulfilled | failed (aggregator result).
export const topupOrders = pgTable('topup_orders', {
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
})

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('places_status_idx').on(t.status, t.createdAt),
    index('places_store_idx').on(t.storeKey),
    index('places_user_idx').on(t.telegramUserId),
  ],
)
