// Shared (client + server) definitions for the admin "Автоматизація" section: the modules, their
// settings, schedules and the config sanitizer. Pure code only — no server imports here.

export const MODULE_IDS = [
  'adcheck',
  'users',
  'security',
  'notify',
  'reports',
  'broadcasts',
  'server',
  'webhook',
  'jobs',
  'analytics',
] as const
export type ModuleId = (typeof MODULE_IDS)[number]
export const isModuleId = (v: unknown): v is ModuleId => typeof v === 'string' && (MODULE_IDS as readonly string[]).includes(v)

export type FieldDef =
  | { key: string; label: string; type: 'bool'; default: boolean; hint?: string; group?: string }
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; hint?: string; group?: string }
  | { key: string; label: string; type: 'text'; default: string; max: number; hint?: string; group?: string }
  | { key: string; label: string; type: 'list'; default: string[]; hint?: string; group?: string }

export type ScheduleKind = 'interval' | 'daily' | 'weekly'
export interface Schedule {
  enabled: boolean
  kind: ScheduleKind
  every: number // minutes, for 'interval'
  time: string // HH:MM, start time (daily/weekly) or anchor (interval)
  weekday: number // 0 = Sunday … 6, for 'weekly'
  tz: string
}

export interface ModuleDef {
  id: ModuleId
  title: string
  emoji: string
  description: string
  // Modules sharing a lock group never run at the same time (enforced by the database).
  lockGroup: string
  manual: boolean
  schedule: Schedule | null
  fields: FieldDef[]
}

export interface ModuleConfig {
  enabled: boolean
  settings: Record<string, boolean | number | string | string[]>
  schedule: Schedule | null
  // When the schedule was last enabled/changed: slots before this moment are never run.
  since: string
}

export interface AutomationConfig {
  paused: boolean
  modules: Record<ModuleId, ModuleConfig>
}

// The scheduler is a Netlify scheduled function that wakes up every 5 minutes.
export const TICK_MINUTES = 5
// Intervals that divide a day into equal 5-minute-aligned slots.
export const INTERVALS = [5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720]
export const TIMEZONES = [
  'Europe/Kyiv',
  'Europe/Warsaw',
  'Europe/Berlin',
  'Europe/Prague',
  'Europe/London',
  'Europe/Lisbon',
  'UTC',
  'America/New_York',
  'America/Toronto',
  'America/Los_Angeles',
  'Asia/Dubai',
]
export const WEEKDAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота']

const every = (n: number, time = '00:00'): Schedule => ({ enabled: true, kind: 'interval', every: n, time, weekday: 1, tz: 'Europe/Kyiv' })
const daily = (time: string): Schedule => ({ enabled: true, kind: 'daily', every: 60, time, weekday: 1, tz: 'Europe/Kyiv' })

export const DEFAULT_STOP_WORDS = [
  'передоплата',
  'предоплата',
  'заробіток без вкладень',
  'швидкий заробіток',
  'гарантований дохід',
  'казино',
  'ставки на спорт',
  'закладки',
  'наркотики',
  'інтим',
]
export const DEFAULT_ALLOWED_DOMAINS = [
  't.me',
  'telegram.me',
  'instagram.com',
  'facebook.com',
  'google.com',
  'maps.app.goo.gl',
  'youtube.com',
  'tiktok.com',
  'olx.ua',
  'prom.ua',
  'rozetka.com.ua',
  'privatbank.ua',
  'monobank.ua',
  'diia.gov.ua',
]

export const MODULES: ModuleDef[] = [
  {
    id: 'adcheck',
    title: 'Перевірка оголошень',
    emoji: '🔎',
    description:
      'Перевіряє оголошення й картки бізнесу за вибраними правилами. Знахідки потрапляють у чергу модерації як скарги «🤖 Автоперевірка». Нічого не видаляє і нікого не блокує.',
    lockGroup: 'adcheck',
    manual: true,
    schedule: every(30),
    fields: [
      { key: 'checkNew', label: 'Перевіряти нові публікації одразу', type: 'bool', default: true, group: 'Що перевіряти' },
      { key: 'checkDuplicates', label: 'Повторювані публікації', type: 'bool', default: true, group: 'Що перевіряти' },
      { key: 'checkLinks', label: 'Підозрілі посилання', type: 'bool', default: true, group: 'Що перевіряти' },
      { key: 'checkRequired', label: 'Обовʼязкові поля', type: 'bool', default: true, group: 'Що перевіряти' },
      { key: 'checkText', label: 'Підозрілий текст', type: 'bool', default: true, group: 'Що перевіряти' },
      { key: 'minTitle', label: 'Мін. довжина назви', type: 'number', default: 5, min: 1, max: 60, group: 'Обовʼязкові поля' },
      { key: 'minDescription', label: 'Мін. довжина опису', type: 'number', default: 20, min: 0, max: 500, group: 'Обовʼязкові поля' },
      { key: 'requireContact', label: 'Потрібен контакт (телефон / Telegram / Instagram)', type: 'bool', default: true, group: 'Обовʼязкові поля' },
      { key: 'duplicateDays', label: 'Шукати повтори за, днів', type: 'number', default: 7, min: 1, max: 60, group: 'Повтори' },
      {
        key: 'allowDomains',
        label: 'Дозволені домени',
        type: 'list',
        default: DEFAULT_ALLOWED_DOMAINS,
        hint: 'Через кому. Посилання на інші домени позначаються. Порожньо — не перевіряти домени.',
        group: 'Посилання',
      },
      { key: 'stopWords', label: 'Стоп-слова', type: 'list', default: DEFAULT_STOP_WORDS, hint: 'Через кому, без урахування регістру', group: 'Текст' },
      { key: 'capsPercent', label: 'Великі літери, % (0 — не перевіряти)', type: 'number', default: 70, min: 0, max: 100, group: 'Текст' },
    ],
  },
  {
    id: 'users',
    title: 'Моніторинг користувачів',
    emoji: '👥',
    description: 'Шукає незвичну активність: забагато публікацій від одного автора, багато скарг на автора, сплеск реєстрацій. Лише повідомляє.',
    lockGroup: 'users',
    manual: true,
    schedule: every(60),
    fields: [
      { key: 'maxPostsPerDay', label: 'Публікацій від автора за 24 год', type: 'number', default: 5, min: 1, max: 100 },
      { key: 'maxReportsAgainst', label: 'Скарг на автора за 7 днів', type: 'number', default: 3, min: 1, max: 100 },
      { key: 'signupsPerHour', label: 'Нових користувачів за годину', type: 'number', default: 50, min: 1, max: 100_000 },
    ],
  },
  {
    id: 'security',
    title: 'Моніторинг безпеки',
    emoji: '🛡',
    description:
      'Рахує відмови у доступі до панелі, запити до webhook з невірним секретом, спроби публікації заблокованими користувачами та масові скарги. Лише повідомляє.',
    lockGroup: 'security',
    manual: true,
    schedule: every(30),
    fields: [
      { key: 'windowMinutes', label: 'Вікно підрахунку, хв', type: 'number', default: 60, min: 5, max: 1440 },
      { key: 'adminDenied', label: 'Відмов у доступі до панелі', type: 'number', default: 3, min: 1, max: 1000 },
      { key: 'webhookSecret', label: 'Запитів з невірним секретом webhook', type: 'number', default: 5, min: 1, max: 10_000 },
      { key: 'blockedActions', label: 'Дій заблокованих користувачів', type: 'number', default: 3, min: 1, max: 1000 },
      { key: 'reportsPerUser', label: 'Скарг від одного користувача за 24 год', type: 'number', default: 10, min: 1, max: 1000 },
    ],
  },
  {
    id: 'notify',
    title: 'Telegram-сповіщення',
    emoji: '🔔',
    description: 'Збирає все нове з минулого запуску й надсилає адміністратору одним повідомленням від бота.',
    lockGroup: 'telegram',
    manual: true,
    schedule: every(15),
    fields: [
      { key: 'newUsers', label: 'Нові користувачі', type: 'bool', default: false, group: 'Що надсилати' },
      { key: 'newAds', label: 'Нові оголошення та картки', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'reports', label: 'Скарги', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'suspicious', label: 'Підозріла активність', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'appErrors', label: 'Помилки застосунку', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'webhook', label: 'Проблеми webhook', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'jobErrors', label: 'Помилки фонових задач', type: 'bool', default: true, group: 'Що надсилати' },
      { key: 'dailyReport', label: 'Щоденний звіт', type: 'bool', default: true, group: 'Що надсилати', hint: 'Час і часовий пояс — у модулі «Щоденні звіти»' },
      {
        key: 'chatId',
        label: 'Чат для сповіщень (необовʼязково)',
        type: 'text',
        default: '',
        max: 64,
        hint: 'ID чату або @канал. Порожньо — TELEGRAM_ADMIN_CHAT_ID або ваш особистий чат з ботом',
        group: 'Куди',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Щоденні звіти',
    emoji: '📊',
    description: 'Підсумок за 24 години: користувачі, публікації, скарги, поповнення, помилки. Надсилається, якщо в сповіщеннях увімкнено «Щоденний звіт».',
    lockGroup: 'telegram',
    manual: true,
    schedule: daily('09:00'),
    fields: [{ key: 'includeOrders', label: 'Включати поповнення', type: 'bool', default: true }],
  },
  {
    id: 'broadcasts',
    title: 'Керування розсилками',
    emoji: '📣',
    description:
      'Запускає заплановані розсилки в їхній час і надсилає їх частинами в межах лімітів Telegram. Надсилає лише розсилки, які адміністратор створив і підтвердив у розділі «Розсилки».',
    lockGroup: 'telegram',
    manual: true,
    schedule: every(5),
    fields: [{ key: 'maxPerRun', label: 'Повідомлень за один запуск', type: 'number', default: 300, min: 20, max: 2000 }],
  },
  {
    id: 'server',
    title: 'Моніторинг сервера',
    emoji: '🖥',
    description: 'Перевіряє доступність і швидкість бази даних, файлового сховища, Telegram Bot API та API курсів НБУ.',
    lockGroup: 'server',
    manual: true,
    schedule: every(15),
    fields: [
      { key: 'slowMs', label: 'Повільна відповідь, мс', type: 'number', default: 3000, min: 100, max: 15_000 },
      { key: 'checkBlobs', label: 'Файлове сховище', type: 'bool', default: true },
      { key: 'checkTelegram', label: 'Telegram Bot API', type: 'bool', default: true },
      { key: 'checkNbu', label: 'API курсів НБУ', type: 'bool', default: true },
    ],
  },
  {
    id: 'webhook',
    title: 'Контроль Telegram webhook',
    emoji: '🪝',
    description: 'Перевіряє адресу webhook, чергу оновлень і нещодавні помилки доставки.',
    lockGroup: 'webhook',
    manual: true,
    schedule: every(15),
    fields: [
      { key: 'maxPending', label: 'Макс. оновлень у черзі', type: 'number', default: 50, min: 1, max: 10_000 },
      { key: 'errorMinutes', label: 'Зважати на помилки за, хв', type: 'number', default: 30, min: 5, max: 1440 },
      {
        key: 'autoRestore',
        label: 'Автоматично відновлювати адресу',
        type: 'bool',
        default: false,
        hint: 'Лише на робочому (production) сайті; потрібен TELEGRAM_WEBHOOK_SECRET',
      },
    ],
  },
  {
    id: 'jobs',
    title: 'Контроль фонових задач',
    emoji: '⚙️',
    description:
      'Повертає завислі задачі в чергу (до ліміту спроб), попереджає про розсилки, що не стартували, та оплачені поповнення без зарахування. Замовлення не змінює.',
    lockGroup: 'jobs',
    manual: true,
    schedule: every(15),
    fields: [
      { key: 'stuckMinutes', label: 'Задача зависла через, хв', type: 'number', default: 10, min: 5, max: 240 },
      { key: 'maxAttempts', label: 'Макс. спроб', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'lateMinutes', label: 'Розсилка запізнюється на, хв', type: 'number', default: 15, min: 5, max: 1440 },
      { key: 'orderMinutes', label: 'Поповнення без зарахування, хв', type: 'number', default: 30, min: 5, max: 1440 },
      { key: 'keepDays', label: 'Зберігати історію, днів', type: 'number', default: 30, min: 7, max: 365 },
    ],
  },
  {
    id: 'analytics',
    title: 'Автоматична аналітика',
    emoji: '📈',
    description: 'DAU/WAU/MAU, залученість, утримання, частка авторів, сесії на користувача, топ категорій і контент з найбільшою кількістю скарг.',
    lockGroup: 'analytics',
    manual: true,
    schedule: daily('06:00'),
    fields: [{ key: 'topN', label: 'Розмір топів', type: 'number', default: 5, min: 3, max: 20 }],
  },
]

export const moduleDef = (id: ModuleId) => MODULES.find((m) => m.id === id)!

export function defaultAutomation(): AutomationConfig {
  return {
    paused: false,
    modules: Object.fromEntries(
      MODULES.map((m) => [
        m.id,
        {
          enabled: false,
          settings: Object.fromEntries(m.fields.map((f) => [f.key, f.default])),
          schedule: m.schedule && { ...m.schedule },
          since: new Date(0).toISOString(),
        },
      ]),
    ) as Record<ModuleId, ModuleConfig>,
  }
}

const o = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// Returns why a schedule can't run on this infrastructure (with a workable alternative), or null.
export function scheduleProblem(s: Schedule): string | null {
  if (!TIME_RE.test(s.time)) return 'Час має бути у форматі ГГ:ХХ, наприклад 09:00.'
  if (!isTimeZone(s.tz)) return `Невідомий часовий пояс «${s.tz}». Наприклад: Europe/Kyiv.`
  if (s.kind === 'interval' && !INTERVALS.includes(s.every)) {
    const nearest = INTERVALS.reduce((a, b) => (Math.abs(b - s.every) < Math.abs(a - s.every) ? b : a))
    return s.every < TICK_MINUTES
      ? `Інтервал ${s.every} хв не підтримується: планувальник Netlify запускається раз на ${TICK_MINUTES} хв. Найближчий можливий варіант — ${TICK_MINUTES} хв.`
      : `Інтервал ${s.every} хв не підтримується: можливі лише ${INTERVALS.join(', ')} хв (рівні проміжки протягом доби). Найближчий варіант — ${nearest} хв.`
  }
  return null
}

function sanitizeSchedule(v: unknown, def: Schedule): Schedule {
  const s = o(v)
  const kind: ScheduleKind = s.kind === 'interval' || s.kind === 'daily' || s.kind === 'weekly' ? s.kind : def.kind
  const n = Math.floor(Number(s.every))
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : def.enabled,
    kind,
    every: Number.isFinite(n) && n > 0 ? Math.min(n, 1440) : def.every,
    time: typeof s.time === 'string' ? s.time.trim().slice(0, 5) : def.time,
    weekday: Number.isInteger(s.weekday) && (s.weekday as number) >= 0 && (s.weekday as number) <= 6 ? (s.weekday as number) : def.weekday,
    tz: typeof s.tz === 'string' && s.tz.trim() ? s.tz.trim().slice(0, 64) : def.tz,
  }
}

function sanitizeField(f: FieldDef, v: unknown) {
  switch (f.type) {
    case 'bool':
      return typeof v === 'boolean' ? v : f.default
    case 'number': {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && v !== '' && v !== null ? Math.min(f.max, Math.max(f.min, n)) : f.default
    }
    case 'text':
      return typeof v === 'string' ? v.trim().slice(0, f.max) : f.default
    case 'list':
      return Array.isArray(v)
        ? [...new Set(v.filter((x) => typeof x === 'string').map((x) => x.trim().toLowerCase().slice(0, 80)).filter(Boolean))].slice(0, 200)
        : f.default
  }
}

// Coerces any stored/submitted value into a full, valid config (unknown keys are dropped).
// Schedules keep their values even if unsupported; saving checks them with scheduleProblem().
export function sanitizeAutomation(v: unknown): AutomationConfig {
  const def = defaultAutomation()
  const src = o(v)
  const mods = o(src.modules)
  for (const m of MODULES) {
    const cur = o(mods[m.id])
    const settings = o(cur.settings)
    const since = typeof cur.since === 'string' && !Number.isNaN(Date.parse(cur.since)) ? cur.since : def.modules[m.id].since
    def.modules[m.id] = {
      enabled: cur.enabled === true,
      settings: Object.fromEntries(m.fields.map((f) => [f.key, sanitizeField(f, settings[f.key])])),
      schedule: m.schedule && sanitizeSchedule(cur.schedule, m.schedule),
      since,
    }
  }
  def.paused = src.paused === true
  return def
}

// ── Time zones and schedule slots ───────────────────────────────────────────────────────────────

const MIN = 60_000
const DAY = 1440 * MIN

function wall(t: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, Number(x.value)]),
  )
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute }
}

// UTC timestamp of a wall-clock time in `tz` (daylight-saving aware).
export function zonedTime(y: number, m: number, d: number, h: number, mi: number, tz: string) {
  const target = Date.UTC(y, m - 1, d, h, mi)
  let t = target
  for (let i = 0; i < 3; i++) {
    const w = wall(t, tz)
    const diff = target - Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi)
    if (!diff) break
    t += diff
  }
  return t
}

// Every slot of the schedule between `from` and `to` (UTC ms), in order.
function slots(s: Schedule, from: number, to: number) {
  const [hh, mm] = s.time.split(':').map(Number)
  const base = wall(from, s.tz)
  const out: number[] = []
  for (let k = -1; ; k++) {
    const day = new Date(Date.UTC(base.y, base.m - 1, base.d + k))
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()]
    if (zonedTime(y, m, d, 0, 0, s.tz) > to) break
    if (s.kind === 'interval') {
      const step = s.every
      const start = (hh * 60 + mm) % step
      for (let min = start; min < 1440; min += step) out.push(zonedTime(y, m, d, Math.floor(min / 60), min % 60, s.tz))
    } else if (s.kind === 'daily' || day.getUTCDay() === s.weekday) {
      out.push(zonedTime(y, m, d, hh, mm, s.tz))
    }
  }
  return [...new Set(out)].filter((t) => t >= from && t <= to).sort((a, b) => a - b)
}

// The latest slot at or before `now`, or null.
export function prevSlot(s: Schedule, now: number): number | null {
  if (scheduleProblem(s)) return null
  const span = s.kind === 'weekly' ? 8 * DAY : 2 * DAY
  const list = slots(s, now - span, now)
  return list.length ? list[list.length - 1] : null
}

// The first slot strictly after `now`, or null.
export function nextSlot(s: Schedule, now: number): number | null {
  if (scheduleProblem(s)) return null
  const span = s.kind === 'weekly' ? 8 * DAY : 2 * DAY
  return slots(s, now + 1, now + span)[0] ?? null
}

export function describeSchedule(s: Schedule | null) {
  if (!s) return 'Без розкладу'
  if (!s.enabled) return 'Розклад вимкнено'
  const tz = s.tz === 'Europe/Kyiv' ? 'за Києвом' : s.tz
  if (s.kind === 'interval') {
    const every = s.every % 60 === 0 ? `${s.every / 60} год` : `${s.every} хв`
    return `Кожні ${every}${s.time !== '00:00' ? ` від ${s.time}` : ''} (${tz})`
  }
  if (s.kind === 'daily') return `Щодня о ${s.time} (${tz})`
  return `Щотижня: ${WEEKDAYS[s.weekday].toLowerCase()} о ${s.time} (${tz})`
}

export const BROADCAST_AUDIENCES = [
  { value: 'all', label: 'Усі користувачі' },
  { value: 'active7', label: 'Активні за 7 днів' },
  { value: 'active30', label: 'Активні за 30 днів' },
  { value: 'new7', label: 'Нові за 7 днів' },
] as const
export type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number]['value']
export const isAudience = (v: unknown): v is BroadcastAudience => BROADCAST_AUDIENCES.some((a) => a.value === v)
