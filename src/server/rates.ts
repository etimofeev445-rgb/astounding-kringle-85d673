import { createServerFn } from '@tanstack/react-start'

export interface NbuRate {
  code: string
  name: string
  rate: number
  // Difference from the previous day's NBU rate, when it could be fetched.
  change?: number
}

export interface CashRate {
  code: string
  buy: number
  sale: number
}

export interface RatesPayload {
  date: string
  nbu: NbuRate[]
  privat: CashRate[]
  mono: CashRate[]
  fetchedAt: string
}

const ISO: Record<number, string> = { 840: 'USD', 978: 'EUR', 985: 'PLN', 826: 'GBP', 756: 'CHF' }

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const getRates = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RatesPayload> => {
    const [nbuRaw, privatRaw, monoRaw] = await Promise.all([
      json<{ cc: string; txt: string; rate: number; exchangedate: string }[]>(
        'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
      ),
      json<{ ccy: string; base_ccy: string; buy: string; sale: string }[]>(
        'https://api.privatbank.ua/p24api/pubinfo?exchange&coursid=5',
      ),
      json<{ currencyCodeA: number; currencyCodeB: number; rateBuy?: number; rateSell?: number }[]>(
        'https://api.monobank.ua/bank/currency',
      ),
    ])

    // Previous day's NBU rates for the change indicator; failure just drops `change`.
    const [d, m, y] = (nbuRaw?.[0]?.exchangedate ?? '').split('.').map(Number)
    const prevDay = d && m && y ? new Date(Date.UTC(y, m - 1, d - 1)) : null
    const prevRaw = prevDay
      ? await json<{ cc: string; rate: number }[]>(
          `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${prevDay.toISOString().slice(0, 10).replace(/-/g, '')}&json`,
        )
      : null
    const prev = new Map((Array.isArray(prevRaw) ? prevRaw : []).map((r) => [r.cc, r.rate]))

    const nbu = (nbuRaw ?? []).map((r) => {
      const p = prev.get(r.cc)
      return { code: r.cc, name: r.txt, rate: r.rate, ...(p ? { change: r.rate - p } : {}) }
    })

    const privat = (privatRaw ?? [])
      .filter((r) => r.base_ccy === 'UAH')
      .map((r) => ({ code: r.ccy, buy: Number(r.buy), sale: Number(r.sale) }))

    const mono = (Array.isArray(monoRaw) ? monoRaw : [])
      .filter((r) => r.currencyCodeB === 980 && ISO[r.currencyCodeA] && r.rateBuy && r.rateSell)
      .map((r) => ({ code: ISO[r.currencyCodeA], buy: r.rateBuy!, sale: r.rateSell! }))

    return {
      date: nbuRaw?.[0]?.exchangedate ?? '',
      nbu,
      privat,
      mono,
      fetchedAt: new Date().toISOString(),
    }
  },
)
