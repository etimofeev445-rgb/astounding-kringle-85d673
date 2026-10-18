// Thin wrapper around the Telegram WebApp SDK (loaded via <script> in __root).
// Every call is guarded so the app also works in a regular browser.

export interface NativeButton {
  setParams: (p: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
    has_shine_effect?: boolean
    // SecondaryButton only: where it sits relative to MainButton.
    position?: 'left' | 'right' | 'top' | 'bottom'
  }) => void
  show: () => void
  hide: () => void
  onClick: (cb: () => void) => void
  offClick: (cb: () => void) => void
  showProgress?: (leaveActive?: boolean) => void
  hideProgress?: () => void
}

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending'

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  showAlert?: (msg: string) => void
  showConfirm?: (msg: string, cb: (ok: boolean) => void) => void
  openInvoice?: (url: string, cb?: (status: InvoiceStatus) => void) => void
  initData?: string
  initDataUnsafe?: { user?: { first_name?: string; username?: string; language_code?: string }; start_param?: string }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  MainButton?: NativeButton
  SecondaryButton?: NativeButton
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    selectionChanged: () => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function tg(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined
  return window.Telegram?.WebApp
}

export function initTelegram() {
  const app = tg()
  if (!app) return
  app.ready()
  app.expand()
  app.setHeaderColor?.('#0b1424')
  app.setBackgroundColor?.('#0b1424')
}

export function haptic(style: HapticStyle = 'light') {
  tg()?.HapticFeedback?.impactOccurred(style)
}

export function openLink(url: string) {
  const app = tg()
  if (url.startsWith('https://t.me/') && app?.openTelegramLink) {
    app.openTelegramLink(url)
  } else if (app?.openLink) {
    app.openLink(url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

export function userName(): string | undefined {
  return tg()?.initDataUnsafe?.user?.first_name
}

export function userHandle(): string | undefined {
  const u = tg()?.initDataUnsafe?.user?.username
  return u ? `@${u}` : undefined
}

// Signed Mini App init data for server calls; empty outside Telegram.
export function initData(): string {
  return tg()?.initData ?? ''
}

export function confirmAction(msg: string): Promise<boolean> {
  const app = tg()
  if (app?.initData && app.showConfirm) return new Promise((r) => app.showConfirm!(msg, r))
  return Promise.resolve(window.confirm(msg))
}

// Native Telegram popup, falling back to window.alert in a regular browser.
export function showAlert(msg: string) {
  const app = tg()
  try {
    if (app?.initData && app.showAlert) return app.showAlert(msg)
  } catch {
    // e.g. another popup is already open
  }
  window.alert(msg)
}

export function notify(type: 'error' | 'success' | 'warning') {
  tg()?.HapticFeedback?.notificationOccurred?.(type)
}

export function shareText(text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(text)}`
  openLink(url)
}

// `startapp` deep-link payload (t.me/<bot>/<app>?startapp=...), empty outside Telegram.
export function startParam(): string {
  return tg()?.initDataUnsafe?.start_param ?? ''
}
