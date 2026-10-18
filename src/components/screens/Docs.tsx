import { ExternalLink, MapPin } from 'lucide-react'
import { DP_PHONE, DP_SITE, dpCountries } from '../../data/dpdocument'
import { useI18n } from '../../lib/i18n'
import { openLink } from '../../lib/telegram'
import { Card, ScreenTitle } from '../ui'

export default function Docs() {
  const { t } = useI18n()
  const total = dpCountries.reduce((n, c) => n + c.offices.length, 0)

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'ДП Документи', ru: 'ГП Документы' })}
        subtitle={`${t({ uk: 'Паспортний сервіс ДП «Документ»', ru: 'Паспортный сервис ГП «Документ»' })} · ${dpCountries.length} ${t({ uk: 'країн', ru: 'стран' })} · ${total} ${t({ uk: 'центрів', ru: 'центров' })}`}
      />

      <div className="space-y-3">
        {dpCountries.map((c, i) => (
          <div
            key={c.id}
            style={{ animationDelay: `${40 * i}ms` }}
            className="rise rounded-3xl bg-panel border border-line overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <span className="text-2xl">{c.flag}</span>
              <div className="font-display font-bold flex-1">{t(c.name)}</div>
              <span className="text-xs text-mute">{c.offices.length}</span>
            </div>
            {c.offices.map((o) => (
              <div key={o.city + o.address} className="flex gap-3 px-4 py-2.5 border-b border-line last:border-0">
                <MapPin size={16} className="text-sky mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {t({ uk: 'м. ', ru: 'г. ' })}
                    {o.city}
                  </div>
                  <div className="text-xs text-mute">{o.address}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Card className="mt-4 text-sm text-mute">
        {t({ uk: 'Довідковий телефон', ru: 'Справочный телефон' })}:{' '}
        <span className="text-white font-semibold">{DP_PHONE}</span>.{' '}
        {t({
          uk: 'Адреси можуть змінюватися — перевіряйте перед візитом.',
          ru: 'Адреса могут меняться — проверяйте перед визитом.'
        })}
        <button
          onClick={() => openLink(DP_SITE)}
          className="tap mt-3 w-full flex items-center justify-center gap-2 rounded-2xl bg-sky text-white py-3 font-bold"
        >
          <ExternalLink size={16} />{' '}
          {t({ uk: 'Усі центри на pasport.org.ua', ru: 'Все центры на pasport.org.ua' })}
        </button>
      </Card>
    </div>
  )
}
