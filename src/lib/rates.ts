import { useEffect, useState } from 'react'
import { getRates, type RatesPayload } from '../server/rates'

// Rates are shared across screens; fetch once per app session.
let cache: RatesPayload | null = null
let pending: Promise<RatesPayload> | null = null

export function useRates() {
  const [data, setData] = useState<RatesPayload | null>(cache)
  const [error, setError] = useState(false)

  const load = (force = false) => {
    if (force) {
      cache = null
      pending = null
    }
    setError(false)
    pending ??= getRates()
    pending
      .then((r) => {
        cache = r
        setData(r)
        if (!r.nbu.length) setError(true)
      })
      .catch(() => {
        pending = null
        setError(true)
      })
  }

  useEffect(() => {
    if (!cache) load()
  }, [])

  return { data, error, reload: () => load(true) }
}

export const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', PLN: '🇵🇱', GBP: '🇬🇧', CHF: '🇨🇭', CZK: '🇨🇿', CAD: '🇨🇦',
  JPY: '🇯🇵', CNY: '🇨🇳', TRY: '🇹🇷', SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰', HUF: '🇭🇺',
  MDL: '🇲🇩', GEL: '🇬🇪', AUD: '🇦🇺', KZT: '🇰🇿', UAH: '🇺🇦',
}

export const POPULAR = ['USD', 'EUR', 'PLN', 'GBP', 'CHF', 'CZK', 'CAD', 'TRY']
