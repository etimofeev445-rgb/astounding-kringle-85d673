import { CATEGORIES, isCategory, type PlaceCategory } from './places'
import { SCREENS, type Screen } from './nav'

// Admin-editable app configuration. Shared by the client (rendering) and the server (sanitizing what
// the admin saves). Without a saved config the defaults below reproduce the stock app.

export type HomeSection = 'search' | 'banners' | 'quick' | 'categories' | 'nearby' | 'links' | 'tiles' | 'info'
export type Tab = 'menu' | 'docs' | 'cart'

export interface Toggle<T extends string> {
  id: T
  enabled: boolean
}

export interface Banner {
  id: string
  title: string
  text: string
  imageUrl: string
  // https:// link, or `screen:<id>` to open an app section.
  link: string
  enabled: boolean
}

export interface AppConfig {
  appName: string
  // '' = the stock "UAT Market" wordmark.
  logoUrl: string
  contacts: { supportHandle: string; supportUrl: string; email: string; phone: string }
  display: { defaultLang: 'uk' | 'ru'; showGreeting: boolean; showLangSwitch: boolean }
  features: { cart: boolean; adsPosting: boolean; catalogPosting: boolean; reports: boolean }
  home: {
    sections: Toggle<HomeSection>[]
    // Tiles in the "tiles" grid, in display order.
    cards: Toggle<Screen>[]
    banners: Banner[]
    categories: PlaceCategory[]
  }
  menu: {
    // Items of the "Розділи" list in the Меню tab.
    items: Toggle<Screen>[]
    tabs: Toggle<Tab>[]
    // Sections that can't be opened at all (from anywhere).
    disabledScreens: Screen[]
  }
}

export const HOME_SECTIONS: { id: HomeSection; label: string }[] = [
  { id: 'search', label: 'Пошук' },
  { id: 'banners', label: 'Банери' },
  { id: 'quick', label: 'Картка та поповнення' },
  { id: 'categories', label: 'Популярні категорії' },
  { id: 'nearby', label: 'Знайти поруч (товари, послуги, оголошення)' },
  { id: 'links', label: 'Flixbus і Telegram' },
  { id: 'tiles', label: 'Плитки розділів' },
  { id: 'info', label: 'Про застосунок' },
]

export const TABS: { id: Tab; label: string }[] = [
  { id: 'menu', label: 'Меню' },
  { id: 'docs', label: 'Документи' },
  { id: 'cart', label: 'Кошик' },
]

// Removed from the home page: they stay in the app (menu, search, tabs) but no longer show as home tiles.
const HIDDEN_HOME_TILES: Screen[] = ['rates', 'banks', 'docs', 'calc', 'np', 'calendar']
const HOME_TILE_SCREENS = SCREENS.map((s) => s.id).filter((id) => id !== 'search' && id !== 'cards' && id !== 'info')

export const DEFAULT_CONFIG: AppConfig = {
  appName: 'UAT Market',
  logoUrl: '',
  contacts: { supportHandle: '@UATmarket', supportUrl: 'https://t.me/UATmarket', email: '', phone: '' },
  display: { defaultLang: 'uk', showGreeting: true, showLangSwitch: true },
  features: { cart: true, adsPosting: true, catalogPosting: true, reports: true },
  home: {
    sections: HOME_SECTIONS.map((s) => ({ id: s.id, enabled: true })),
    cards: HOME_TILE_SCREENS.map((id) => ({ id, enabled: !HIDDEN_HOME_TILES.includes(id) })),
    banners: [],
    categories: ['shop', 'beauty', 'cafe', 'services', 'housing', 'jobs', 'auto'],
  },
  menu: {
    items: SCREENS.map((s) => ({ id: s.id, enabled: true })),
    tabs: TABS.map((t) => ({ id: t.id, enabled: true })),
    disabledScreens: [],
  },
}

const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

export const isHttpsUrl = (v: string) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}
// Images uploaded in the admin panel are served from this same site.
const isImageUrl = (v: string) => v === '' || v.startsWith('/api/assets/') || isHttpsUrl(v)
const isScreen = (v: unknown): v is Screen => SCREENS.some((s) => s.id === v)

// Keeps the stored order and enabled flags, drops unknown ids and appends ids added in later versions.
function toggles<T extends string>(raw: unknown, defaults: Toggle<T>[]): Toggle<T>[] {
  const known = new Map(defaults.map((d) => [d.id, d]))
  const out: Toggle<T>[] = []
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const id = (r as Toggle<T>)?.id
      if (!known.has(id) || out.some((o) => o.id === id)) continue
      out.push({ id, enabled: bool((r as Toggle<T>).enabled, known.get(id)!.enabled) })
    }
  }
  for (const d of defaults) if (!out.some((o) => o.id === d.id)) out.push({ ...d })
  return out
}

export function sanitizeBanner(raw: Partial<Banner>, i = 0): Banner | null {
  const link = str(raw.link, 500)
  const imageUrl = str(raw.imageUrl, 500)
  const banner: Banner = {
    id: str(raw.id, 40) || `b${Date.now().toString(36)}${i}`,
    title: str(raw.title, 80),
    text: str(raw.text, 200),
    imageUrl: isImageUrl(imageUrl) ? imageUrl : '',
    link: link === '' || isHttpsUrl(link) || (link.startsWith('screen:') && isScreen(link.slice(7))) ? link : '',
    enabled: bool(raw.enabled, true),
  }
  return banner.title || banner.imageUrl ? banner : null
}

export function sanitizeConfig(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppConfig>
  const d = DEFAULT_CONFIG
  const contacts = (r.contacts ?? {}) as Partial<AppConfig['contacts']>
  const display = (r.display ?? {}) as Partial<AppConfig['display']>
  const features = (r.features ?? {}) as Partial<AppConfig['features']>
  const home = (r.home ?? {}) as Partial<AppConfig['home']>
  const menu = (r.menu ?? {}) as Partial<AppConfig['menu']>
  const logoUrl = str(r.logoUrl, 500)
  const supportUrl = str(contacts.supportUrl, 300, d.contacts.supportUrl)
  const categories = Array.isArray(home.categories)
    ? [...new Set(home.categories.filter((c): c is PlaceCategory => typeof c === 'string' && isCategory(c)))]
    : d.home.categories
  return {
    appName: str(r.appName, 40) || d.appName,
    logoUrl: isImageUrl(logoUrl) ? logoUrl : '',
    contacts: {
      supportHandle: str(contacts.supportHandle, 60, d.contacts.supportHandle),
      supportUrl: isHttpsUrl(supportUrl) ? supportUrl : d.contacts.supportUrl,
      email: str(contacts.email, 120),
      phone: str(contacts.phone, 40),
    },
    display: {
      defaultLang: display.defaultLang === 'ru' ? 'ru' : 'uk',
      showGreeting: bool(display.showGreeting, d.display.showGreeting),
      showLangSwitch: bool(display.showLangSwitch, d.display.showLangSwitch),
    },
    features: {
      cart: bool(features.cart, d.features.cart),
      adsPosting: bool(features.adsPosting, d.features.adsPosting),
      catalogPosting: bool(features.catalogPosting, d.features.catalogPosting),
      reports: bool(features.reports, d.features.reports),
    },
    home: {
      sections: toggles(home.sections, d.home.sections),
      cards: toggles(home.cards, d.home.cards),
      banners: (Array.isArray(home.banners) ? home.banners : [])
        .slice(0, 10)
        .map((b, i) => sanitizeBanner(b ?? {}, i))
        .filter((b): b is Banner => !!b),
      categories,
    },
    menu: {
      items: toggles(menu.items, d.menu.items),
      tabs: toggles(menu.tabs, d.menu.tabs),
      disabledScreens: Array.isArray(menu.disabledScreens) ? [...new Set(menu.disabledScreens.filter(isScreen))] : [],
    },
  }
}

export const categoryOrder = (ids: PlaceCategory[]) => ids.map((id) => CATEGORIES.find((c) => c.id === id)!).filter(Boolean)
