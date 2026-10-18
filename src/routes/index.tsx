import { createFileRoute } from '@tanstack/react-router'
import { FileText, Home as HomeIcon, Menu, ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Home from '../components/screens/Home'
import Rates from '../components/screens/Rates'
import Banks from '../components/screens/Banks'
import Docs from '../components/screens/Docs'
import Calc from '../components/screens/Calc'
import NovaPoshta from '../components/screens/NovaPoshta'
import TelegramScreen from '../components/screens/TelegramScreen'
import CalendarScreen from '../components/screens/CalendarScreen'
import CardsScreen from '../components/screens/CardsScreen'
import TopUp from '../components/screens/TopUp'
import MenuScreen from '../components/screens/MenuScreen'
import AdsScreen from '../components/screens/AdsScreen'
import CartScreen from '../components/screens/CartScreen'
import NewsScreen from '../components/screens/NewsScreen'
import InfoScreen from '../components/screens/InfoScreen'
import MapScreen from '../components/screens/MapScreen'
import StoreScreen from '../components/screens/StoreScreen'
import SearchScreen, { type OpenTarget } from '../components/screens/SearchScreen'
import type { Screen } from '../lib/nav'
import { LANGS, LangProvider, useI18n, type Tr } from '../lib/i18n'
import { haptic, initTelegram, startParam, tg } from '../lib/telegram'
import { normalizeStoreKey } from '../lib/places'
import { useCart } from '../lib/cart'

// `?store=<username>` opens a seller's storefront directly.
export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { store?: string } =>
    typeof s.store === 'string' && normalizeStoreKey(s.store) ? { store: normalizeStoreKey(s.store) } : {},
  component: App,
})

const TABS: { id: Screen; label: Tr; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: { uk: 'Головна', ru: 'Главная' }, Icon: HomeIcon },
  { id: 'menu', label: { uk: 'Меню', ru: 'Меню' }, Icon: Menu },
  { id: 'docs', label: { uk: 'Документи', ru: 'Документы' }, Icon: FileText },
  { id: 'cart', label: { uk: 'Кошик', ru: 'Корзина' }, Icon: ShoppingCart },
]

function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  )
}

function LangSwitch() {
  const { lang, setLang } = useI18n()
  return (
    <div className="flex gap-0.5 p-0.5 rounded-xl bg-panel border border-line" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.value}
          onClick={() => {
            haptic()
            setLang(l.value)
          }}
          aria-pressed={lang === l.value}
          className={`tap px-2.5 py-1 rounded-lg text-xs font-bold ${
            lang === l.value ? 'bg-sky text-white' : 'text-mute'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function Shell() {
  const { t } = useI18n()
  const cart = useCart()
  const { store } = Route.useSearch()
  const [target, setTarget] = useState<OpenTarget>(store ? { screen: 'store', store } : { screen: 'home' })
  const screen = target.screen

  const open = useCallback((t: OpenTarget) => {
    haptic()
    setTarget(t)
    window.scrollTo({ top: 0 })
  }, [])
  const go = useCallback((s: Screen) => open({ screen: s }), [open])

  useEffect(() => {
    initTelegram()
    // Deep links: t.me/<bot>/<app>?startapp=store_<username> or startapp=map.
    const start = startParam()
    const key = start.startsWith('store_') ? normalizeStoreKey(start.slice(6)) : ''
    if (key) setTarget({ screen: 'store', store: key })
    else if (start === 'map') setTarget({ screen: 'map' })
  }, [])

  // Telegram's native back button returns to the home screen.
  useEffect(() => {
    const back = tg()?.BackButton
    if (!back) return
    const onBack = () => go('home')
    if (screen === 'home') back.hide()
    else back.show()
    back.onClick(onBack)
    return () => back.offClick(onBack)
  }, [screen, go])

  return (
    <div className="mx-auto max-w-md min-h-screen px-4 pt-3 pb-28">
      {/* Home has its own language button in the greeting header. */}
      {screen !== 'home' && (
        <header className="flex justify-end mb-3">
          <LangSwitch />
        </header>
      )}
      <main key={JSON.stringify(target)} className="rise">
        {screen === 'home' && <Home go={go} />}
        {screen === 'search' && <SearchScreen open={open} />}
        {screen === 'rates' && <Rates />}
        {screen === 'banks' && <Banks initialQuery={target.bankQuery} />}
        {screen === 'docs' && <Docs />}
        {screen === 'calc' && <Calc />}
        {screen === 'np' && <NovaPoshta />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'cards' && <CardsScreen />}
        {screen === 'telegram' && <TelegramScreen />}
        {screen === 'topup' && <TopUp />}
        {screen === 'menu' && <MenuScreen go={go} addPlace={() => open({ screen: 'map', mapAdd: true })} />}
        {screen === 'ads' && <AdsScreen />}
        {screen === 'cart' && <CartScreen open={open} />}
        {screen === 'news' && <NewsScreen />}
        {screen === 'info' && <InfoScreen go={go} />}
        {screen === 'map' && <MapScreen startAdd={target.mapAdd} openStore={(key) => open({ screen: 'store', store: key })} />}
        {screen === 'store' && target.store && <StoreScreen storeKey={target.store} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 px-3 bg-ink/85 backdrop-blur-xl border-t border-line">
        <div className="mx-auto max-w-md grid grid-cols-4">
          {TABS.map(({ id, label, Icon }) => {
            const active = screen === id
            return (
              <button
                key={id}
                onClick={() => go(id)}
                className={`tap relative flex flex-col items-center gap-1 py-1 text-[11px] leading-tight text-center font-semibold ${
                  active ? 'text-sun' : 'text-mute'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {id === 'cart' && cart.items.length > 0 && (
                  <span className="absolute top-0 right-[calc(50%-18px)] min-w-4 h-4 px-1 rounded-full bg-down text-white text-[10px] font-bold grid place-items-center">
                    {cart.items.length > 99 ? '99+' : cart.items.length}
                  </span>
                )}
                <span className="max-w-full truncate px-0.5">{t(label)}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
