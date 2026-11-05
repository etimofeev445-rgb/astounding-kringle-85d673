import { CATEGORIES, isCategory, type PlaceCategory } from './places'
import { ALL_SCREENS, SCREENS, type Screen } from './nav'

// Admin-editable app configuration. Shared by the client (rendering) and the server (sanitizing what
// the admin saves). Without a saved config the defaults below reproduce the stock app.

export type HomeSection = 'search' | 'banners' | 'quick' | 'categories' | 'nearby' | 'links' | 'tiles' | 'info'
export type Tab = 'menu' | 'docs' | 'cart'

export interface Toggle<T extends string> {
  id: T
  enabled: boolean
}

// What a menu entry does when tapped: open an in-app page, an external https link, a Telegram bot,
// or expand an information block with plain text.
export type MenuAction = 'screen' | 'link' | 'bot' | 'info'

// One entry of the «Розділи» list in the Меню tab. Built-in entries (id = a screen id) keep their
// action and target; the text fields override the stock texts when non-empty. Custom entries
// (`custom` ids) are fully editable and can be deleted.
export interface MenuItem {
  id: string
  enabled: boolean
  emoji: string
  title: string
  titleRu: string
  hint: string
  hintRu: string
  action: MenuAction
  // screen id | https:// URL | https://t.me/<bot> | optional https:// URL of an info block's button.
  target: string
  // Plain text of an info block (never rendered as HTML).
  body: string
  buttonText: string
  // Links and bots: inside Telegram (in-app viewer / t.me) or the external browser.
  openIn: 'app' | 'external'
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
    // Items of the "Розділи" list in the Меню tab: built-in screens and custom entries, in display order.
    items: MenuItem[]
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


const MENU_ACTIONS: MenuAction[] = ['screen', 'link', 'bot', 'info']
export const MENU_ID_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/
export const MAX_CUSTOM_MENU_ITEMS = 30
// Pages a custom entry may open (the menu itself, the home page and storefronts make no sense here).
export const LINKABLE_SCREENS: Screen[] = ALL_SCREENS.filter((id) => id !== 'home' && id !== 'menu' && id !== 'store')
const isLinkableScreen = (v: unknown): v is Screen => LINKABLE_SCREENS.some((id) => id === v)

export const isBuiltinMenuId = (id: string): id is Screen => SCREENS.some((s) => s.id === id)

export function builtinMenuItem(id: Screen): MenuItem {
  return { id, enabled: true, emoji: '', title: '', titleRu: '', hint: '', hintRu: '', action: 'screen', target: id, body: '', buttonText: '', openIn: 'app' }
}

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
    items: SCREENS.map((s) => builtinMenuItem(s.id)),
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
// Menu links: https only, no credentials in the URL, no whitespace, bounded length.
export const isSafeHttpsUrl = (v: string) => {
  if (!v || v.length > 500 || /\s/.test(v)) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.')
  } catch {
    return false
  }
}

// `@name`, `name`, `t.me/name` or `https://t.me/name[?start=x]` → `https://t.me/name[?start=x]`, '' if invalid.
export function botUrl(raw: string): string {
  const m = /^(?:@|(?:https:\/\/)?(?:t|telegram)\.me\/)?([A-Za-z][A-Za-z0-9_]{4,31})(\?start=[A-Za-z0-9_-]{1,64})?$/.exec(raw.trim())
  return m ? `https://t.me/${m[1]}${m[2] ?? ''}` : ''
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

// ── Menu items ───────────────────────────────────────────────────────────────────────────────

// Coerces anything into a well-formed MenuItem without judging it: built-ins keep their fixed action
// and target, custom entries keep what was typed (so errors can be reported) up to the length limits.
export function normalizeMenuItem(raw: unknown): MenuItem {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MenuItem>
  const id = str(r.id, 30)
  const common = {
    id,
    enabled: bool(r.enabled, true),
    emoji: str(r.emoji, 8),
    title: str(r.title, 60),
    titleRu: str(r.titleRu, 60),
    hint: str(r.hint, 120),
    hintRu: str(r.hintRu, 120),
    buttonText: str(r.buttonText, 30),
    openIn: r.openIn === 'external' ? ('external' as const) : ('app' as const),
  }
  if (isBuiltinMenuId(id)) return { ...common, action: 'screen', target: id, body: '' }
  const action = MENU_ACTIONS.find((a) => a === r.action) ?? 'link'
  return { ...common, action, target: str(r.target, 500), body: str(r.body, 2000) }
}

// '' when the entry is valid. Built-in entries can always be saved (only texts and visibility change).
export function menuItemError(item: MenuItem): string {
  if (isBuiltinMenuId(item.id)) return ''
  if (!MENU_ID_RE.test(item.id)) return 'Ідентифікатор: 2–30 символів, малі латинські літери, цифри, «-» і «_»'
  if (ALL_SCREENS.some((id) => id === item.id)) return 'Цей ідентифікатор зарезервовано'
  if (!item.title) return 'Вкажіть назву'
  if (item.action === 'screen') return isLinkableScreen(item.target) ? '' : 'Оберіть внутрішню сторінку'
  if (item.action === 'link') return isSafeHttpsUrl(item.target) ? '' : 'Посилання має починатися з https:// і бути коректним'
  if (item.action === 'bot') return botUrl(item.target) ? '' : 'Вкажіть @username бота (5–32 символи) або посилання t.me/…'
  if (!item.body) return 'Додайте текст інформаційного блоку'
  if (item.target && !isSafeHttpsUrl(item.target)) return 'Посилання кнопки має починатися з https://'
  return ''
}

// The entry as it is stored once it passed menuItemError (bot handles become canonical t.me links).
export function finalizeMenuItem(item: MenuItem): MenuItem {
  if (isBuiltinMenuId(item.id)) return item
  if (item.action === 'bot') return { ...item, target: botUrl(item.target) }
  if (item.action === 'info') return { ...item, openIn: item.target ? item.openIn : 'app' }
  if (item.action === 'screen') return { ...item, openIn: 'app' }
  return item
}

// Every problem in an admin-submitted list, as human-readable lines (used by the form and the server).
export function menuListErrors(raw: unknown): string[] {
  const errors: string[] = []
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  let custom = 0
  for (const r of list) {
    const item = normalizeMenuItem(r)
    const name = `«${item.title || item.id || 'без назви'}»`
    if (seen.has(item.id) && item.id) errors.push(`${name}: ідентифікатор «${item.id}» повторюється`)
    seen.add(item.id)
    if (!isBuiltinMenuId(item.id)) custom++
    const e = menuItemError(item)
    if (e) errors.push(`${name}: ${e}`)
  }
  if (custom > MAX_CUSTOM_MENU_ITEMS) errors.push(`Забагато власних пунктів (максимум ${MAX_CUSTOM_MENU_ITEMS})`)
  return errors
}

// Keeps the stored order, drops invalid or repeated custom entries and unknown ids, and appends
// built-in sections missing from the list (added in later versions).
export function sanitizeMenuItems(raw: unknown): MenuItem[] {
  const out: MenuItem[] = []
  const seen = new Set<string>()
  let custom = 0
  for (const r of Array.isArray(raw) ? raw : []) {
    const item = normalizeMenuItem(r)
    if (!item.id || seen.has(item.id)) continue
    if (!isBuiltinMenuId(item.id)) {
      if (menuItemError(item) || custom >= MAX_CUSTOM_MENU_ITEMS) continue
      custom++
    }
    seen.add(item.id)
    out.push(finalizeMenuItem(item))
  }
  for (const s of SCREENS) if (!seen.has(s.id)) out.push(builtinMenuItem(s.id))
  return out
}

export interface MenuView {
  emoji: string
  title: string
  hint: string
}

// Texts of a menu entry in the given language: admin overrides first, then the stock texts of a
// built-in section. Custom entries without a Russian text fall back to the Ukrainian one.
export function menuItemView(item: MenuItem, lang: 'uk' | 'ru'): MenuView {
  const base = SCREENS.find((s) => s.id === item.id)
  const ru = lang === 'ru'
  return {
    emoji: item.emoji || base?.emoji || '🔗',
    title: (ru ? item.titleRu || (base ? base.title.ru : item.title) : item.title || base?.title.uk) || item.id,
    hint: (ru ? item.hintRu || (base ? base.hint.ru : item.hint) : item.hint || base?.hint.uk) || '',
  }
}

// Look of a built-in section (menu, home tiles) with the admin's overrides applied.
export function screenView(config: AppConfig, id: Screen, lang: 'uk' | 'ru'): MenuView {
  const item = config.menu.items.find((i) => i.id === id) ?? builtinMenuItem(id)
  return menuItemView(item, lang)
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
      items: sanitizeMenuItems(menu.items),
      tabs: toggles(menu.tabs, d.menu.tabs),
      disabledScreens: Array.isArray(menu.disabledScreens) ? [...new Set(menu.disabledScreens.filter(isScreen))] : [],
    },
  }
}

export const categoryOrder = (ids: PlaceCategory[]) => ids.map((id) => CATEGORIES.find((c) => c.id === id)!).filter(Boolean)
