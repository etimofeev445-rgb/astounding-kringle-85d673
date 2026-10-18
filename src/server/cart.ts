import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { cartItems } from '../../db/schema.js'
import { CART_KINDS, type CartItem, type CartKind } from '../lib/cartTypes'
import { verifyInitData } from './telegramBot'

const toItem = (r: typeof cartItems.$inferSelect): CartItem => ({
  kind: r.kind as CartKind,
  ref: r.ref,
  title: r.title,
  subtitle: r.subtitle,
  url: r.url,
})

export const getCart = createServerFn({ method: 'POST' })
  .validator((d: { initData: string }) => ({ initData: String(d.initData ?? '').slice(0, 4096) }))
  .handler(async ({ data }): Promise<CartItem[] | null> => {
    const userId = verifyInitData(data.initData)
    if (!userId) return null
    const rows = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.telegramUserId, userId))
      .orderBy(desc(cartItems.createdAt))
      .limit(200)
    return rows.map(toItem)
  })

// Adds the item, or removes it if it's already in the cart. Returns whether it is now saved.
export const toggleCart = createServerFn({ method: 'POST' })
  .validator((d: { initData: string; item: CartItem }) => ({
    initData: String(d.initData ?? '').slice(0, 4096),
    item: {
      kind: String(d.item?.kind) as CartKind,
      ref: String(d.item?.ref ?? '').slice(0, 100),
      title: String(d.item?.title ?? '').slice(0, 120),
      subtitle: String(d.item?.subtitle ?? '').slice(0, 200),
      url: String(d.item?.url ?? '').slice(0, 500),
    },
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; saved: boolean }> => {
    const userId = verifyInitData(data.initData)
    const { item } = data
    if (!userId || !CART_KINDS.includes(item.kind) || !item.ref || !item.title) return { ok: false, saved: false }
    if (item.url && !/^https:\/\//.test(item.url)) return { ok: false, saved: false }

    const match = and(eq(cartItems.telegramUserId, userId), eq(cartItems.kind, item.kind), eq(cartItems.ref, item.ref))
    const removed = await db.delete(cartItems).where(match).returning({ id: cartItems.id })
    if (removed.length) return { ok: true, saved: false }
    await db.insert(cartItems).values({ ...item, telegramUserId: userId }).onConflictDoNothing()
    return { ok: true, saved: true }
  })
