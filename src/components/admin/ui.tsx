import { ArrowDown, ArrowUp, Loader2, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { confirmAction, haptic, notify, showAlert } from '../../lib/telegram'

// Admin-only primitives: violet accent on a darker, cooler surface so the panel never looks like
// the customer-facing app.

export const aInput =
  'w-full rounded-xl bg-adm-ink border border-adm-line px-3.5 py-2.5 text-[15px] text-white placeholder:text-mute/50 outline-none focus:border-adm'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-adm-panel border border-adm-line p-4 ${className}`}>{children}</div>
}

export function Title({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-display text-lg font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="block text-[11px] font-semibold uppercase tracking-wider text-mute mb-1.5">{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {hint && <span className="block text-[11px] text-mute mt-1">{hint}</span>}
    </label>
  )
}

type Tone = 'primary' | 'ghost' | 'danger' | 'ok'
const TONES: Record<Tone, string> = {
  primary: 'bg-adm text-adm-ink',
  ghost: 'bg-adm-ink border border-adm-line text-white',
  danger: 'bg-down/15 text-down border border-down/30',
  ok: 'bg-up/15 text-up border border-up/30',
}

export function Btn({
  children,
  onClick,
  tone = 'ghost',
  disabled,
  busy,
  className = '',
  small,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: Tone
  disabled?: boolean
  busy?: boolean
  className?: string
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onClick?.()
      }}
      disabled={disabled || busy}
      className={`tap inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold disabled:opacity-40 ${
        small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'
      } ${TONES[tone]} ${className}`}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic()
        onChange(!checked)
      }}
      className={`tap relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-adm' : 'bg-adm-line'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

const BADGES: Record<string, string> = {
  active: 'bg-up/15 text-up',
  approved: 'bg-up/15 text-up',
  fulfilled: 'bg-up/15 text-up',
  done: 'bg-up/15 text-up',
  resolved: 'bg-up/15 text-up',
  pending: 'bg-sun/15 text-sun',
  open: 'bg-sun/15 text-sun',
  paid: 'bg-sun/15 text-sun',
  processing: 'bg-sky/15 text-sky',
  sending: 'bg-sky/15 text-sky',
  rejected: 'bg-down/15 text-down',
  deleted: 'bg-white/10 text-mute',
  dismissed: 'bg-white/10 text-mute',
  failed: 'bg-down/15 text-down',
  blocked: 'bg-down/15 text-down',
}
const BADGE_TEXT: Record<string, string> = {
  active: 'активне',
  approved: 'схвалено',
  fulfilled: 'виконано',
  done: 'завершено',
  resolved: 'вирішено',
  pending: 'на перевірці',
  open: 'відкрита',
  paid: 'оплачено',
  processing: 'обробка',
  sending: 'надсилається',
  rejected: 'відхилено',
  deleted: 'видалено',
  dismissed: 'відхилена',
  failed: 'помилка',
  blocked: 'заблоковано',
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold ${BADGES[status] ?? 'bg-white/10 text-mute'}`}>
      {children ?? BADGE_TEXT[status] ?? status}
    </span>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-mute text-sm">
      <Loader2 size={18} className="animate-spin" /> Завантаження…
    </div>
  )
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-2xl border border-down/30 bg-down/10 p-4 text-sm text-down flex items-center gap-3">
      <span className="flex-1">{message}</span>
      {retry && (
        <button onClick={retry} className="tap flex items-center gap-1 font-semibold">
          <RefreshCw size={14} /> Повторити
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-adm-line p-6 text-center text-sm text-mute">{children}</div>
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="no-scrollbar -mx-4 px-4 flex gap-1.5 overflow-x-auto mb-3">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic()
            onChange(o.value)
          }}
          className={`tap shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border ${
            value === o.value ? 'bg-adm border-adm text-adm-ink' : 'bg-adm-panel border-adm-line text-mute'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Moves item i one step up/down; used by every "order" editor.
export function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function OrderButtons({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  return (
    <div className="flex gap-1 shrink-0">
      <button type="button" onClick={onUp} disabled={first} aria-label="Вище" className="tap h-8 w-8 rounded-lg bg-adm-ink border border-adm-line grid place-items-center disabled:opacity-30">
        <ArrowUp size={15} />
      </button>
      <button type="button" onClick={onDown} disabled={last} aria-label="Нижче" className="tap h-8 w-8 rounded-lg bg-adm-ink border border-adm-line grid place-items-center disabled:opacity-30">
        <ArrowDown size={15} />
      </button>
    </div>
  )
}

// Runs an admin action with busy state, success haptics and an alert on failure.
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async <T,>(id: string, fn: () => Promise<T>, opts: { confirm?: string; done?: string } = {}) => {
    if (busy) return
    if (opts.confirm && !(await confirmAction(opts.confirm))) return
    setBusy(id)
    try {
      const r = await fn()
      notify('success')
      if (opts.done) showAlert(opts.done)
      return r
    } catch (e) {
      notify('error')
      showAlert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}

export const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
