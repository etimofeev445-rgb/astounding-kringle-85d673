// Shared by the ads screen and src/server/ads.ts.
export const AD_LIMITS = { title: 80, description: 800, price: 100_000_000, photoBytes: 2_500_000, perUser: 20 }

export interface AdView {
  id: string
  title: string
  description: string
  price: number | null
  phone: string
  tgContact: string
  photoUrl: string | null
  postUrl: string | null
  createdAt: string
  mine: boolean
}

export interface AdInput {
  title: string
  description: string
  price: number | null
  phone: string
  tgContact: string
}

// "@user_name" or a numeric Telegram id.
export const normalizeTg = (v: string) => {
  const s = v.trim().replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '')
  if (/^\d{5,15}$/.test(s)) return s
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s)) return `@${s}`
  return ''
}

export const normalizePhone = (v: string) => {
  const d = v.replace(/[^\d+]/g, '')
  return /^\+?\d{9,15}$/.test(d) ? d : ''
}
