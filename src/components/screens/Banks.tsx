import { Copy, ExternalLink, Phone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { banks } from '../../data/banks'
import { useI18n } from '../../lib/i18n'
import { haptic, openLink } from '../../lib/telegram'
import { CartToggle, ScreenTitle, Segmented, inputCls } from '../ui'

type Filter = 'all' | 'state' | 'private'

export default function Banks({ initialQuery = '' }: { initialQuery?: string }) {
  const { t } = useI18n()
  const [q, setQ] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return banks.filter(
      (b) =>
        (filter === 'all' || (filter === 'state' ? b.state : !b.state)) &&
        (!s || [b.name, b.mfo, b.edrpou, ...b.tags].some((x) => x.toLowerCase().includes(s))),
    )
  }, [q, filter])

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value)
    haptic('medium')
    setCopied(key)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Банки України', ru: 'Банки Украины' })}
        subtitle={`${banks.length} ${t({ uk: 'банків · реквізити та контакти', ru: 'банков · реквизиты и контакты' })}`}
      />
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t({ uk: 'Назва, МФО або ЄДРПОУ', ru: 'Название, МФО или ЕГРПОУ' })}
          className={`${inputCls} pl-11`}
        />
      </div>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t({ uk: 'Усі', ru: 'Все' }) },
          { value: 'state', label: t({ uk: 'Державні', ru: 'Государственные' }) },
          { value: 'private', label: t({ uk: 'Приватні', ru: 'Частные' }) },
        ]}
      />

      <div className="space-y-2">
        {list.map((b) => {
          const isOpen = open === b.id
          return (
            <div key={b.id} className="rounded-3xl bg-panel border border-line overflow-hidden">
              <div className="flex items-center pr-3.5">
              <button
                onClick={() => {
                  haptic()
                  setOpen(isOpen ? null : b.id)
                }}
                className="flex-1 min-w-0 flex items-center gap-3 p-3.5 text-left"
              >
                <span
                  className="h-11 w-11 rounded-2xl grid place-items-center font-display font-bold text-lg shrink-0"
                  style={{ background: b.color, color: b.color === '#fee600' ? '#111' : '#fff' }}
                >
                  {b.short}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center gap-2">
                    {b.name}
                    {b.state && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-sun/15 text-sun">
                        {t({ uk: 'держ', ru: 'гос' })}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-mute">{t({ uk: 'МФО', ru: 'МФО' })} {b.mfo}</div>
                </div>
                <span className={`text-mute transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>
              <CartToggle item={{ kind: 'bank', ref: b.id, title: b.name, subtitle: `МФО ${b.mfo}`, url: '' }} />
              </div>

              {isOpen && (
                <div className="px-3.5 pb-3.5 space-y-2 rise">
                  {[
                    ['МФО', t({ uk: 'МФО', ru: 'МФО' }), b.mfo],
                    ['ЄДРПОУ', t({ uk: 'ЄДРПОУ', ru: 'ЕГРПОУ' }), b.edrpou],
                  ].map(([k, label, v]) => (
                    <button
                      key={k}
                      onClick={() => copy(b.id + k, v)}
                      className="tap w-full flex items-center justify-between rounded-2xl bg-panel-2 px-4 py-2.5"
                    >
                      <span className="text-sm text-mute">{label}</span>
                      <span className="flex items-center gap-2 font-display">
                        {copied === b.id + k ? <span className="text-up text-sm">{t({ uk: 'Скопійовано', ru: 'Скопировано' })}</span> : v}
                        <Copy size={14} className="text-mute" />
                      </span>
                    </button>
                  ))}
                  <div className="flex gap-2">
                    {b.hotline && (
                      <a
                        href={`tel:${b.hotline.replace(/\s/g, '')}`}
                        className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sky py-2.5 font-semibold"
                      >
                        <Phone size={16} /> {b.hotline}
                      </a>
                    )}
                    <button
                      onClick={() => openLink(b.site)}
                      className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-line py-2.5 font-semibold"
                    >
                      <ExternalLink size={16} /> {t({ uk: 'Сайт', ru: 'Сайт' })}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {list.length === 0 && <p className="text-center text-mute py-10">{t({ uk: 'Нічого не знайдено', ru: 'Ничего не найдено' })}</p>}
      </div>
      <p className="text-xs text-mute mt-4 px-1">
        {t({
          uk: 'Довідкова інформація. Актуальні реквізити перевіряйте на сайті банку.',
          ru: 'Справочная информация. Актуальные реквизиты проверяйте на сайте банка.'
        })}
      </p>
    </div>
  )
}
