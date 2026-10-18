import { useState } from 'react'
import Calculator from '../Calculator'
import { useI18n, type Tr } from '../../lib/i18n'
import { Card, Field, ScreenTitle, Segmented, fmt, inputCls } from '../ui'

type Mode = 'basic' | 'vat' | 'deposit' | 'loan'

const UAH: Tr = { uk: 'грн', ru: 'грн' }
const PA: Tr = { uk: '% річ.', ru: '% год.' }
const MO: Tr = { uk: 'міс.', ru: 'мес.' }
const RATE: Tr = { uk: 'Ставка', ru: 'Ставка' }
const TERM: Tr = { uk: 'Строк', ru: 'Срок' }

const num = (s: string) => parseFloat(s.replace(',', '.')) || 0

export default function Calc() {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('basic')
  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Калькулятор', ru: 'Калькулятор' })}
        subtitle={t({
          uk: 'Розрахунки для щоденних і фінансових задач',
          ru: 'Расчёты для повседневных и финансовых задач'
        })}
      />
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'basic', label: t({ uk: 'Звичайний', ru: 'Обычный' }) },
          { value: 'vat', label: t({ uk: 'ПДВ', ru: 'НДС' }) },
          { value: 'deposit', label: t({ uk: 'Депозит', ru: 'Депозит' }) },
          { value: 'loan', label: t({ uk: 'Кредит', ru: 'Кредит' }) },
        ]}
      />
      {mode === 'basic' && <Calculator />}
      {mode === 'vat' && <Vat />}
      {mode === 'deposit' && <Deposit />}
      {mode === 'loan' && <Loan />}
    </div>
  )
}

function NumInput({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <div className="relative">
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-14`} />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-mute text-sm">{suffix}</span>
    </div>
  )
}

function Result({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <Card className="mt-4 bg-sun/10 border-sun/30 space-y-2">
      {rows.map(([k, v, big]) => (
        <div key={k} className="flex items-baseline justify-between">
          <span className="text-sm text-mute">{k}</span>
          <span className={`font-display font-bold ${big ? 'text-2xl text-sun' : ''}`}>{v}</span>
        </div>
      ))}
    </Card>
  )
}

function Vat() {
  const { t } = useI18n()
  const uah = t(UAH)
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState('20')
  const [incl, setIncl] = useState<'add' | 'extract'>('add')
  const a = num(amount)
  const r = num(rate) / 100
  const vat = incl === 'add' ? a * r : a - a / (1 + r)
  const net = incl === 'add' ? a : a - vat
  return (
    <>
      <Card className="space-y-3">
        <Segmented value={incl} onChange={setIncl} options={[
            { value: 'add', label: t({ uk: 'Нарахувати', ru: 'Начислить' }) },
            { value: 'extract', label: t({ uk: 'Виділити', ru: 'Выделить' }) },
          ]} />
        <Field
          label={
            incl === 'add'
              ? t({ uk: 'Сума без ПДВ', ru: 'Сумма без НДС' })
              : t({ uk: 'Сума з ПДВ', ru: 'Сумма с НДС' })
          }
        >
          <NumInput value={amount} onChange={setAmount} suffix={uah} />
        </Field>
        <Field label={t({ uk: 'Ставка ПДВ', ru: 'Ставка НДС' })}>
          <div className="flex gap-2">
            {['20', '14', '7'].map((v) => (
              <button key={v} onClick={() => setRate(v)} className={`tap flex-1 rounded-2xl py-2.5 font-bold ${rate === v ? 'bg-sky' : 'bg-panel-2 text-mute'}`}>
                {v}%
              </button>
            ))}
          </div>
        </Field>
      </Card>
      <Result
        rows={[
          [t({ uk: 'Без ПДВ', ru: 'Без НДС' }), `${fmt(net)} ${uah}`],
          [t({ uk: 'ПДВ', ru: 'НДС' }), `${fmt(vat)} ${uah}`],
          [t({ uk: 'Разом з ПДВ', ru: 'Итого с НДС' }), `${fmt(net + vat)} ${uah}`, true],
        ]}
      />
    </>
  )
}

function Deposit() {
  const { t } = useI18n()
  const uah = t(UAH)
  const [sum, setSum] = useState('50000')
  const [rate, setRate] = useState('14')
  const [months, setMonths] = useState('12')
  const [cap, setCap] = useState<'no' | 'yes'>('no')
  const s = num(sum)
  const r = num(rate) / 100
  const m = num(months)
  const gross = cap === 'yes' ? s * Math.pow(1 + r / 12, m) - s : (s * r * m) / 12
  // ПДФО 18% + військовий збір 5% (з 01.12.2024)
  const tax = gross * 0.23
  return (
    <>
      <Card className="space-y-3">
        <Field label={t({ uk: 'Сума вкладу', ru: 'Сумма вклада' })}><NumInput value={sum} onChange={setSum} suffix={uah} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(RATE)}><NumInput value={rate} onChange={setRate} suffix={t(PA)} /></Field>
          <Field label={t(TERM)}><NumInput value={months} onChange={setMonths} suffix={t(MO)} /></Field>
        </div>
        <Segmented value={cap} onChange={setCap} options={[
            { value: 'no', label: t({ uk: 'Без капіталізації', ru: 'Без капитализации' }) },
            { value: 'yes', label: t({ uk: 'Капіталізація', ru: 'Капитализация' }) },
          ]} />
      </Card>
      <Result
        rows={[
          [t({ uk: 'Нараховано відсотків', ru: 'Начислено процентов' }), `${fmt(gross)} ${uah}`],
          [t({ uk: 'Податки (18% + 5%)', ru: 'Налоги (18% + 5%)' }), `−${fmt(tax)} ${uah}`],
          [t({ uk: 'Чистий дохід', ru: 'Чистый доход' }), `${fmt(gross - tax)} ${uah}`],
          [t({ uk: 'Сума в кінці строку', ru: 'Сумма в конце срока' }), `${fmt(s + gross - tax)} ${uah}`, true],
        ]}
      />
    </>
  )
}

function Loan() {
  const { t } = useI18n()
  const uah = t(UAH)
  const [sum, setSum] = useState('100000')
  const [rate, setRate] = useState('24')
  const [months, setMonths] = useState('24')
  const s = num(sum)
  const i = num(rate) / 100 / 12
  const n = num(months)
  const pay = i === 0 ? s / n : (s * i) / (1 - Math.pow(1 + i, -n))
  return (
    <>
      <Card className="space-y-3">
        <Field label={t({ uk: 'Сума кредиту', ru: 'Сумма кредита' })}><NumInput value={sum} onChange={setSum} suffix={uah} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(RATE)}><NumInput value={rate} onChange={setRate} suffix={t(PA)} /></Field>
          <Field label={t(TERM)}><NumInput value={months} onChange={setMonths} suffix={t(MO)} /></Field>
        </div>
      </Card>
      <Result
        rows={[
          [t({ uk: 'Щомісячний платіж', ru: 'Ежемесячный платёж' }), `${fmt(pay)} ${uah}`, true],
          [t({ uk: 'Переплата', ru: 'Переплата' }), `${fmt(pay * n - s)} ${uah}`],
          [t({ uk: 'Загалом до сплати', ru: 'Всего к оплате' }), `${fmt(pay * n)} ${uah}`],
        ]}
      />
      <p className="text-xs text-mute mt-3 px-1">
        {t({
          uk: 'Ануїтетна схема, без урахування комісій банку.',
          ru: 'Аннуитетная схема, без учёта комиссий банка.'
        })}
      </p>
    </>
  )
}
