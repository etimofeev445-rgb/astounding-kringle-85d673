import {
  Bus, ChevronDown, ChevronRight, CreditCard, Info, MapPin, Megaphone, RefreshCw, Search, Send,
  ShoppingBag, SlidersHorizontal, Smartphone, Store, TrendingUp, Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SCREENS, type Go, type Screen } from '../../lib/nav'
import { FLAGS, useRates } from '../../lib/rates'
import { nextHoliday } from '../../lib/holidays'
import { LANGS, dayMonth, useI18n, type Tr } from '../../lib/i18n'
import { haptic, initData, openLink, userName } from '../../lib/telegram'
import { usePlaces } from '../../lib/placesData'
import { category } from '../../lib/places'
import type { AdView } from '../../lib/ads'
import { listAds } from '../../server/ads'
import { FLIXBUS_URL } from '../../data/links'
import { fmt } from '../ui'

export default function Home({ go }: { go: Go }) {
  const { data, reload } = useRates()
  const { lang, setLang, t } = useI18n()
  const [name, setName] = useState<string>()
  useEffect(() => setName(userName()), [])
  const next = useMemo(() => nextHoliday(), [])
  const today = new Date()

  const tiles = SCREENS.filter((s) => s.id !== 'search' && s.id !== 'cards' && s.id !== 'info')
  const top = ['USD', 'EUR', 'PLN'].map((c) => data?.nbu.find((r) => r.code === c))
  const nextLang = LANGS[(LANGS.findIndex((l) => l.value === lang) + 1) % LANGS.length].value

  return (
    <div>
      <header className="flex items-start justify-between mb-5 rise">
        <div>
          <p className="text-base text-white/80">{name
              ? `${t({ uk: 'Привіт', ru: 'Привет' })}, ${name} 👋`
              : t({ uk: 'Вітаємо 👋', ru: 'Добро пожаловать 👋' })}</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            UAT <span className="text-sun">Market</span>
          </h1>
        </div>
        <button
          onClick={() => {
            haptic()
            setLang(nextLang)
          }}
          aria-label="Language"
          className="tap mt-1 flex items-center gap-1 rounded-2xl px-3.5 py-2 font-display font-bold bg-sky text-white shadow-[inset_0_-6px_0_var(--color-sun)]"
        >
          {lang === 'uk' ? 'UA' : 'RU'}
          <ChevronDown size={16} strokeWidth={3} />
        </button>
      </header>

      <button
        onClick={() => go('search')}
        className="tap w-full flex items-center gap-3 rounded-2xl bg-panel/80 border border-line pl-4 pr-1.5 py-1.5 text-mute mb-5 rise"
      >
        <Search size={20} />
        <span className="flex-1 text-left truncate">
          {t({ uk: 'Знайти товар, послугу або сервіс…', ru: 'Найти товар, услугу или сервис…' })}
        </span>
        <span className="h-10 w-10 shrink-0 rounded-xl bg-panel-2 grid place-items-center text-white/90">
          <SlidersHorizontal size={18} />
        </span>
      </button>

      <div className="rounded-3xl p-4 mb-4 rise bg-[linear-gradient(135deg,#1d5fd6,#2f8cff_55%,#4aa3ff)] shadow-[0_20px_40px_-20px_rgba(47,140,255,0.7)]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={() => go('rates')} className="tap flex items-center gap-2 font-display text-sm font-bold uppercase">
            <TrendingUp size={20} strokeWidth={2.4} />
            {t({ uk: 'Курси валют', ru: 'Курсы валют' })}
          </button>
          <button
            onClick={() => {
              haptic()
              reload()
            }}
            className="tap flex items-center gap-1.5 text-[11px] text-white/85"
          >
            {t({ uk: 'Оновлено', ru: 'Обновлено' })}: {data?.date || '…'}
            <RefreshCw size={13} />
          </button>
        </div>
        <button onClick={() => go('rates')} className="tap w-full grid grid-cols-3 gap-2 text-left">
          {top.map((r, i) => (
            <div key={i} className="rounded-2xl bg-[#0b2a6b]/35 border border-white/10 px-2.5 py-2.5 flex gap-2">
              <span className="text-2xl leading-none">{r ? FLAGS[r.code] ?? '' : ''}</span>
              <div className="min-w-0">
                <div className="text-xs text-white/85">{r?.code ?? '—'}</div>
                <div className="font-display text-lg font-bold leading-tight">{r ? fmt(r.rate) : '··,··'}</div>
                {r?.change != null && (
                  <div className={`text-[11px] font-semibold ${r.change < 0 ? 'text-down' : 'text-up'}`}>
                    {r.change < 0 ? '▼' : '▲'} {r.change < 0 ? '−' : '+'}
                    {fmt(Math.abs(r.change))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => go('cards')}
          className="tap rise text-left rounded-3xl p-3 flex items-center gap-2.5 text-white bg-[linear-gradient(135deg,#1d6fe8,#3d9bff)] shadow-[0_16px_32px_-18px_rgba(47,140,255,0.9)]"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/20 grid place-items-center">
            <CreditCard size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold leading-tight">{t({ uk: 'Відкрити карту', ru: 'Открыть карту' })}</div>
            <div className="text-[11px] opacity-90 mt-0.5 truncate">Kraken · Simple · Kolo</div>
          </div>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </button>
        <button
          onClick={() => go('topup')}
          className="tap rise text-left rounded-3xl p-3 flex items-center gap-2.5 text-ink bg-[linear-gradient(135deg,#ffc21a,#ffe066)] shadow-[0_16px_32px_-18px_rgba(255,210,63,0.9)]"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/35 grid place-items-center">
            <Smartphone size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold leading-tight">{t({ uk: 'Поповнити мобільний', ru: 'Пополнить мобильный' })}</div>
            <div className="text-[11px] font-semibold opacity-75 mt-0.5 truncate">Kyivstar · Vodafone · lifecell</div>
          </div>
          <ChevronRight size={18} className="shrink-0 opacity-70" />
        </button>
      </div>

      <Nearby go={go} />

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => {
            haptic()
            openLink(FLIXBUS_URL)
          }}
          className="tap rise text-left rounded-3xl p-3 flex items-center gap-2.5 text-white bg-[linear-gradient(135deg,#3fae0a,#73d700)]"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/20 grid place-items-center">
            <Bus size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold">Flixbus</div>
            <div className="text-[11px] opacity-90 mt-0.5 leading-tight">
              {t({ uk: 'Автобусні квитки по Європі', ru: 'Автобусные билеты по Европе' })}
            </div>
          </div>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </button>
        <button
          onClick={() => go('telegram')}
          className="tap rise text-left rounded-3xl p-3 flex items-center gap-2.5 text-white bg-[linear-gradient(135deg,#1d8fd6,#33aef0)]"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/20 grid place-items-center">
            <Send size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold">Telegram</div>
            <div className="text-[11px] opacity-90 mt-0.5 leading-tight">
              {t({ uk: 'Групи та канали', ru: 'Группы и каналы' })}
            </div>
          </div>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {tiles.map((s, i) => (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            style={{ animationDelay: `${60 * i}ms` }}
            className={`tap rise text-left rounded-3xl bg-panel border border-line p-4 ${
              i === tiles.length - 1 && tiles.length % 2 ? 'col-span-2 flex items-center gap-4' : ''
            }`}
          >
            <div className="text-3xl mb-2">{s.emoji}</div>
            <div>
              <div className="font-bold">{t(s.title)}</div>
              <div className="text-xs text-mute mt-0.5">{t(s.hint)}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => go('calendar')}
        className="tap w-full text-left rounded-3xl p-4 border border-sun/30 bg-sun/10 flex items-center gap-4 rise"
      >
        <div className="rounded-2xl bg-sun text-ink px-3 py-2 text-center min-w-16">
          <div className="font-display text-xl font-bold leading-none">{next.days}</div>
          <div className="text-[10px] font-bold uppercase">
            {t({ uk: 'днів', ru: 'дней' })}
          </div>
        </div>
        <div>
          <div className="text-xs text-sun font-semibold">
            {t({ uk: 'Сьогодні', ru: 'Сегодня' })} {dayMonth(lang, today.getDate(), today.getMonth())} ·{' '}
            {t({ uk: 'найближче свято', ru: 'ближайший праздник' })}
          </div>
          <div className="font-bold">{t(next.holiday.title)}</div>
          <div className="text-xs text-mute">
            {dayMonth(lang, next.date.getDate(), next.date.getMonth())}
          </div>
        </div>
      </button>

      <button
        onClick={() => go('info')}
        className="tap w-full mt-3 flex items-center gap-3 rounded-2xl bg-panel border border-line px-4 py-3.5 text-left rise"
      >
        <Info size={18} className="text-sky shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">{t({ uk: 'Про застосунок', ru: 'О приложении' })}</span>
          <span className="block text-xs text-mute truncate">
            {t({ uk: 'Про нас · Підтримка · Політика · Умови', ru: 'О нас · Поддержка · Политика · Условия' })}
          </span>
        </span>
        <ChevronRight size={18} className="text-mute" />
      </button>
    </div>
  )
}

type Chip = 'goods' | 'services' | 'shops' | 'ads'
const CHIPS: { id: Chip; label: Tr; Icon: typeof ShoppingBag }[] = [
  { id: 'goods', label: { uk: 'Товари', ru: 'Товары' }, Icon: ShoppingBag },
  { id: 'services', label: { uk: 'Послуги', ru: 'Услуги' }, Icon: Wrench },
  { id: 'shops', label: { uk: 'Магазини', ru: 'Магазины' }, Icon: Store },
  { id: 'ads', label: { uk: 'Оголошення', ru: 'Объявления' }, Icon: Megaphone },
]

interface Item {
  id: string
  title: string
  price: string
  sub: string
  photo: string | null
  createdAt: string
  to: Screen
}

const NEW_MS = 3 * 24 * 3600_000

// "Знайти поруч": a preview of the latest ads and catalog cards, filtered by chip.
function Nearby({ go }: { go: Go }) {
  const { t } = useI18n()
  const [chip, setChip] = useState<Chip>('goods')
  const [ads, setAds] = useState<AdView[] | null>(null)
  const { places } = usePlaces()

  useEffect(() => {
    listAds({ data: { initData: initData() } })
      .then((r) => setAds(r.ads))
      .catch(() => setAds([]))
  }, [])

  const items: Item[] | null = useMemo(() => {
    if (chip === 'goods' || chip === 'ads') {
      if (!ads) return null
      return ads
        .filter((a) => chip === 'ads' || a.price != null)
        .map((a) => ({
          id: a.id,
          title: a.title,
          price: a.price != null ? `${a.price.toLocaleString('uk-UA')} грн` : '',
          sub: a.description,
          photo: a.photoUrl,
          createdAt: a.createdAt,
          to: 'ads' as const,
        }))
    }
    if (!places) return null
    return places
      .filter((p) => (chip === 'shops' ? p.category === 'shop' : p.category !== 'shop'))
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        sub: `${category(p.category).emoji} ${t(category(p.category).label)}`,
        photo: p.coverUrl ?? p.photoUrl,
        createdAt: p.createdAt,
        to: 'map' as const,
      }))
  }, [chip, ads, places, t])

  const shown = items?.slice(0, 4)

  return (
    <section className="mb-5 rise">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <MapPin size={24} className="text-sky" fill="currentColor" stroke="var(--color-ink)" />
          {t({ uk: 'Знайти поруч', ru: 'Найти рядом' })}
        </h2>
        <button onClick={() => go('map')} className="tap flex items-center gap-0.5 text-sm font-semibold text-sky">
          {t({ uk: 'Усі категорії', ru: 'Все категории' })}
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="no-scrollbar -mx-4 px-4 flex gap-2 overflow-x-auto mb-3">
        {CHIPS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => {
              haptic()
              setChip(id)
            }}
            className={`tap shrink-0 flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold ${
              chip === id ? 'bg-sky border-sky text-white' : 'bg-panel/70 border-line text-white/90'
            }`}
          >
            <Icon size={17} />
            {t(label)}
          </button>
        ))}
      </div>

      {!shown ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-3xl bg-panel border border-line overflow-hidden">
              <div className="skeleton h-32 !rounded-none" />
              <div className="p-3 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <button
          onClick={() => go(chip === 'goods' || chip === 'ads' ? 'ads' : 'map')}
          className="tap w-full rounded-3xl bg-panel border border-dashed border-line p-5 text-center text-sm text-mute"
        >
          {t({ uk: 'Поки що порожньо — додайте перше!', ru: 'Пока пусто — добавьте первое!' })}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((it) => (
            <button
              key={it.id}
              onClick={() => go(it.to)}
              className="tap text-left rounded-3xl bg-panel border border-line overflow-hidden flex flex-col"
            >
              <div className="relative h-32 bg-panel-2 grid place-items-center text-4xl">
                {it.photo ? (
                  <img src={it.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  '🛍'
                )}
                {Date.now() - new Date(it.createdAt).getTime() < NEW_MS && (
                  <span className="absolute top-2 left-2 rounded-xl bg-sky px-2 py-0.5 text-[11px] font-bold">
                    {t({ uk: 'Новинка', ru: 'Новинка' })}
                  </span>
                )}
              </div>
              <div className="p-3 flex-1 flex items-end gap-1">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{it.title}</div>
                  {it.price && <div className="font-display font-bold text-sun truncate">{it.price}</div>}
                  <div className="text-xs text-mute truncate mt-0.5">{it.sub}</div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-mute" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
