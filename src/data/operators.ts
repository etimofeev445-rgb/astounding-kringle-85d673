export type OperatorId = 'kyivstar' | 'vodafone' | 'lifecell' | '3mob'

// `url` is the operator's own top-up page, used when in-app payment isn't available
// (regular browser, or Telegram Payments not configured yet).
export const OPERATORS: {
  id: OperatorId
  name: string
  codes: string[]
  url: string
  bg: string
  fg: string
}[] = [
  { id: 'kyivstar', name: 'Kyivstar', codes: ['67', '68', '96', '97', '98', '77'], url: 'https://kyivstar.ua/pay', bg: '#0b3d91', fg: '#ffd400' },
  { id: 'vodafone', name: 'Vodafone', codes: ['50', '66', '95', '99', '75'], url: 'https://www.vodafone.ua/uk/popovnennya-rakhunku', bg: '#e60000', fg: '#ffffff' },
  { id: 'lifecell', name: 'lifecell', codes: ['63', '73', '93'], url: 'https://www.lifecell.ua/uk/popovnennya/', bg: '#ffcc00', fg: '#1a1a1a' },
  { id: '3mob', name: '3Mob', codes: ['91'], url: 'https://3mob.ua/', bg: '#5b2d90', fg: '#ffffff' },
]

export const TOPUP_MIN = 10
export const TOPUP_MAX = 3000

// Local part after +380: 9 digits, shown as "XX XXX XX XX".
export function formatLocal(d: string) {
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)]
  return parts.filter(Boolean).join(' ')
}
