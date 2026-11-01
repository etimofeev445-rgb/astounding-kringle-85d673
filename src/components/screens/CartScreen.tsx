import { ChevronRight, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCart, type CartItem, type CartKind } from '../../lib/cart'
import { useI18n, type Tr } from '../../lib/i18n'
import { ALL_SCREENS, SCREENS, type Screen } from '../../lib/nav'
import { haptic, openLink } from '../../lib/telegram'
import { ScreenTitle, Segmented } from '../ui'
import { AdsBoard } from './AdsScreen'
import type { OpenTarget } from './SearchScreen'

type Tab = 'saved' | 'mine'

const KIND: Record<CartKind, { emoji: string; label: Tr }> = {
  ad: { emoji: '📢', label: { uk: 'Оголошення', ru: 'Объявление' } },
  card: { emoji: '💳', label: { uk: 'Карта', ru: 'Карта' } },
  bank: { emoji: '🏦', label: { uk: 'Банк', ru: 'Банк' } },
  service: { emoji: '🛵', label: { uk: 'Сервіс', ru: 'Сервис' } },
  channel: { emoji: '✈️', label: { uk: 'Канал', ru: 'Канал' } },
  section: { emoji: '📌', label: { uk: 'Розділ', ru: 'Раздел' } },
}

// Sections show the emoji of the screen they point to.
const EXTRA_EMOJI: Record<string, string> = { topup: '📱', telegram: '✈️', support: '🛟' }
const emojiOf = (i: CartItem) =>
  (i.kind === 'section' ? SCREENS.find((s) => s.id === i.ref)?.emoji ?? EXTRA_EMOJI[i.ref] : undefined) ?? KIND[i.kind].emoji

export default function CartScreen({ open }: { open: (t: OpenTarget) => void }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('saved')
  const { items, loaded, available, toggle } = useCart()

  const openItem = (i: CartItem) => {
    haptic()
    if (i.url) openLink(i.url)
    else if (i.kind === 'bank') open({ screen: 'banks', bankQuery: i.title })
    else if (i.kind === 'ad') open({ screen: 'ads' })
    else if (i.kind === 'section') {
      const screen = ALL_SCREENS.find((id) => id === i.ref)
      if (screen) open({ screen: screen as Screen })
    }
  }

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Кошик', ru: 'Корзина' })}
        subtitle={t({ uk: 'Збережене та ваші оголошення', ru: 'Сохранённое и ваши объявления' })}
      />
      <Segmented
        value={tab}
        onChange={(v) => {
          haptic()
          setTab(v)
        }}
        options={[
          { value: 'saved', label: `${t({ uk: 'Збережене', ru: 'Сохранённое' })}${items.length ? ` · ${items.length}` : ''}` },
          { value: 'mine', label: t({ uk: 'Мої оголошення', ru: 'Мои объявления' }) },
        ]}
      />

      {tab === 'mine' ? (
        <AdsBoard mine />
      ) : !loaded ? (
        <div className="h-24 rounded-3xl bg-panel border border-line animate-pulse" />
      ) : !available ? (
        <p className="text-center text-mute py-10">
          {t({ uk: 'Кошик доступний у застосунку Telegram', ru: 'Корзина доступна в приложении Telegram' })}
        </p>
      ) : items.length === 0 ? (
        <div className="text-center text-mute py-10">
          <ShoppingCart size={36} className="mx-auto mb-3 opacity-60" />
          {t({
            uk: 'Кошик порожній. Натискайте 🛒 біля розділів, карт, банків, сервісів і оголошень, щоб зберегти їх тут.',
            ru: 'Корзина пуста. Нажимайте 🛒 возле разделов, карт, банков, сервисов и объявлений, чтобы сохранить их здесь.',
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-panel/90 border border-line divide-y divide-line overflow-hidden">
          {items.map((i) => (
            <div key={`${i.kind}:${i.ref}`} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => openItem(i)} className="tap flex-1 min-w-0 flex items-center gap-3 text-left">
                <span className="text-xl">{emojiOf(i)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{i.title}</span>
                  <span className="block text-xs text-mute truncate">
                    {t(KIND[i.kind].label)}
                    {i.subtitle && ` · ${i.subtitle}`}
                  </span>
                </span>
                <ChevronRight size={18} className="text-mute shrink-0" />
              </button>
              <button
                onClick={() => {
                  haptic('medium')
                  toggle(i)
                }}
                aria-label={t({ uk: 'Прибрати з кошика', ru: 'Убрать из корзины' })}
                className="tap h-9 w-9 shrink-0 rounded-xl bg-down/15 text-down grid place-items-center"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
