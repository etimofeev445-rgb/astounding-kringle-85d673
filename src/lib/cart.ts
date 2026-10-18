import { useEffect, useSyncExternalStore } from 'react'
import { getCart, toggleCart } from '../server/cart'
import type { CartItem, CartKind } from './cartTypes'
import { tg } from './telegram'

export type { CartItem, CartKind }

// The cart is stored per Telegram user in the database; this module keeps a shared copy for all screens.
type State = { items: CartItem[]; loaded: boolean; available: boolean }

let state: State = { items: [], loaded: false, available: false }
let pending: Promise<void> | null = null
const subs = new Set<() => void>()
const SERVER_STATE: State = state

function set(next: Partial<State>) {
  state = { ...state, ...next }
  subs.forEach((f) => f())
}

const key = (kind: CartKind, ref: string) => `${kind}:${ref}`

function load() {
  const initData = tg()?.initData
  if (!initData) {
    set({ loaded: true, available: false })
    return
  }
  pending ??= getCart({ data: { initData } })
    .then((items) => set({ items: items ?? [], loaded: true, available: !!items }))
    .catch(() => {
      pending = null
      set({ loaded: true, available: false })
    })
}

export async function toggle(item: CartItem) {
  const initData = tg()?.initData
  if (!initData) return
  const had = state.items.some((i) => key(i.kind, i.ref) === key(item.kind, item.ref))
  const before = state.items
  set({ items: had ? before.filter((i) => key(i.kind, i.ref) !== key(item.kind, item.ref)) : [item, ...before] })
  try {
    const res = await toggleCart({ data: { initData, item } })
    if (!res.ok) set({ items: before })
  } catch {
    set({ items: before })
  }
}

export function dropFromCart(kind: CartKind, ref: string) {
  set({ items: state.items.filter((i) => key(i.kind, i.ref) !== key(kind, ref)) })
}

export function useCart() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
    () => SERVER_STATE,
  )
  useEffect(() => {
    if (!state.loaded) load()
  }, [])
  return {
    ...s,
    has: (kind: CartKind, ref: string) => s.items.some((i) => key(i.kind, i.ref) === key(kind, ref)),
    toggle,
  }
}
