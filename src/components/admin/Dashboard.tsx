import { AlertTriangle, CheckCircle2, ChevronRight, Flag, Megaphone, Store, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Section } from './AdminApp'
import { useAdminQuery } from './api'
import { ErrorBox, Loading, Panel, Title } from './ui'

type Env = { botToken: boolean; webhookSecret: boolean; providerToken: boolean; adminChat: boolean; aggregator: boolean; miniAppUrl: boolean }

function Stat({ label, value, sub, onClick, Icon, alert }: { label: string; value: ReactNode; sub?: string; onClick?: () => void; Icon: typeof Users; alert?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`tap text-left rounded-2xl border p-3.5 ${alert ? 'border-sun/40 bg-sun/10' : 'border-adm-line bg-adm-panel'}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-mute">
        <Icon size={13} /> {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-mute mt-0.5">{sub}</div>}
    </button>
  )
}

export default function Dashboard({ env, go }: { env: Env; go: (s: Section) => void }) {
  const { data, error, loading, reload } = useAdminQuery('stats')
  if (error) return <ErrorBox message={error} retry={reload} />
  if (loading && !data) return <Loading />
  if (!data) return null
  const { users, content, orders, ordersAttention, days } = data
  const pending = content.adsPending + content.placesPending

  const missing = [
    !env.botToken && 'TELEGRAM_BOT_TOKEN — без нього не працюють вхід, канал і розсилки',
    !env.webhookSecret && 'TELEGRAM_WEBHOOK_SECRET — потрібен для webhook бота',
    !env.adminChat && 'TELEGRAM_ADMIN_CHAT_ID — сповіщення про оплати не надходитимуть',
    !env.providerToken && 'TELEGRAM_PROVIDER_TOKEN — оплата в застосунку вимкнена, працюють сайти операторів',
    !env.aggregator && 'TOPUP_API_URL / TOPUP_API_KEY — поповнення виконуються вручну',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat Icon={Users} label="Користувачі" value={users.total} sub={`+${users.today} сьогодні · +${users.week} за 7 днів`} onClick={() => go('users')} />
        <Stat Icon={Users} label="Активні 7 днів" value={users.active7d} sub={`нових за 30 днів: ${users.month}`} />
        <Stat Icon={Megaphone} label="Оголошення" value={content.adsActive} sub={`бізнес-карток: ${content.placesActive}`} onClick={() => go('listings')} />
        <Stat Icon={Store} label="На перевірці" value={pending} sub="нові оголошення та картки" onClick={() => go('listings')} alert={pending > 0} />
        <Stat Icon={Flag} label="Скарги" value={content.reportsOpen} sub="відкриті" onClick={() => go('listings')} alert={content.reportsOpen > 0} />
        <Stat
          Icon={Wallet}
          label="Поповнення"
          value={orders.fulfilled?.n ?? 0}
          sub={`виконано на ${(orders.fulfilled?.sum ?? 0).toLocaleString('uk-UA')} ₴`}
          onClick={() => go('orders')}
          alert={ordersAttention > 0}
        />
      </div>

      {ordersAttention > 0 && (
        <button onClick={() => go('orders')} className="tap w-full flex items-center gap-3 rounded-2xl border border-sun/40 bg-sun/10 p-3.5 text-left">
          <AlertTriangle size={18} className="text-sun shrink-0" />
          <span className="flex-1 text-sm font-semibold">Оплачені поповнення, що потребують уваги: {ordersAttention}</span>
          <ChevronRight size={18} className="text-sun" />
        </button>
      )}

      <Panel>
        <Title>Активність за 14 днів</Title>
        <ActivityChart days={days} />
      </Panel>

      <Panel>
        <Title>Інтеграції</Title>
        {missing.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-up">
            <CheckCircle2 size={16} /> Усі ключі налаштовано
          </div>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {missing.map((m) => (
              <li key={m} className="flex gap-2 text-white/85">
                <AlertTriangle size={15} className="text-sun shrink-0 mt-0.5" /> {m}
              </li>
            ))}
          </ul>
        )}
        {users.blocked > 0 && <p className="text-xs text-mute mt-3">Заблоковано користувачів: {users.blocked}</p>}
      </Panel>
    </div>
  )
}

// Daily active users as bars, new registrations as a marker count under each day.
function ActivityChart({ days }: { days: { day: string; opens: number; users: number; newUsers: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.users))
  const total = days.reduce((n, d) => n + d.opens, 0)
  return (
    <div>
      <div className="flex items-end gap-1 h-32" role="img" aria-label="Активні користувачі по днях">
        {days.map((d) => (
          <div key={d.day} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${d.day}: ${d.users} користувачів, ${d.opens} відкриттів, ${d.newUsers} нових`}>
            {d.users > 0 && <span className="text-[10px] text-mute tabular-nums">{d.users}</span>}
            <div className="w-full rounded-t-md bg-adm" style={{ height: `${(d.users / max) * 100}%`, minHeight: d.users ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1 border-t border-adm-line pt-1">
        {days.map((d, i) => (
          <div key={d.day} className="flex-1 text-center text-[9px] text-mute tabular-nums">
            {i % 2 === 0 ? d.day.slice(8) : ''}
            {d.newUsers > 0 && <div className="text-up font-bold">+{d.newUsers}</div>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-mute mt-2">
        Стовпці — унікальні користувачі за день; <span className="text-up">+N</span> — нові реєстрації. Відкриттів за період: {total}.
      </p>
    </div>
  )
}
