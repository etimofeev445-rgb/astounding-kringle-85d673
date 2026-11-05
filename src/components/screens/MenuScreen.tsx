import { ChevronDown, ChevronRight, ExternalLink, LifeBuoy, MapPinPlus, Megaphone, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { menuItemView, screenView, type MenuItem } from '../../lib/appConfig'
import { useAppConfig } from '../../lib/appState'
import type { CartItem } from '../../lib/cart'
import { SERVICES } from '../../data/links'
import { useI18n } from '../../lib/i18n'
import { type Go, type Screen } from '../../lib/nav'
import { haptic, openLink } from '../../lib/telegram'
import { CartToggle, ScreenTitle } from '../ui'

export default function MenuScreen({ go, addPlace, openAdmin }: { go: Go; addPlace: () => void; openAdmin?: () => void }) {
  const { lang, t } = useI18n()
  const { menu, features } = useAppConfig()
  const config = useAppConfig()
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const available = (id: Screen) => !menu.disabledScreens.includes(id)
  // The «Розділи» list comes straight from the admin's config: active entries, in the admin's order.
  const items = menu.items.filter((i) => i.enabled && (i.action !== 'screen' || available(i.target as Screen)))
  const sectionItem = (id: Screen): CartItem => {
    const v = screenView(config, id, lang)
    return { kind: 'section', ref: id, title: v.title, subtitle: v.hint, url: '' }
  }
  // What the cart button saves for an entry; info blocks have nothing to reopen, so they get none.
  const cartItemFor = (i: MenuItem): CartItem | null => {
    const v = menuItemView(i, lang)
    if (i.action === 'screen') return sectionItem(i.target as Screen)
    if (i.action === 'info') return null
    return { kind: i.action === 'bot' ? 'channel' : 'service', ref: `menu_${i.id}`, title: v.title, subtitle: v.hint, url: i.target }
  }
  const activate = (i: MenuItem) => {
    if (i.action === 'screen') return go(i.target as Screen)
    if (i.action === 'info') return setOpenInfo(openInfo === i.id ? null : i.id)
    haptic('medium')
    openLink(i.target, { inApp: i.openIn === 'app' })
  }

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Меню', ru: 'Меню' })}
        subtitle={t({ uk: 'Сервіси та розділи застосунку', ru: 'Сервисы и разделы приложения' })}
      />

      {openAdmin && (
        <button
          onClick={openAdmin}
          className="tap rise w-full mb-4 flex items-center gap-3 rounded-2xl border border-adm/40 bg-adm/10 px-4 py-3 text-left"
        >
          <ShieldCheck size={20} className="text-adm shrink-0" />
          <span className="flex-1 font-semibold">Адмін-панель</span>
          <ChevronRight size={18} className="text-adm" />
        </button>
      )}

      {available('ads') && (
      <div className="rise glow-btn w-full rounded-3xl p-4 mb-6 flex items-center gap-3 text-white">
        <button onClick={() => go('ads')} className="tap relative flex-1 min-w-0 flex items-center gap-4 text-left">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/20 grid place-items-center">
            <Megaphone size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold">{t({ uk: 'Оголошення', ru: 'Объявления' })}</div>
            <div className="text-xs font-semibold opacity-90 mt-0.5">
              {t({ uk: 'Подати, переглянути, редагувати', ru: 'Подать, посмотреть, редактировать' })}
            </div>
          </div>
        </button>
        <CartToggle
          item={sectionItem('ads')}
          tone="onColor"
          className="relative"
          fallback={<ChevronRight size={20} className="relative opacity-80" />}
        />
      </div>
      )}

      {available('map') && (
      <div className="grid grid-cols-2 gap-3 -mt-3 mb-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => go('map')}
          className="tap rise rounded-3xl bg-panel/90 border border-line p-4 text-left cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="text-2xl">🗺</div>
            <CartToggle item={sectionItem('map')} />
          </div>
          <div className="font-display font-bold mt-2">{t({ uk: 'Карта', ru: 'Карта' })}</div>
          <div className="text-xs text-mute mt-0.5">{t({ uk: 'Каталог бізнесів', ru: 'Каталог бизнесов' })}</div>
        </div>
        {features.catalogPosting && (
          <button
            onClick={addPlace}
            className="tap rise rounded-3xl bg-sky/15 border border-sky/40 p-4 text-left"
          >
            <MapPinPlus size={26} className="text-sky" />
            <div className="font-display font-bold mt-2 leading-tight">{t({ uk: '+ Додати свій бізнес / оголошення', ru: '+ Добавить свой бизнес / объявление' })}</div>
          </button>
        )}
      </div>
      )}

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

      {available('support') && (
        <div className="rise w-full mb-6 flex items-center gap-3 rounded-3xl bg-panel/90 border border-line pl-4 pr-3 py-3">
          <button onClick={() => go('support')} className="tap flex-1 min-w-0 flex items-center gap-3 text-left">
            <LifeBuoy size={22} className="text-sky shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{t({ uk: 'Підтримка', ru: 'Поддержка' })}</span>
              <span className="block text-xs text-mute truncate">{t({ uk: 'Чат з AI-консультантом і адміністратором', ru: 'Чат с AI-консультантом и администратором' })}</span>
            </span>
          </button>
          <CartToggle
            item={{
              kind: 'section',
              ref: 'support',
              title: t({ uk: 'Підтримка', ru: 'Поддержка' }),
              subtitle: t({ uk: 'Чат з AI-консультантом і адміністратором', ru: 'Чат с AI-консультантом и администратором' }),
              url: '',
            }}
            compact
            fallback={<ChevronRight size={18} className="text-mute" />}
          />
        </div>
      )}

      <h2 className="text-xs font-semibold uppercase tracking-wider text-mute mb-2 px-1">
        {t({ uk: 'Розділи', ru: 'Разделы' })}
      </h2>
      <div className="rounded-3xl bg-panel/90 border border-line divide-y divide-line overflow-hidden">
        {items.map((i) => {
          const v = menuItemView(i, lang)
          const cart = cartItemFor(i)
          const external = i.action === 'link' || i.action === 'bot'
          const chevron = i.action === 'info' ? (
            <ChevronDown size={18} className={`text-mute transition-transform ${openInfo === i.id ? 'rotate-180' : ''}`} />
          ) : external ? (
            <ExternalLink size={16} className="text-mute" />
          ) : (
            <ChevronRight size={18} className="text-mute" />
          )
          return (
            <div key={i.id}>
              <div className="flex items-center gap-3 pl-4 pr-3 py-2.5">
                <button onClick={() => activate(i)} aria-expanded={i.action === 'info' ? openInfo === i.id : undefined} className="tap flex-1 min-w-0 flex items-center gap-3 text-left">
                  <span className="text-xl">{v.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{v.title}</span>
                    {v.hint && <span className="block text-xs text-mute truncate">{v.hint}</span>}
                  </span>
                  {i.buttonText && external ? (
                    <span className="shrink-0 rounded-lg bg-sky/15 text-sky px-2.5 py-1 text-xs font-bold">{i.buttonText}</span>
                  ) : (
                    cart ? null : chevron
                  )}
                </button>
                {cart ? <CartToggle item={cart} compact fallback={chevron} /> : null}
              </div>
              {i.action === 'info' && openInfo === i.id && (
                <div className="px-4 pb-3.5 -mt-1">
                  <p className="text-sm text-white/85 whitespace-pre-wrap break-words">{i.body}</p>
                  {i.target && (
                    <button
                      onClick={() => {
                        haptic('medium')
                        openLink(i.target, { inApp: i.openIn === 'app' })
                      }}
                      className="tap mt-3 rounded-xl bg-sky px-4 py-2.5 text-sm font-bold text-white"
                    >
                      {i.buttonText || t({ uk: 'Відкрити', ru: 'Открыть' })}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
