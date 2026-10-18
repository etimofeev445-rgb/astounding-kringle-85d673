import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { tg } from './telegram'

// UI languages. Translations live next to where they're used as `Tr` objects.
export type Lang = 'uk' | 'ru'
export type Tr = Record<Lang, string>

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'uk', label: 'UK' },
  { value: 'ru', label: 'RU' },
]

const KEY = 'uat-lang'
const isLang = (v: unknown): v is Lang => v === 'uk' || v === 'ru'

// Saved choice first, then the Telegram user's language; Ukrainian by default.
function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLang(saved)) return saved
  } catch {}
  const code = tg()?.initDataUnsafe?.user?.language_code?.slice(0, 2)
  if (code === 'ru') return 'ru'
  return 'uk'
}

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (tr: Tr) => string
}

const Ctx = createContext<I18n>({ lang: 'uk', setLang: () => {}, t: (tr) => tr.uk })

export function LangProvider({ children }: { children: ReactNode }) {
  // Server and first client render use Ukrainian to keep hydration stable.
  const [lang, setLangState] = useState<Lang>('uk')

  useEffect(() => setLangState(detect()), [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {}
  }, [])
  const t = useCallback((tr: Tr) => tr[lang], [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)

// Shared calendar strings.
export const MONTHS: Record<Lang, string[]> = {
  uk: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
}
export const MONTHS_GEN: Record<Lang, string[]> = {
  uk: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
}
export const WEEKDAYS: Record<Lang, string[]> = {
  uk: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
}
// Indexed by Date#getDay() (Sunday first).
export const DAY_NAMES: Record<Lang, string[]> = {
  uk: ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
}
// "24 серпня" / "24 августа".
export const dayMonth = (lang: Lang, day: number, month: number) => `${day} ${MONTHS_GEN[lang][month]}`
