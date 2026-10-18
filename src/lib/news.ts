import { useCallback, useEffect, useState } from 'react'
import type { Lang } from './i18n'

// Shape returned by netlify/functions/get-news.mts.
export type NewsCategory = 'finance' | 'tech' | 'world' | 'telegram'

export interface NewsItem {
  id: string
  title: string
  description: string
  content: string
  link: string
  pubDate: string
  sourceName: string
  sourceIcon: string
  isTelegram: boolean
  category: NewsCategory
  imageUrl: string | null
}

const URL = '/.netlify/functions/get-news'

// Feed is shared for the app session; the CDN caches it for 15 minutes anyway.
let cache: NewsItem[] | null = null

async function fetchNews(): Promise<NewsItem[]> {
  // `no-cache` skips the browser's 10-minute copy but still hits the CDN cache.
  const res = await fetch(URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`news: ${res.status}`)
  const data = (await res.json()) as { items: NewsItem[] }
  return data.items
}

export function useNews() {
  const [items, setItems] = useState<NewsItem[] | null>(cache)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setRefreshing(true)
    try {
      cache = await fetchNews()
      setItems(cache)
    } catch {
      setError(true)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!cache) load()
  }, [load])

  return { items, error, refreshing, reload: load }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

// "15 хвилин тому" / "15 минут назад".
export function timeAgo(iso: string, lang: Lang, now = Date.now()) {
  const sec = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (sec < 60) return lang === 'uk' ? 'щойно' : 'только что'
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (sec >= size) return rtf.format(-Math.floor(sec / size), unit)
  }
  return rtf.format(-1, 'minute')
}
