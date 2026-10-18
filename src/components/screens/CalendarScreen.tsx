import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { holidayOn, holidaysFor } from '../../lib/holidays'
import { DAY_NAMES, MONTHS, MONTHS_GEN, WEEKDAYS, useI18n } from '../../lib/i18n'
import { haptic } from '../../lib/telegram'
import { Card, ScreenTitle } from '../ui'

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function CalendarScreen() {
  const { lang, t } = useI18n()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(today)

  const cells = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const shift = (n: number) => {
    haptic()
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  }

  const monthHolidays = holidaysFor(cursor.getFullYear()).filter(
    (h) => Number(h.date.slice(0, 2)) === cursor.getMonth() + 1,
  )
  const selHoliday = holidayOn(selected)
  const diff = Math.round(
    (+new Date(selected.getFullYear(), selected.getMonth(), selected.getDate()) -
      +new Date(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000,
  )
  const dow = DAY_NAMES[lang][selected.getDay()]

  // Робочі дні місяця (пн–пт; під час воєнного стану святкові дні не є вихідними)
  const workDays = cells.filter(
    (d) => d.getMonth() === cursor.getMonth() && d.getDay() !== 0 && d.getDay() !== 6,
  ).length

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Календар', ru: 'Календарь' })}
        subtitle={t({ uk: 'Державні свята та памʼятні дати України', ru: 'Государственные праздники и памятные даты Украины' })}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shift(-1)} className="tap h-9 w-9 grid place-items-center rounded-xl bg-panel-2" aria-label={t({ uk: 'Попередній', ru: 'Предыдущий' })}>
            <ChevronLeft size={18} />
          </button>
          <div className="font-display font-bold">
            {MONTHS[lang][cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button onClick={() => shift(1)} className="tap h-9 w-9 grid place-items-center rounded-xl bg-panel-2" aria-label={t({ uk: 'Наступний', ru: 'Следующий' })}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-mute mb-1">
          {WEEKDAYS[lang].map((w, i) => (
            <span key={w} className={i > 4 ? 'text-down/80' : ''}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth()
            const h = holidayOn(d)
            const isToday = sameDay(d, today)
            const isSel = sameDay(d, selected)
            const weekend = d.getDay() === 0 || d.getDay() === 6
            return (
              <button
                key={d.toISOString()}
                onClick={() => {
                  haptic()
                  setSelected(d)
                  if (!inMonth) setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                }}
                className={`relative aspect-square rounded-xl text-sm font-semibold tap ${
                  isSel ? 'bg-sky text-white' : isToday ? 'ring-2 ring-sun' : ''
                } ${!inMonth ? 'opacity-30' : ''} ${!isSel && weekend ? 'text-down/90' : ''}`}
              >
                {d.getDate()}
                {h && (
                  <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${h.official ? 'bg-sun' : 'bg-mute'}`} />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="mt-3">
        <div className="text-xs text-mute uppercase tracking-wider font-semibold">
          {dow}
        </div>
        <div className="font-display text-xl font-bold">
          {selected.getDate()} {MONTHS_GEN[lang][selected.getMonth()]} {selected.getFullYear()}
        </div>
        <div className="text-sm text-mute mt-1">
          {diff === 0
            ? t({ uk: 'Сьогодні', ru: 'Сегодня' })
            : diff > 0
              ? `${t({ uk: 'Через', ru: 'Через' })} ${diff} ${t({ uk: 'дн.', ru: 'дн.' })}`
              : `${-diff} ${t({ uk: 'дн. тому', ru: 'дн. назад' })}`}
        </div>
        {selHoliday && (
          <div className="mt-3 rounded-2xl bg-sun/10 border border-sun/30 px-3 py-2 text-sm">
            🎉 <b>{t(selHoliday.title)}</b>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Card>
          <div className="text-xs text-mute">{t({ uk: 'Робочих днів', ru: 'Рабочих дней' })}</div>
          <div className="font-display text-2xl font-bold">{workDays}</div>
        </Card>
        <Card>
          <div className="text-xs text-mute">{t({ uk: 'Свят у місяці', ru: 'Праздников в месяце' })}</div>
          <div className="font-display text-2xl font-bold">{monthHolidays.length}</div>
        </Card>
      </div>

      {monthHolidays.length > 0 && (
        <Card className="mt-3 space-y-2">
          {monthHolidays.map((h) => (
            <div key={h.date} className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${h.official ? 'bg-sun' : 'bg-mute'}`} />
              <span className="font-display font-bold w-10">{Number(h.date.slice(3))}</span>
              <span className="text-sm">{t(h.title)}</span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-mute mt-3 px-1">
        {t({
          uk: 'Під час воєнного стану святкові дні не є додатковими вихідними (ст. 73 КЗпП).',
          ru: 'Во время военного положения праздничные дни не являются дополнительными выходными (ст. 73 КЗоТ).',
        })}
      </p>
    </div>
  )
}
