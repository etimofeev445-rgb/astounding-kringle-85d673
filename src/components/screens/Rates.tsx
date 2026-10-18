import { ArrowLeftRight, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FLAGS, POPULAR, useRates } from '../../lib/rates'
import { useI18n } from '../../lib/i18n'
import { haptic } from '../../lib/telegram'
import { Card, ScreenTitle, Segmented, fmt, inputCls } from '../ui'

type Tab = 'nbu' | 'banks' | 'convert'

export default function Rates() {
  const { data, error, reload } = useRates()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('nbu')
  const [showAll, setShowAll] = useState(false)

  const nbu = useMemo(() => {
    const list = data?.nbu ?? []
    const popular = POPULAR.map((c) => list.find((r) => r.code === c)).filter(Boolean) as typeof list
    const rest = list.filter((r) => !POPULAR.includes(r.code)).sort((a, b) => a.code.localeCompare(b.code))
    return showAll ? [...popular, ...rest] : popular
  }, [data, showAll])

  return (
    <div>
      <div className="flex items-start justify-between">
        <ScreenTitle
          title={t({ uk: 'Курс валют', ru: 'Курс валют' })}
          subtitle={
            data?.date
              ? `${t({ uk: 'НБУ на', ru: 'НБУ на' })} ${data.date}`
              : t({ uk: 'Завантаження…', ru: 'Загрузка…' })
          }
        />
        <button
          onClick={() => {
            haptic()
            reload()
          }}
          className="tap h-10 w-10 grid place-items-center rounded-2xl bg-panel border border-line text-mute"
          aria-label={t({ uk: 'Оновити', ru: 'Обновить' })}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'nbu', label: t({ uk: 'НБУ', ru: 'НБУ' }) },
          { value: 'banks', label: t({ uk: 'Банки', ru: 'Банки' }) },
          { value: 'convert', label: t({ uk: 'Конвертер', ru: 'Конвертер' }) },
        ]}
      />

      {error && (
        <Card className="mb-4 text-sm text-down">
          {t({
            uk: 'Не вдалося отримати частину курсів. Спробуйте оновити.',
            ru: 'Не удалось получить часть курсов. Попробуйте обновить.'
          })}
        </Card>
      )}

      {tab === 'nbu' && (
        <Card className="p-0 overflow-hidden">
          {!data && <Skeleton />}
          {nbu.map((r) => (
            <div key={r.code} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
              <span className="text-2xl w-8 text-center">{FLAGS[r.code] ?? '🏳️'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.code}</div>
                <div className="text-xs text-mute truncate">{r.name}</div>
              </div>
              <div className="font-display font-bold">{fmt(r.rate, r.rate < 1 ? 4 : 2)}</div>
            </div>
          ))}
          {data && (
            <button onClick={() => setShowAll((v) => !v)} className="w-full py-3 text-sm font-semibold text-sky">
              {showAll
                ? t({ uk: 'Показати менше', ru: 'Показать меньше' })
                : `${t({ uk: 'Усі валюти', ru: 'Все валюты' })} (${data.nbu.length})`}
            </button>
          )}
        </Card>
      )}

      {tab === 'banks' && (
        <div className="space-y-4">
          <BankTable title={`ПриватБанк · ${t({ uk: 'готівка', ru: 'наличные' })}`} color="#5aa02c" rows={data?.privat} />
          <BankTable title={`monobank · ${t({ uk: 'картка', ru: 'карта' })}`} color="#e8e8e8" rows={data?.mono} />
          <p className="text-xs text-mute px-1">
            {t({
              uk: 'Курси банків оновлюються джерелами самостійно; для операцій уточнюйте в застосунку банку.',
              ru: 'Курсы банков обновляются источниками самостоятельно; для операций уточняйте в приложении банка.'
            })}
          </p>
        </div>
      )}

      {tab === 'convert' && <Converter />}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="p-4 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded-xl bg-panel-2 animate-pulse" />
      ))}
    </div>
  )
}

function BankTable({
  title,
  color,
  rows,
}: {
  title: string
  color: string
  rows?: { code: string; buy: number; sale: number }[]
}) {
  const { t } = useI18n()
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="font-bold">{title}</span>
      </div>
      <div className="grid grid-cols-3 px-4 py-2 text-xs uppercase tracking-wider text-mute">
        <span>{t({ uk: 'Валюта', ru: 'Валюта' })}</span>
        <span className="text-right">{t({ uk: 'Купівля', ru: 'Покупка' })}</span>
        <span className="text-right">{t({ uk: 'Продаж', ru: 'Продажа' })}</span>
      </div>
      {!rows && <Skeleton />}
      {rows?.length === 0 && <div className="px-4 pb-4 text-sm text-mute">
          {t({ uk: 'Дані тимчасово недоступні', ru: 'Данные временно недоступны' })}
        </div>}
      {rows?.map((r) => (
        <div key={r.code} className="grid grid-cols-3 px-4 py-3 border-t border-line">
          <span className="font-bold">
            {FLAGS[r.code] ?? ''} {r.code}
          </span>
          <span className="text-right font-display text-up">{fmt(r.buy)}</span>
          <span className="text-right font-display text-down">{fmt(r.sale)}</span>
        </div>
      ))}
    </Card>
  )
}

function Converter() {
  const { data } = useRates()
  const { t } = useI18n()
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState('UAH')

  const codes = useMemo(() => {
    const list = data?.nbu.map((r) => r.code) ?? []
    const popular = POPULAR.filter((c) => !data || list.includes(c))
    const rest = list.filter((c) => !POPULAR.includes(c)).sort()
    return ['UAH', ...popular, ...rest]
  }, [data])
  const rateOf = (c: string) => (c === 'UAH' ? 1 : (data?.nbu.find((r) => r.code === c)?.rate ?? NaN))
  const value = parseFloat(amount.replace(/\s/g, '').replace(',', '.'))
  const result = amount.trim() === '' ? 0 : (value * rateOf(from)) / rateOf(to)
  const unit = rateOf(from) / rateOf(to)

  // Allow only digits and a single decimal separator while typing.
  const onAmount = (v: string) => {
    const clean = v.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1')
    setAmount(clean)
  }

  const select = (label: string, v: string, set: (v: string) => void) => (
    <label className="block min-w-0">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{label}</span>
      <select
        value={v}
        onChange={(e) => set(e.target.value)}
        className={`${inputCls} appearance-none font-bold [color-scheme:dark] [&>option]:bg-panel-2`}
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {FLAGS[c] ?? ''} {c}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Card className="space-y-4">
      <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">
          {t({ uk: 'Сума', ru: 'Сумма' })}
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className={`${inputCls} font-display text-xl`}
        />
      </label>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        {select(t({ uk: 'З', ru: 'Из' }), from, setFrom)}
        <button
          onClick={() => {
            haptic()
            setFrom(to)
            setTo(from)
          }}
          className="tap h-[50px] w-11 grid place-items-center rounded-2xl bg-sun text-ink"
          aria-label={t({ uk: 'Поміняти', ru: 'Поменять' })}
        >
          <ArrowLeftRight size={18} />
        </button>
        {select(t({ uk: 'В', ru: 'В' }), to, setTo)}
      </div>

      <div className="rounded-2xl bg-sun/10 border border-sun/30 px-4 py-3">
        <div className="text-xs text-mute">{t({ uk: 'Результат', ru: 'Результат' })}</div>
        <div className="font-display text-2xl font-bold text-sun break-all">
          {data?.nbu.length ? `${fmt(result)} ${to}` : '…'}
        </div>
        {data?.nbu.length ? (
          <div className="text-xs text-mute mt-1">
            1 {from} = {fmt(unit, unit < 0.1 ? 4 : 2)} {to}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-mute">
        {t({ uk: 'За офіційним курсом НБУ', ru: 'По официальному курсу НБУ' })}
        {data?.date ? ` ${t({ uk: 'на', ru: 'на' })} ${data.date}` : ''}.
      </p>
    </Card>
  )
}
