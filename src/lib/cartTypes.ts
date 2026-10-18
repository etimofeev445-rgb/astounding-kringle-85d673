// Things that can be saved to the «Кошик» from anywhere in the app.
export const CART_KINDS = ['ad', 'card', 'bank', 'service', 'channel'] as const
export type CartKind = (typeof CART_KINDS)[number]

export interface CartItem {
  kind: CartKind
  ref: string
  title: string
  subtitle: string
  // External link to open; empty for in-app items (ads, banks).
  url: string
}
