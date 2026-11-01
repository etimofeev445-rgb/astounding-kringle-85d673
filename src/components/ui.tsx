import { ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAppConfig } from '../lib/appState'
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
// `tone` adapts the idle colours to the surface it sits on (default panel, coloured tile, light tile);
// `fallback` is rendered when the cart is unavailable (e.g. a chevron in place of the button).
export function CartToggle({
  item,
  className = '',
  tone = 'default',
  compact = false,
  fallback = null,
}: {
  item: CartItem
  className?: string
  tone?: 'default' | 'onColor' | 'onLight'
  compact?: boolean
  fallback?: ReactNode
}) {
  const { has, toggle, available } = useCart()
  const { t } = useI18n()
  const { features } = useAppConfig()
  if (!available || !features.cart) return <>{fallback}</>
  const saved = has(item.kind, item.ref)
  const idle = tone === 'onColor' ? 'bg-white/20 text-white' : tone === 'onLight' ? 'bg-ink/10 text-ink' : 'bg-panel-2 text-mute'
  const on = tone === 'onColor' ? 'bg-white text-ink' : tone === 'onLight' ? 'bg-ink text-sun' : 'bg-sun text-ink'
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
      className={`tap ${compact ? 'h-8 w-8' : 'h-9 w-9'} shrink-0 rounded-xl grid place-items-center transition-colors ${
        saved ? on : idle
      } ${className}`}
    >
      <ShoppingCart size={compact ? 16 : 17} strokeWidth={saved ? 2.4 : 1.8} />
    </button>
  )
}
