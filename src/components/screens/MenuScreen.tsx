import { ChevronRight, ExternalLink, MapPinPlus, Megaphone } from 'lucide-react'
import { SERVICES } from '../../data/links'
import { useI18n } from '../../lib/i18n'
import { SCREENS, type Go } from '../../lib/nav'
import { haptic, openLink } from '../../lib/telegram'
import { CartToggle, ScreenTitle } from '../ui'

export default function MenuScreen({ go, addPlace }: { go: Go; addPlace: () => void }) {
  const { t } = useI18n()

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Меню', ru: 'Меню' })}
        subtitle={t({ uk: 'Сервіси та розділи застосунку', ru: 'Сервисы и разделы приложения' })}
      />

      <button
        onClick={() => go('ads')}
        className="tap rise glow-btn w-full text-left rounded-3xl p-4 mb-6 flex items-center gap-4 text-white"
      >
        <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-white/20 grid place-items-center">
          <Megaphone size={22} />
        </div>
        <div className="relative flex-1">
          <div className="font-display font-bold">{t({ uk: 'Оголошення', ru: 'Объявления' })}</div>
          <div className="text-xs font-semibold opacity-90 mt-0.5">
            {t({ uk: 'Подати, переглянути, редагувати', ru: 'Подать, посмотреть, редактировать' })}
          </div>
        </div>
        <ChevronRight size={20} className="relative opacity-80" />
      </button>

      <div className="grid grid-cols-2 gap-3 -mt-3 mb-6">
        <button
          onClick={() => go('map')}
          className="tap rise rounded-3xl bg-panel/90 border border-line p-4 text-left"
        >
          <div className="text-2xl">🗺</div>
          <div className="font-display font-bold mt-2">{t({ uk: 'Карта', ru: 'Карта' })}</div>
          <div className="text-xs text-mute mt-0.5">{t({ uk: 'Каталог бізнесів', ru: 'Каталог бизнесов' })}</div>
        </button>
        <button
          onClick={addPlace}
          className="tap rise rounded-3xl bg-sky/15 border border-sky/40 p-4 text-left"
        >
          <MapPinPlus size={26} className="text-sky" />
          <div className="font-display font-bold mt-2 leading-tight">{t({ uk: '+ Додати свій бізнес / оголошення', ru: '+ Добавить свой бизнес / объявление' })}</div>
        </button>
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-mute mb-2 px-1">
        {t({ uk: 'Доставка та таксі', ru: 'Доставка и такси' })}
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {SERVICES.map((s, i) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              haptic('medium')
              openLink(s.url)
            }}
            className="tap rise rounded-3xl bg-panel/90 border border-line p-4 text-left cursor-pointer"
            style={{ animationDelay: `${60 * i}ms` }}
          >
            <div className="flex items-start justify-between">
              <div
                className="h-11 w-11 rounded-2xl grid place-items-center font-display font-black text-lg"
                style={{ background: s.bg, color: s.fg }}
              >
                {s.name[0]}
              </div>
              <CartToggle item={{ kind: 'service', ref: s.id, title: s.name, subtitle: t(s.hint), url: s.url }} />
            </div>
            <div className="font-display font-bold mt-3">{s.name}</div>
            <div className="text-xs text-mute mt-0.5 leading-snug flex items-center gap-1">
              <span className="flex-1">{t(s.hint)}</span>
              <ExternalLink size={12} className="shrink-0" />
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-mute mb-2 px-1">
        {t({ uk: 'Розділи', ru: 'Разделы' })}
      </h2>
      <div className="rounded-3xl bg-panel/90 border border-line divide-y divide-line overflow-hidden">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            onClick={() => go(s.id)}
            className="tap w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <span className="text-xl">{s.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{t(s.title)}</span>
              <span className="block text-xs text-mute truncate">{t(s.hint)}</span>
            </span>
            <ChevronRight size={18} className="text-mute" />
          </button>
        ))}
      </div>
    </div>
  )
}
