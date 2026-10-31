import { Ban, ChevronLeft, ChevronRight, Search, ShieldCheck, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { openLink } from '../../lib/telegram'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Chips, Empty, ErrorBox, Loading, Panel, Title, aInput, dt, useAction } from './ui'

type Filter = 'all' | 'new' | 'blocked'

export default function Users() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string>()
  const list = useAdminQuery('users.list', { q: query, filter, offset })

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q)
      setOffset(0)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  if (selected) return <Profile id={selected} onBack={() => (setSelected(undefined), list.reload())} />

  return (
    <div>
      <Title>Користувачі {list.data && <span className="text-mute text-sm font-sans">· {list.data.total}</span>}</Title>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Імʼя, @username або Telegram ID" className={`${aInput} pl-10`} />
      </div>
      <Chips
        value={filter}
        onChange={(f) => (setFilter(f), setOffset(0))}
        options={[
          { value: 'all', label: 'Усі' },
          { value: 'new', label: 'Нові (7 днів)' },
          { value: 'blocked', label: 'Заблоковані' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.users.length === 0 ? (
        <Empty>Нікого не знайдено</Empty>
      ) : (
        <div className="rounded-2xl border border-adm-line bg-adm-panel divide-y divide-adm-line overflow-hidden">
          {list.data.users.map((u) => (
            <button key={u.id} onClick={() => setSelected(u.id)} className="tap w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-adm-ink border border-adm-line grid place-items-center font-bold text-sm">
                {(u.name || u.username || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {u.name || (u.username ? `@${u.username}` : `ID ${u.id}`)}
                  {u.isAdmin && <ShieldCheck size={14} className="text-adm" />}
                  {u.blocked && <Badge status="blocked" />}
                </div>
                <div className="text-[11px] text-mute truncate">
                  {u.username ? `@${u.username} · ` : ''}ID {u.id} · був {dt(u.lastSeenAt)}
                </div>
              </div>
              <div className="text-right text-[11px] text-mute shrink-0">
                <div>{u.ads} огол.</div>
                <div>{u.places} карт.</div>
              </div>
              <ChevronRight size={16} className="text-mute shrink-0" />
            </button>
          ))}
        </div>
      )}
      {list.data && list.data.total > list.data.pageSize && (
        <div className="flex justify-between mt-3">
          <Btn small disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - list.data!.pageSize))}>
            ← Назад
          </Btn>
          <span className="text-xs text-mute self-center">
            {offset + 1}–{Math.min(offset + list.data.pageSize, list.data.total)} з {list.data.total}
          </span>
          <Btn small disabled={offset + list.data.pageSize >= list.data.total} onClick={() => setOffset(offset + list.data!.pageSize)}>
            Далі →
          </Btn>
        </div>
      )}
    </div>
  )
}

function Profile({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, reload } = useAdminQuery('users.get', { id })
  const { busy, run } = useAction()
  const [reason, setReason] = useState('')

  if (error) return <ErrorBox message={error} retry={reload} />
  if (!data) return <Loading />
  const { user } = data

  const toggleBlock = () =>
    run(
      'block',
      async () => {
        await adminCall('users.block', { id, blocked: !user.blocked, reason })
        reload()
      },
      {
        confirm: user.blocked
          ? 'Розблокувати користувача?'
          : 'Заблокувати користувача? Він не зможе публікувати оголошення, картки та скарги.',
      },
    )

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="tap flex items-center gap-1 text-sm font-semibold text-mute">
        <ChevronLeft size={18} /> Усі користувачі
      </button>
      <Panel>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg font-bold leading-tight flex items-center gap-2">
              {user.name || (user.username ? `@${user.username}` : `ID ${user.id}`)}
              {user.isAdmin && <ShieldCheck size={16} className="text-adm" />}
            </div>
            <div className="text-xs text-mute mt-1">
              {user.username && (
                <button onClick={() => openLink(`https://t.me/${user.username}`)} className="text-adm font-semibold mr-2">
                  @{user.username}
                </button>
              )}
              Telegram ID {user.id}
            </div>
          </div>
          {user.blocked && <Badge status="blocked" />}
        </div>
        <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <Info label="Перший вхід" value={dt(user.firstSeenAt)} />
          <Info label="Останній вхід" value={dt(user.lastSeenAt)} />
          <Info label="Сесій усього" value={user.sessions} />
          <Info label="Активних днів (30)" value={data.activity.activeDays30d} />
          <Info label="Оголошень" value={user.ads} />
          <Info label="Бізнес-карток" value={user.places} />
          <Info label="Мова" value={user.languageCode || '—'} />
          <Info label="Поповнень" value={data.orders.length} />
        </dl>
        {user.blocked && user.blockedReason && <p className="text-xs text-down mt-3">Причина: {user.blockedReason}</p>}
        {!user.isAdmin && (
          <div className="mt-4 space-y-2">
            {!user.blocked && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина блокування (необовʼязково)" className={aInput} />}
            <Btn tone={user.blocked ? 'ok' : 'danger'} onClick={toggleBlock} busy={busy === 'block'} className="w-full">
              {user.blocked ? <Unlock size={15} /> : <Ban size={15} />}
              {user.blocked ? 'Розблокувати' : 'Заблокувати'}
            </Btn>
          </div>
        )}
      </Panel>

      <Panel>
        <Title>Історія дій</Title>
        {data.history.length === 0 ? (
          <Empty>Дій ще немає</Empty>
        ) : (
          <ol className="space-y-2.5">
            {data.history.map((h, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-[11px] text-mute tabular-nums w-24 shrink-0 pt-0.5">{dt(h.at)}</span>
                <span className={h.kind === 'admin' ? 'text-adm' : 'text-white/85'}>{h.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-mute">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
