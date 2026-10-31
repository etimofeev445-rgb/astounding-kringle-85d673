import { createFileRoute } from '@tanstack/react-router'
import { FileText, Home as HomeIcon, Lock, Menu, ShieldCheck, ShoppingCart } from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
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
import { useAppState } from '../lib/appState'
import type { Tab } from '../lib/appConfig'

// Loaded only after the server has confirmed the admin, so regular users never download it.
const AdminApp = lazy(() => import('../components/admin/AdminApp'))

// `?store=<username>` opens a seller's storefront directly.
export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): { store?: string } =>
    typeof s.store === 'string' && normalizeStoreKey(s.store) ? { store: normalizeStoreKey(s.store) } : {},
  component: App,
})

const TABS: { id: Screen & ('home' | Tab); label: Tr; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: { uk: 'Головна', ru: 'Главная' }, Icon: HomeIcon },
  { id: 'menu', label: { uk: 'Меню', ru: 'Меню' }, Icon: Menu },
  { id: 'docs', label: { uk: 'Документи', ru: 'Документы' }, Icon: FileText },
  { id: 'cart', label: { uk: 'Кошик', ru: 'Корзина' }, Icon: ShoppingCart },
]

function App() {
  const { config } = useAppState()
  return (
    <LangProvider defaultLang={config.display.defaultLang}>
      <Shell />
    </LangProvider>
  )
}

function Unavailable({ onHome }: { onHome: () => void }) {
  const { t } = useI18n()
  return (
    <div className="rounded-3xl bg-panel border border-line p-8 text-center">
      <Lock size={36} className="mx-auto text-mute mb-3" />
      <div className="font-display font-bold mb-1">{t({ uk: 'Розділ тимчасово недоступний', ru: 'Раздел временно недоступен' })}</div>
      <p className="text-sm text-mute mb-5">{t({ uk: 'Спробуйте пізніше.', ru: 'Попробуйте позже.' })}</p>
      <button onClick={onHome} className="tap rounded-2xl px-5 py-3 font-bold bg-sky text-white">
        {t({ uk: 'На головну', ru: 'На главную' })}
      </button>
    </div>
  )
}

function AdminButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Адмін-панель"
      className="tap h-9 w-9 rounded-xl grid place-items-center bg-adm/15 border border-adm/40 text-adm"
    >
      <ShieldCheck size={18} />
    </button>
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
  const { config, admin } = useAppState()
  const [adminOpen, setAdminOpen] = useState(false)
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

  // t.me/<bot>/<app>?startapp=admin opens the panel directly — for the admin only.
  useEffect(() => {
    if (admin && startParam() === 'admin') setAdminOpen(true)
  }, [admin])

  // Telegram's native back button returns to the home screen.
  useEffect(() => {
    const back = tg()?.BackButton
    if (!back || adminOpen) return
    const onBack = () => go('home')
    if (screen === 'home') back.hide()
    else back.show()
    back.onClick(onBack)
    return () => back.offClick(onBack)
  }, [screen, go, adminOpen])

  if (adminOpen && admin) {
    return (
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-mute">Завантаження…</div>}>
        <AdminApp onExit={() => setAdminOpen(false)} />
      </Suspense>
    )
  }

  const openAdmin = () => {
    haptic('medium')
    setAdminOpen(true)
  }
  const tabs = TABS.filter((tab) => tab.id === 'home' || config.menu.tabs.some((c) => c.id === tab.id && c.enabled)).sort(
    (a, b) => config.menu.tabs.findIndex((c) => c.id === a.id) - config.menu.tabs.findIndex((c) => c.id === b.id),
  )
  // Home and the admin entry are always reachable; any other section can be switched off by the admin.
  const locked = screen !== 'home' && config.menu.disabledScreens.includes(screen)

  return (
    <div className="mx-auto max-w-md min-h-screen px-4 pt-3 pb-28">
      {/* Home has its own language button in the greeting header. */}
      {screen !== 'home' ? (
        <header className="flex justify-end items-center gap-2 mb-3">
          {admin && <AdminButton onClick={openAdmin} />}
          {config.display.showLangSwitch && <LangSwitch />}
        </header>
      ) : (
        admin && (
          <div className="flex justify-end -mb-1">
            <AdminButton onClick={openAdmin} />
          </div>
        )
      )}
      <main key={JSON.stringify(target)} className="rise">
        {locked && <Unavailable onHome={() => go('home')} />}
        {!locked && <Screens target={target} go={go} open={open} openAdmin={admin ? openAdmin : undefined} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 px-3 bg-ink/85 backdrop-blur-xl border-t border-line">
        <div className="mx-auto max-w-md grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ id, label, Icon }) => {
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

function Screens({
  target,
  go,
  open,
  openAdmin,
}: {
  target: OpenTarget
  go: (s: Screen) => void
  open: (t: OpenTarget) => void
  openAdmin?: () => void
}) {
  const screen = target.screen
  return (
    <>
      {screen === 'home' && <Home go={go} openMap={(c) => open({ screen: 'map', mapCategory: c })} />}
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
      {screen === 'menu' && <MenuScreen go={go} addPlace={() => open({ screen: 'map', mapAdd: true })} openAdmin={openAdmin} />}
      {screen === 'ads' && <AdsScreen />}
      {screen === 'cart' && <CartScreen open={open} />}
      {screen === 'news' && <NewsScreen />}
      {screen === 'info' && <InfoScreen go={go} />}
      {screen === 'map' && (
        <MapScreen
          startAdd={target.mapAdd}
          initialCategory={target.mapCategory}
          openStore={(key) => open({ screen: 'store', store: key })}
        />
      )}
      {screen === 'store' && target.store && <StoreScreen storeKey={target.store} />}
    </>
  )
}
