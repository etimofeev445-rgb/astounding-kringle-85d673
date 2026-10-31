import {
  Bell, ClipboardList, FileText, Home, LayoutDashboard, LayoutList, LogOut, Megaphone, Settings, ShieldAlert,
  ShieldCheck, Users as UsersIcon, Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppConfig } from '../../lib/appConfig'
import { setAppConfig } from '../../lib/appState'
import { haptic, tg } from '../../lib/telegram'
import { adminCall, setAuthLostHandler, useAdminQuery } from './api'
import AuditLog from './AuditLog'
import Dashboard from './Dashboard'
import DocumentsAdmin from './DocumentsAdmin'
import { HomeEditor, MenuEditor } from './ConfigEditors'
import Listings from './Listings'
import Notifications from './Notifications'
import Orders from './Orders'
import SettingsAdmin from './SettingsAdmin'
import { ErrorBox, Loading } from './ui'
import Users from './Users'

export type Section = 'dashboard' | 'users' | 'listings' | 'home' | 'menu' | 'notify' | 'docs' | 'orders' | 'settings' | 'log'

const SECTIONS: { id: Section; label: string; Icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Огляд', Icon: LayoutDashboard },
  { id: 'users', label: 'Користувачі', Icon: UsersIcon },
  { id: 'listings', label: 'Оголошення', Icon: Megaphone },
  { id: 'home', label: 'Головна', Icon: Home },
  { id: 'menu', label: 'Меню', Icon: LayoutList },
  { id: 'notify', label: 'Розсилки', Icon: Bell },
  { id: 'docs', label: 'Документи', Icon: FileText },
  { id: 'orders', label: 'Поповнення', Icon: Wallet },
  { id: 'settings', label: 'Налаштування', Icon: Settings },
  { id: 'log', label: 'Журнал', Icon: ClipboardList },
]

export interface ConfigCtx {
  config: AppConfig
  save: (next: AppConfig, area: string) => Promise<void>
}

export default function AdminApp({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<Section>('dashboard')
  const [denied, setDenied] = useState<'forbidden' | 'expired' | null>(null)
  const session = useAdminQuery('session')
  const cfg = useAdminQuery('config.get')

  useEffect(() => {
    setAuthLostHandler(setDenied)
    return () => setAuthLostHandler(null)
  }, [])

  // Telegram's back button leaves the panel.
  useEffect(() => {
    const back = tg()?.BackButton
    if (!back) return
    const onBack = () => onExit()
    back.show()
    back.onClick(onBack)
    return () => back.offClick(onBack)
  }, [onExit])

  const go = (s: Section) => {
    haptic()
    setSection(s)
    window.scrollTo({ top: 0 })
  }

  const save = async (next: AppConfig, area: string) => {
    const saved = await adminCall('config.save', { config: next, area })
    cfg.setData(saved)
    setAppConfig(saved)
  }

  return (
    <div className="admin min-h-screen bg-adm-ink">
      <header className="sticky top-0 z-30 bg-adm-ink/90 backdrop-blur-xl border-b border-adm-line">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-adm text-adm-ink grid place-items-center">
            <ShieldCheck size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold leading-tight">
              UAT Market <span className="text-adm">Admin</span>
            </div>
            <div className="text-[11px] text-mute truncate">{session.data?.admin.name ?? '…'}</div>
          </div>
          <button onClick={onExit} className="tap flex items-center gap-1.5 rounded-xl border border-adm-line px-3 py-2 text-xs font-semibold text-mute">
            <LogOut size={14} /> Вийти
          </button>
        </div>
        {!denied && (
          <nav className="no-scrollbar mx-auto max-w-2xl px-4 pb-2 flex gap-1.5 overflow-x-auto">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={section === id ? 'page' : undefined}
                className={`tap shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                  section === id ? 'bg-adm text-adm-ink' : 'text-mute bg-adm-panel border border-adm-line'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 pb-16">
        {denied ? (
          <Denied code={denied} onExit={onExit} />
        ) : session.error ? (
          <ErrorBox message={session.error} retry={session.reload} />
        ) : !session.data ? (
          <Loading />
        ) : (
          <div key={section} className="rise">
            {section === 'dashboard' && <Dashboard env={session.data.env} go={go} />}
            {section === 'users' && <Users />}
            {section === 'listings' && <Listings />}
            {section === 'notify' && <Notifications />}
            {section === 'docs' && <DocumentsAdmin />}
            {section === 'orders' && <Orders />}
            {section === 'log' && <AuditLog />}
            {(section === 'home' || section === 'menu' || section === 'settings') &&
              (cfg.error ? (
                <ErrorBox message={cfg.error} retry={cfg.reload} />
              ) : !cfg.data ? (
                <Loading />
              ) : section === 'home' ? (
                <HomeEditor config={cfg.data} save={save} />
              ) : section === 'menu' ? (
                <MenuEditor config={cfg.data} save={save} />
              ) : (
                <SettingsAdmin config={cfg.data} save={save} env={session.data.env} />
              ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Denied({ code, onExit }: { code: 'forbidden' | 'expired'; onExit: () => void }) {
  return (
    <div className="rounded-2xl border border-down/30 bg-down/10 p-6 text-center">
      <ShieldAlert size={36} className="mx-auto text-down mb-3" />
      <div className="font-display font-bold mb-1">{code === 'expired' ? 'Сесія застаріла' : 'Доступ заборонено'}</div>
      <p className="text-sm text-mute mb-4">
        {code === 'expired'
          ? 'З міркувань безпеки дані входу дійсні 1 годину. Закрийте й знову відкрийте застосунок у Telegram.'
          : 'Ця панель доступна лише адміністратору UAT Market.'}
      </p>
      <button onClick={onExit} className="tap rounded-xl px-4 py-2.5 text-sm font-bold bg-adm text-adm-ink">
        Повернутися до застосунку
      </button>
    </div>
  )
}
