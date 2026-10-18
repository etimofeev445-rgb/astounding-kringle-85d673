import { ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCart, type CartItem } from '../lib/cart'
import { useI18n } from '../lib/i18n'
import { haptic } from '../lib/telegram'

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 rise">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-mute mt-1">{subtitle}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-panel/90 border border-line p-4 ${className}`}>{children}</div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-panel border border-line mb-4">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold tap ${
            value === o.value ? 'bg-sky text-white' : 'text-mute'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-2xl bg-panel-2 border border-line px-4 py-3 text-base text-white placeholder:text-mute/60 outline-none focus:border-sky'

export function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('uk-UA', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// Heart-style "add to Кошик" toggle used across screens. Hidden outside Telegram (no user to save for).
export function CartToggle({ item, className = '' }: { item: CartItem; className?: string }) {
  const { has, toggle, available } = useCart()
  const { t } = useI18n()
  if (!available) return null
  const saved = has(item.kind, item.ref)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        haptic(saved ? 'light' : 'medium')
        toggle(item)
      }}
      aria-pressed={saved}
      aria-label={saved ? t({ uk: 'Прибрати з кошика', ru: 'Убрать из корзины' }) : t({ uk: 'Додати в кошик', ru: 'Добавить в корзину' })}
      className={`tap h-9 w-9 shrink-0 rounded-xl grid place-items-center transition-colors ${
        saved ? 'bg-sun text-ink' : 'bg-panel-2 text-mute'
      } ${className}`}
    >
      <ShoppingCart size={17} strokeWidth={saved ? 2.4 : 1.8} />
    </button>
  )
}
