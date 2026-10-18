import { AtSign, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { banks } from '../../data/banks'
import { dpCountries } from '../../data/dpdocument'
import { holidaysFor } from '../../lib/holidays'
import { dayMonth, useI18n } from '../../lib/i18n'
import { SCREENS, type Screen } from '../../lib/nav'
import { FLAGS, useRates } from '../../lib/rates'
import { openLink } from '../../lib/telegram'
import { fmt, inputCls } from '../ui'

interface Hit {
  key: string
  group: string
  icon: string
  title: string
  hint: string
  action: () => void
}

export type OpenTarget = {
  screen: Screen
  bankQuery?: string
  // 'store': storefront key; 'map': open the add form right away.
  store?: string
  mapAdd?: boolean
}

export default function SearchScreen({ open }: { open: (t: OpenTarget) => void }) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const { data } = useRates()
  const { lang, t } = useI18n()

  useEffect(() => ref.current?.focus(), [])

  const s = q.trim().toLowerCase()
  const username = /^@?[a-z0-9_]{5,32}$/i.test(q.trim()) ? q.trim().replace(/^@/, '') : null

  const hits = useMemo<Hit[]>(() => {
    if (!s) return []
    const year = new Date().getFullYear()
    return [
      ...SCREENS.filter((x) => x.id !== 'search' && (t(x.title) + t(x.hint)).toLowerCase().includes(s)).map((x) => ({
        key: 's' + x.id, group: t({ uk: 'Розділи', ru: 'Разделы' }), icon: x.emoji, title: t(x.title), hint: t(x.hint),
        action: () => open({ screen: x.id }),
      })),
      ...banks.filter((b) => [b.name, b.mfo, b.edrpou, ...b.tags].some((v) => v.toLowerCase().includes(s))).map((b) => ({
        key: 'b' + b.id, group: t({ uk: 'Банки', ru: 'Банки' }), icon: '🏦', title: b.name, hint: `МФО ${b.mfo} · ${t({ uk: 'ЄДРПОУ', ru: 'ЕГРПОУ' })} ${b.edrpou}`,
        action: () => open({ screen: 'banks', bankQuery: b.name }),
      })),
      ...dpCountries.flatMap((c) =>
        c.offices.filter((o) => [c.name.uk, c.name.ru, o.city, o.address].some((v) => v.toLowerCase().includes(s))).map((o) => ({
          key: 'd' + c.id + o.address, group: t({ uk: 'ДП «Документ»', ru: 'ГП «Документ»' }), icon: c.flag,
          title: `${t(c.name)}, ${t({ uk: 'м.', ru: 'г.' })} ${o.city}`, hint: o.address,
          action: () => open({ screen: 'docs' }),
        })),
      ),
      ...(data?.nbu ?? []).filter((r) => (r.code + r.name).toLowerCase().includes(s)).slice(0, 6).map((r) => ({
        key: 'r' + r.code, group: t({ uk: 'Валюти', ru: 'Валюты' }), icon: FLAGS[r.code] ?? '💱', title: `${r.code} — ${fmt(r.rate, 4)} ₴`, hint: r.name,
        action: () => open({ screen: 'rates' }),
      })),
      ...holidaysFor(year).filter((h) => (h.title.uk + h.title.ru).toLowerCase().includes(s)).map((h) => ({
        key: 'h' + h.date, group: t({ uk: 'Свята', ru: 'Праздники' }), icon: '📅', title: t(h.title),
        hint: dayMonth(lang, Number(h.date.slice(3)), Number(h.date.slice(0, 2)) - 1),
        action: () => open({ screen: 'calendar' }),
      })),
    ]
  }, [s, data, open, lang, t])

  const groups = [...new Set(hits.map((h) => h.group))]

  return (
    <div>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t({ uk: 'Банк, МФО, місто, валюта, @канал…', ru: 'Банк, МФО, город, валюта, @канал…' })}
          className={`${inputCls} pl-11 py-3.5`}
        />
      </div>

      {username && (
        <button
          onClick={() => openLink(`https://t.me/${username}`)}
          className="tap w-full flex items-center gap-3 rounded-3xl bg-sky/15 border border-sky/40 p-4 mb-4 text-left"
        >
          <span className="h-10 w-10 grid place-items-center rounded-2xl bg-sky"><AtSign size={18} /></span>
          <div>
            <div className="font-bold">
              {t({ uk: 'Відкрити', ru: 'Открыть' })} @{username} {t({ uk: 'у Telegram', ru: 'в Telegram' })}
            </div>
            <div className="text-xs text-mute">
              {t({ uk: 'Канал, група, бот або користувач', ru: 'Канал, группа, бот или пользователь' })}
            </div>
          </div>
        </button>
      )}

      {!s && (
        <div className="flex flex-wrap gap-2">
          {(lang === 'ru'
            ? ['USD', 'ПриватБанк', 'Варшава', 'Германия', 'Независимости', 'EUR', 'Польша']
            : ['долар', 'ПриватБанк', 'Варшава', 'державний', 'Незалежності', 'євро', 'Берлін']
          ).map((t) => (
            <button key={t} onClick={() => setQ(t)} className="tap rounded-full bg-panel border border-line px-3 py-1.5 text-sm">
              {t}
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <div key={g} className="mb-4 rise">
          <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2 px-1">{g}</div>
          <div className="rounded-3xl bg-panel border border-line overflow-hidden">
            {hits.filter((h) => h.group === g).map((h) => (
              <button key={h.key} onClick={h.action} className="w-full flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 text-left active:bg-panel-2">
                <span className="text-xl w-7 text-center">{h.icon}</span>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{h.title}</div>
                  <div className="text-xs text-mute truncate">{h.hint}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {s && hits.length === 0 && !username && <p className="text-center text-mute py-10">{t({ uk: 'Нічого не знайдено', ru: 'Ничего не найдено' })}</p>}
    </div>
  )
}
