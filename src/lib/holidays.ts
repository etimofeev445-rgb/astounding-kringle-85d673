import type { Tr } from './i18n'

export interface Holiday {
  date: string // MM-DD
  title: Tr
  official: boolean
}

const FIXED: Holiday[] = [
  { date: '01-01', title: { uk: 'Новий рік', ru: 'Новый год' }, official: true },
  { date: '01-22', title: { uk: 'День Соборності України', ru: 'День Соборности Украины' }, official: false },
  { date: '03-08', title: { uk: 'Міжнародний жіночий день', ru: 'Международный женский день' }, official: true },
  { date: '05-01', title: { uk: 'День праці', ru: 'День труда' }, official: true },
  { date: '05-08', title: { uk: 'День пам’яті та перемоги над нацизмом', ru: 'День памяти и победы над нацизмом' }, official: true },
  { date: '06-28', title: { uk: 'День Конституції України', ru: 'День Конституции Украины' }, official: true },
  { date: '07-15', title: { uk: 'День Української Державності', ru: 'День Украинской Государственности' }, official: true },
  { date: '08-23', title: { uk: 'День Державного Прапора', ru: 'День Государственного Флага' }, official: false },
  { date: '08-24', title: { uk: 'День Незалежності України', ru: 'День Независимости Украины' }, official: true },
  { date: '10-01', title: { uk: 'День захисників і захисниць України', ru: 'День защитников и защитниц Украины' }, official: true },
  { date: '11-09', title: { uk: 'День української писемності та мови', ru: 'День украинской письменности и языка' }, official: false },
  { date: '12-06', title: { uk: 'День Збройних Сил України', ru: 'День Вооружённых Сил Украины' }, official: false },
  { date: '12-25', title: { uk: 'Різдво Христове', ru: 'Рождество Христово' }, official: true },
]

// Православний Великдень (алгоритм Мееуса для юліанського календаря → григоріанська дата).
function orthodoxEaster(year: number): Date {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + 13)
  return date
}

const mmdd = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function holidaysFor(year: number): Holiday[] {
  const easter = orthodoxEaster(year)
  const trinity = new Date(easter)
  trinity.setDate(trinity.getDate() + 49)
  return [
    ...FIXED,
    { date: mmdd(easter), title: { uk: 'Великдень', ru: 'Пасха' }, official: true },
    { date: mmdd(trinity), title: { uk: 'Трійця', ru: 'Троица' }, official: true },
  ].sort((x, y) => x.date.localeCompare(y.date))
}

export function holidayOn(d: Date): Holiday | undefined {
  const key = mmdd(d)
  return holidaysFor(d.getFullYear()).find((h) => h.date === key)
}

export function nextHoliday(from = new Date()): { holiday: Holiday; date: Date; days: number } {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    for (const h of holidaysFor(year)) {
      const [m, d] = h.date.split('-').map(Number)
      const date = new Date(year, m - 1, d)
      if (date >= start) {
        return { holiday: h, date, days: Math.round((+date - +start) / 86400000) }
      }
    }
  }
  throw new Error('unreachable')
}
