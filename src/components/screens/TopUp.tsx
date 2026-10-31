import { CircleCheck, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { OPERATORS, TOPUP_MAX, TOPUP_MIN, formatLocal, type OperatorId } from '../../data/operators'
import { useI18n } from '../../lib/i18n'
import { haptic, openLink, tg } from '../../lib/telegram'
import { createTopupInvoice } from '../../server/topup'
import { Card, Field, ScreenTitle, inputCls } from '../ui'

const PRESETS = [50, 100, 200, 500]
const MIN = TOPUP_MIN
const MAX = TOPUP_MAX

// Accepts "+380 67…", "380 67…", "+38 067…", "8 067…", "067…" and "67…" (typed or pasted).
// The input shows the 9 local digits, so values that are already local are kept as is.
function toLocalDigits(raw: string) {
  let d = raw.replace(/\D/g, '')
  if (d.length > 9) {
    if (d.startsWith('380')) d = d.slice(3)
    else if (d.startsWith('80')) d = d.slice(2)
  } else if (d.startsWith('380') && d.length > 3) d = d.slice(3)
  d = d.replace(/^0+/, '')
  return d.slice(0, 9)
}

function OperatorLogo({ op, size = 'md' }: { op: (typeof OPERATORS)[number]; size?: 'sm' | 'md' }) {
  return (
    <div
      className={`rounded-2xl grid place-items-center font-display font-bold ${
        size === 'md' ? 'h-12 w-12 text-sm' : 'h-8 w-8 text-[10px]'
      }`}
      style={{ background: op.bg, color: op.fg }}
    >
      {op.id === 'kyivstar' ? 'K★' : op.id === 'vodafone' ? 'V' : op.id === 'lifecell' ? 'life' : '3M'}
    </div>
  )
}

export default function TopUp() {
  const { t } = useI18n()
  const [opId, setOpId] = useState<OperatorId>()
  const [digits, setDigits] = useState('')
  const [preset, setPreset] = useState<number | null>(100)
  const [custom, setCustom] = useState('')
  const [copied, setCopied] = useState(false)
  const [inTg, setInTg] = useState(false)
  const [busy, setBusy] = useState(false)
  const [paid, setPaid] = useState<string | null>(null)
  const [error, setError] = useState('')

  const op = OPERATORS.find((o) => o.id === opId)
  const amount = preset ?? Number(custom.replace(',', '.'))
  const amountOk = Number.isFinite(amount) && amount >= MIN && amount <= MAX
  const phoneOk = digits.length === 9
  const codeOk = !op || op.codes.includes(digits.slice(0, 2)) || digits.length < 2
  // The server rejects a code that doesn't belong to the chosen operator, so don't let it be submitted.
  const ready = !!op && phoneOk && codeOk && amountOk
  const fullNumber = `+380${digits}`
  const payLabel = amountOk
    ? t({ uk: `Оплатити ${amount} ₴`, ru: `Оплатить ${amount} ₴` })
    : t({ uk: 'Оплатити', ru: 'Оплатить' })

  // Auto-detect operator from the code once two digits are typed.
  useEffect(() => {
    if (digits.length < 2) return
    const found = OPERATORS.find((o) => o.codes.includes(digits.slice(0, 2)))
    if (found) setOpId(found.id)
  }, [digits.slice(0, 2)])

  // Operator's own page: used in a regular browser and until Telegram Payments is configured.
  const payOnOperatorSite = () => {
    if (!op) return
    // Clipboard may be unavailable inside some webviews; the number is still shown on screen.
    navigator.clipboard?.writeText(fullNumber).then(() => setCopied(true), () => {})
    openLink(op.url)
  }

  // In Telegram, pay right in the app: the server creates an invoice and Telegram's payment
  // sheet opens on top of the Mini App.
  const pay = async () => {
    if (!ready || !op || busy) return
    const app = tg()
    haptic()
    setError('')
    if (!app?.initData || !app.openInvoice) return payOnOperatorSite()

    setBusy(true)
    app.MainButton?.showProgress?.()
    try {
      const res = await createTopupInvoice({ data: { initData: app.initData, operator: op.id, phone: digits, amount } })
      if (!res.ok) {
        if (res.reason === 'not_configured') return payOnOperatorSite()
        setError(
          res.reason === 'invalid'
            ? t({ uk: 'Перевірте номер і суму', ru: 'Проверьте номер и сумму' })
            : t({ uk: 'Не вдалося створити платіж. Спробуйте ще раз.', ru: 'Не удалось создать платёж. Попробуйте ещё раз.' }),
        )
        app.HapticFeedback?.notificationOccurred?.('error')
        return
      }
      const summary = `${op.name} +380 ${formatLocal(digits)} · ${amount} ₴`
      app.openInvoice(res.link, (status) => {
        if (status === 'paid') {
          app.HapticFeedback?.notificationOccurred?.('success')
          setPaid(summary)
        } else if (status === 'failed') {
          app.HapticFeedback?.notificationOccurred?.('error')
          setError(t({ uk: 'Оплата не пройшла', ru: 'Оплата не прошла' }))
        }
      })
    } catch {
      setError(t({ uk: 'Немає зʼєднання. Спробуйте ще раз.', ru: 'Нет соединения. Попробуйте ещё раз.' }))
    } finally {
      setBusy(false)
      app.MainButton?.hideProgress?.()
    }
  }

  // Keep latest handlers for the native buttons without re-subscribing on each keystroke.
  const handlers = useRef({ pay })
  handlers.current = { pay }

  useEffect(() => {
    const app = tg()
    const main = app?.MainButton
    // The SDK script also loads in a plain browser; empty initData means we're outside Telegram.
    if (!main || !app?.initData) return
    setInTg(true)
    const onMain = () => handlers.current.pay()
    main.onClick(onMain)
    return () => {
      main.offClick(onMain)
      main.hide()
    }
  }, [])

  useEffect(() => {
    const app = tg()
    if (!app?.initData) return
    // Single native pay button, hidden once paid.
    const active = ready && !busy
    app.MainButton?.setParams({
      text: payLabel,
      color: active ? '#2f8cff' : '#2a3448',
      text_color: active ? '#ffffff' : '#8a96ad',
      is_active: active,
      is_visible: !paid,
    })
  }, [ready, busy, paid, payLabel])

  if (paid) {
    return (
      <div>
        <ScreenTitle title={t({ uk: 'Поповнити мобільний', ru: 'Пополнить мобильный' })} />
        <Card className="rise text-center py-8">
          <CircleCheck size={48} className="mx-auto text-up mb-3" />
          <div className="font-display font-bold text-lg mb-1">{t({ uk: 'Оплату прийнято', ru: 'Оплата принята' })}</div>
          <p className="text-sm text-mute mb-1">{paid}</p>
          <p className="text-xs text-mute mb-5">
            {t({
              uk: 'Бот надішле повідомлення, щойно кошти надійдуть на рахунок.',
              ru: 'Бот пришлёт сообщение, как только деньги поступят на счёт.',
            })}
          </p>
          <button
            onClick={() => {
              haptic()
              setPaid(null)
            }}
            className="tap rounded-2xl px-5 py-3 font-bold bg-panel-2 border border-line"
          >
            {t({ uk: 'Поповнити ще', ru: 'Пополнить ещё' })}
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Поповнити мобільний', ru: 'Пополнить мобильный' })}
        subtitle={t({ uk: 'Оберіть оператора, номер і суму', ru: 'Выберите оператора, номер и сумму' })}
      />

      <div className="grid grid-cols-4 gap-2 mb-4 rise">
        {OPERATORS.map((o) => {
          const active = o.id === opId
          return (
            <button
              key={o.id}
              onClick={() => {
                haptic()
                setOpId(o.id)
              }}
              aria-pressed={active}
              className={`tap flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 ${
                active ? 'border-sky bg-sky/15' : 'border-line bg-panel'
              }`}
            >
              <OperatorLogo op={o} />
              <span className="text-[11px] font-semibold">{o.name}</span>
            </button>
          )
        })}
      </div>

      <Card className="mb-4 rise space-y-4">
        <Field label={t({ uk: 'Номер телефону', ru: 'Номер телефона' })}>
          <div className={`${inputCls} flex items-center gap-2 focus-within:border-sky`}>
            <span className="font-semibold text-mute">+380</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="67 123 45 67"
              value={formatLocal(digits)}
              onChange={(e) => setDigits(toLocalDigits(e.target.value))}
              className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-mute/60"
            />
          </div>
          {!codeOk && op && (
            <span className="block text-xs text-down mt-1.5">
              {t({
                uk: `Код не схожий на ${op.name} (${op.codes.join(', ')})`,
                ru: `Код не похож на ${op.name} (${op.codes.join(', ')})`,
              })}
            </span>
          )}
        </Field>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">
            {t({ uk: 'Сума', ru: 'Сумма' })}
          </span>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  haptic()
                  setPreset(p)
                  setCustom('')
                }}
                className={`tap rounded-xl py-2.5 text-sm font-bold border ${
                  preset === p ? 'bg-sky text-white border-sky' : 'bg-panel-2 border-line'
                }`}
              >
                {p} ₴
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            placeholder={t({ uk: `Інша сума (${MIN}–${MAX} ₴)`, ru: `Другая сумма (${MIN}–${MAX} ₴)` })}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value.replace(/[^\d.,]/g, ''))
              setPreset(null)
            }}
            className={inputCls}
          />
          {preset === null && custom && !amountOk && (
            <span className="block text-xs text-down mt-1.5">
              {t({ uk: `Від ${MIN} до ${MAX} ₴`, ru: `От ${MIN} до ${MAX} ₴` })}
            </span>
          )}
        </div>
      </Card>

      <Card className="mb-4 rise">
        <div className="flex items-center justify-between text-sm text-mute mb-1">
          <span>{t({ uk: 'Номер', ru: 'Номер' })}</span>
          <span className="flex items-center gap-2 text-white font-semibold">
            {op && <OperatorLogo op={op} size="sm" />}
            {phoneOk ? `+380 ${formatLocal(digits)}` : '—'}
          </span>
        </div>
        <div className="flex items-end justify-between mt-3">
          <span className="text-sm text-mute">{t({ uk: 'До сплати', ru: 'К оплате' })}</span>
          <span className="font-display text-3xl font-bold text-sun">
            {amountOk ? amount.toLocaleString('uk-UA', { maximumFractionDigits: 2 }) : '0'} ₴
          </span>
        </div>
        <p className="text-xs text-mute mt-3">
          {t({
            uk: inTg
              ? 'Оплата карткою прямо в застосунку через Telegram.'
              : 'Натисніть «Оплатити» — відкриється офіційна сторінка оплати оператора. Номер буде скопійовано — вставте його там.',
            ru: inTg
              ? 'Оплата картой прямо в приложении через Telegram.'
              : 'Нажмите «Оплатить» — откроется официальная страница оплаты оператора. Номер будет скопирован — вставьте его там.',
          })}
        </p>
        {error && <p className="text-xs text-down mt-2">{error}</p>}
        {copied && (
          <p className="flex items-center gap-1.5 text-xs text-up mt-2">
            <Copy size={14} /> {t({ uk: 'Номер скопійовано', ru: 'Номер скопирован' })}
          </p>
        )}
      </Card>

      {/* Fallback button for a regular browser; inside Telegram the native MainButton is used. */}
      {!inTg && (
        <button
          onClick={pay}
          disabled={!ready}
          className="tap w-full rounded-2xl py-3.5 font-bold text-lg bg-sky text-white disabled:opacity-40 rise"
        >
          {payLabel}
        </button>
      )}
    </div>
  )
}
