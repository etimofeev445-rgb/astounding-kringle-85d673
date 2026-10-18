import { MapPin, Package, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { findWarehouses, trackParcel, type Parcel, type Warehouse } from '../../server/novaposhta'
import { useI18n } from '../../lib/i18n'
import { haptic, openLink } from '../../lib/telegram'
import { Card, Field, ScreenTitle, Segmented, inputCls } from '../ui'

type Tab = 'track' | 'branches'

export default function NovaPoshta() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('track')
  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Нова пошта', ru: 'Новая почта' })}
        subtitle={t({ uk: 'Відстеження посилок і пошук відділень', ru: 'Отслеживание посылок и поиск отделений' })}
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'track', label: t({ uk: 'Відстеження', ru: 'Отслеживание' }) },
          { value: 'branches', label: t({ uk: 'Відділення', ru: 'Отделения' }) },
        ]}
      />
      {tab === 'track' ? <Track /> : <Branches />}
      <button
        onClick={() => openLink('https://novaposhta.ua')}
        className="tap w-full mt-4 py-3 text-sm font-semibold text-sky"
      >
        {t({ uk: 'Відкрити сайт novaposhta.ua', ru: 'Открыть сайт novaposhta.ua' })}
      </button>
    </div>
  )
}

// Delivered / received statuses per Nova Poshta's StatusCode list.
const DONE = ['9', '10', '11']

function Track() {
  const { t } = useI18n()
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parcel, setParcel] = useState<Parcel | null>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = number.replace(/\D/g, '')
    if (n.length < 10) return setError(t({ uk: 'Введіть номер ТТН (14 цифр)', ru: 'Введите номер ТТН (14 цифр)' }))
    haptic()
    setBusy(true)
    setError('')
    try {
      const p = await trackParcel({ data: { number: n, phone } })
      setParcel(p)
      if (!p) setError(t({ uk: 'Посилку не знайдено', ru: 'Посылка не найдена' }))
    } catch {
      setError(t({ uk: 'Сервіс Нової пошти недоступний. Спробуйте пізніше.', ru: 'Сервис Новой почты недоступен. Попробуйте позже.' }))
    } finally {
      setBusy(false)
    }
  }

  const rows: [string, string][] = parcel
    ? ([
        [t({ uk: 'Звідки', ru: 'Откуда' }), parcel.citySender],
        [t({ uk: 'Куди', ru: 'Куда' }), parcel.cityRecipient],
        [t({ uk: 'Відділення', ru: 'Отделение' }), parcel.warehouseRecipient],
        [t({ uk: 'Очікувана доставка', ru: 'Ожидаемая доставка' }), parcel.scheduledDate],
        [t({ uk: 'Отримано', ru: 'Получено' }), parcel.deliveredDate],
        [t({ uk: 'Вага', ru: 'Вес' }), parcel.weight ? `${parcel.weight} кг` : ''],
        [t({ uk: 'Вартість доставки', ru: 'Стоимость доставки' }), parcel.cost ? `${parcel.cost} ₴` : ''],
      ].filter(([, v]) => v) as [string, string][])
    : []

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t({ uk: 'Номер ТТН', ru: 'Номер ТТН' })}>
            <input
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="20 4000 0000 0000"
              className={`${inputCls} font-display tracking-wider`}
            />
          </Field>
          <Field label={t({ uk: "Телефон (необов'язково, для деталей)", ru: 'Телефон (необязательно, для деталей)' })}>
            <input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="380 XX XXX XX XX"
              className={inputCls}
            />
          </Field>
          <button
            disabled={busy}
            className="tap w-full rounded-2xl bg-[#e2231a] py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Package size={18} />
            {busy ? t({ uk: 'Пошук…', ru: 'Поиск…' }) : t({ uk: 'Відстежити', ru: 'Отследить' })}
          </button>
        </form>
      </Card>

      {error && <Card className="text-sm text-down">{error}</Card>}

      {parcel && (
        <Card className="space-y-3">
          <div>
            <div className="text-xs text-mute">ТТН {parcel.number}</div>
            <div className={`font-display font-bold text-lg ${DONE.includes(parcel.statusCode) ? 'text-up' : 'text-sun'}`}>
              {parcel.status || t({ uk: 'Статус невідомий', ru: 'Статус неизвестен' })}
            </div>
          </div>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 text-sm border-t border-line pt-2">
              <span className="text-mute shrink-0">{k}</span>
              <span className="text-right font-semibold">{v}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function Branches() {
  const { t } = useI18n()
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [list, setList] = useState<Warehouse[]>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (city.trim().length < 2) return setError(t({ uk: 'Введіть назву міста', ru: 'Введите название города' }))
    haptic()
    setBusy(true)
    setError('')
    try {
      const r = await findWarehouses({ data: { city, query } })
      setList(r)
      if (!r.length) setError(
          t({
            uk: 'Нічого не знайдено. Перевірте назву міста українською.',
            ru: 'Ничего не найдено. Проверьте название города на украинском.',
          }),
        )
    } catch {
      setError(t({ uk: 'Сервіс Нової пошти недоступний. Спробуйте пізніше.', ru: 'Сервис Новой почты недоступен. Попробуйте позже.' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label={t({ uk: 'Місто', ru: 'Город' })}>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Київ" className={inputCls} />
          </Field>
          <Field label={t({ uk: "Номер або вулиця (необов'язково)", ru: 'Номер или улица (необязательно)' })}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Хрещатик або 25" className={inputCls} />
          </Field>
          <button
            disabled={busy}
            className="tap w-full rounded-2xl bg-[#e2231a] py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Search size={18} />
            {busy ? t({ uk: 'Пошук…', ru: 'Поиск…' }) : t({ uk: 'Знайти відділення', ru: 'Найти отделение' })}
          </button>
        </form>
      </Card>

      {error && <Card className="text-sm text-down">{error}</Card>}

      {list?.map((w) => (
        <Card key={w.ref} className="flex gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-[#e2231a]/15 text-[#ff5a52] grid place-items-center font-display font-bold text-sm">
            {w.postomat ? <Package size={18} /> : w.number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm">{w.title}</div>
            {w.schedule && <div className="text-xs text-mute mt-1">{w.schedule}</div>}
            <button
              onClick={() => openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Нова пошта ' + w.address)}`)}
              className="tap mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky"
            >
              <MapPin size={14} /> {t({ uk: 'На карті', ru: 'На карте' })}
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
