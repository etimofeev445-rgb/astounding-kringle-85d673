import type { Tr } from './i18n'

// Shared by the catalog/storefront screens and src/server/places.ts.
export const PLACE_LIMITS = {
  title: 80,
  country: 60,
  city: 60,
  description: 1000,
  hours: 200,
  price: 1000,
  mapUrl: 500,
  photoBytes: 2_500_000,
  // Client-side upload budgets: logo + cover base64 must stay well under the ~6 MB function body limit.
  logoUploadBytes: 600_000,
  coverUploadBytes: 1_500_000,
  perUser: 10,
}

export const CATEGORIES = [
  { id: 'shop', emoji: '🛒', color: '#2f8cff', label: { uk: 'Магазини', ru: 'Магазины' } },
  { id: 'beauty', emoji: '✂️', color: '#ff5ca8', label: { uk: 'Салони краси', ru: 'Салоны красоты' } },
  { id: 'housing', emoji: '🏠', color: '#3ddc97', label: { uk: 'Житло', ru: 'Жильё' } },
  { id: 'cafe', emoji: '☕', color: '#ffb13d', label: { uk: 'Кафе', ru: 'Кафе' } },
  { id: 'services', emoji: '🛠', color: '#9b6bff', label: { uk: 'Послуги', ru: 'Услуги' } },
  { id: 'jobs', emoji: '💼', color: '#ffd23f', label: { uk: 'Робота', ru: 'Работа' } },
  { id: 'auto', emoji: '🚗', color: '#ff6b5c', label: { uk: 'Авто', ru: 'Авто' } },
] as const satisfies readonly { id: string; emoji: string; color: string; label: Tr }[]

export type PlaceCategory = (typeof CATEGORIES)[number]['id']

export const isCategory = (v: string): v is PlaceCategory => CATEGORIES.some((c) => c.id === v)
export const category = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[4] // services

export interface PlaceView {
  id: string
  storeKey: string
  category: PlaceCategory
  country: string
  city: string
  title: string
  description: string
  hours: string
  price: string
  mapUrl: string
  phone: string
  instagram: string
  tgContact: string
  // Logo and cover.
  photoUrl: string | null
  coverUrl: string | null
  // Public link to the post in the catalog channel, when the channel has a @username.
  postUrl: string | null
  createdAt: string
  mine: boolean
}

export interface PlaceInput {
  category: PlaceCategory
  country: string
  city: string
  title: string
  description: string
  hours: string
  price: string
  mapUrl: string
  phone: string
  instagram: string
  tgContact: string
}

// Suggestions for the "Країна" / "Місто" fields; any other value can be typed in as well.
export const COUNTRIES: Record<string, string[]> = {
  'Україна': ['Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Запоріжжя', 'Вінниця', 'Івано-Франківськ', 'Тернопіль', 'Ужгород', 'Чернівці', 'Луцьк', 'Рівне', 'Житомир', 'Полтава', 'Черкаси', 'Чернігів', 'Суми', 'Хмельницький', 'Миколаїв', 'Кропивницький', 'Херсон'],
  'Польща': ['Варшава', 'Краків', 'Вроцлав', 'Гданськ', 'Познань', 'Лодзь', 'Катовіце', 'Люблін', 'Щецін', 'Жешув'],
  'Німеччина': ['Берлін', 'Мюнхен', 'Гамбург', 'Франкфурт-на-Майні', 'Кельн', 'Дюссельдорф', 'Штутгарт', 'Лейпциг', 'Дрезден'],
  'Чехія': ['Прага', 'Брно', 'Острава', 'Пльзень'],
  'Словаччина': ['Братислава', 'Кошице'],
  'Румунія': ['Бухарест', 'Сучава', 'Клуж-Напока'],
  'Молдова': ['Кишинів', 'Бєльці'],
  'Литва': ['Вільнюс', 'Каунас'],
  'Латвія': ['Рига'],
  'Естонія': ['Таллінн', 'Тарту'],
  'Австрія': ['Відень', 'Грац', 'Зальцбург'],
  'Швейцарія': ['Цюрих', 'Женева', 'Берн', 'Базель'],
  'Італія': ['Рим', 'Мілан', 'Неаполь', 'Турин', 'Болонья'],
  'Іспанія': ['Мадрид', 'Барселона', 'Валенсія', 'Аліканте', 'Малага'],
  'Португалія': ['Лісабон', 'Порту'],
  'Франція': ['Париж', 'Ліон', 'Марсель', 'Ніцца'],
  'Нідерланди': ['Амстердам', 'Роттердам', 'Гаага'],
  'Бельгія': ['Брюссель', 'Антверпен'],
  'Ірландія': ['Дублін', 'Корк'],
  'Велика Британія': ['Лондон', 'Манчестер', 'Бірмінгем', 'Единбург'],
  'Данія': ['Копенгаген'],
  'Швеція': ['Стокгольм', 'Гетеборг'],
  'Норвегія': ['Осло', 'Берген'],
  'Фінляндія': ['Гельсінкі'],
  'Туреччина': ['Стамбул', 'Анталія', 'Анкара'],
  'Ізраїль': ['Тель-Авів', 'Хайфа', 'Єрусалим'],
  'Грузія': ['Тбілісі', 'Батумі'],
  'ОАЕ': ['Дубай', 'Абу-Дабі'],
  'США': ['Нью-Йорк', 'Чикаго', 'Лос-Анджелес', 'Маямі', 'Сіетл'],
  'Канада': ['Торонто', 'Монреаль', 'Ванкувер', 'Едмонтон', 'Вінніпег', 'Калгарі'],
}

export const placeLocation = (p: Pick<PlaceInput, 'country' | 'city'>) => [p.country, p.city].filter(Boolean).join(', ')

// Lowercased haystack for the catalog search: every text field of a card, plus both category
// labels, the decoded map link (address searches are URL-encoded) and the phone's bare digits.
export function placeSearchText(p: PlaceView) {
  const c = category(p.category)
  let map = p.mapUrl
  try {
    map = decodeURIComponent(p.mapUrl.replace(/\+/g, ' '))
  } catch {}
  return [
    p.title,
    c.label.uk,
    c.label.ru,
    p.description,
    p.country,
    p.city,
    p.hours,
    p.price,
    p.phone,
    p.phone.replace(/\D/g, ''),
    p.instagram,
    p.tgContact,
    p.mapUrl,
    map,
  ]
    .join('\n')
    .toLowerCase()
}

// Storefront keys: a Telegram username (lowercased) or `id<telegram id>` for users without one.
export const normalizeStoreKey = (v: string) => {
  const s = v.trim().replace(/^@/, '').toLowerCase()
  return /^([a-z][a-z0-9_]{4,31}|id\d{5,15})$/.test(s) ? s : ''
}

export const normalizeInstagram = (v: string) => {
  const s = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : ''
}

// "Прямий лінк на адресу": any http(s) link (Google Maps, Apple Maps, Waze…) is kept as is;
// plain text is treated as an address and turned into an official Google Maps search link.
export function normalizeMapUrl(v: string) {
  const s = v.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
    } catch {
      return ''
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`
}

// Telegram contact: @username or a t.me link → "@username".
export const normalizeTg = (v: string) => {
  const s = v.trim().replace(/^https?:\/\/(www\.)?t\.me\//i, '').replace(/^@/, '').replace(/\/.*$/, '')
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s) ? `@${s}` : ''
}

export const tgUsername = (tgContact: string) => (tgContact.startsWith('@') ? tgContact.slice(1) : '')
