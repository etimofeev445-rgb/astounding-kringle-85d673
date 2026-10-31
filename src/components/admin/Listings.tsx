import { Check, ExternalLink, Flag, Pencil, Search, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CATEGORIES } from '../../lib/places'
import { openLink } from '../../lib/telegram'
import type { AdminListing, AdminReport } from '../../server/admin/listings'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Chips, Empty, ErrorBox, Field, Loading, Panel, Title, aInput, dt, useAction } from './ui'

type Kind = 'ad' | 'place'
type Filter = 'pending' | 'flagged' | 'reported' | 'approved' | 'rejected' | 'deleted' | 'all'
type Tab = Kind | 'reports'

export default function Listings() {
  const [tab, setTab] = useState<Tab>('ad')
  return (
    <div>
      <Title>Оголошення та картки</Title>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-adm-panel border border-adm-line mb-3">
        {(
          [
            ['ad', 'Оголошення'],
            ['place', 'Бізнес-картки'],
            ['reports', 'Скарги'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`tap rounded-xl py-2 text-xs font-bold ${tab === id ? 'bg-adm text-adm-ink' : 'text-mute'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'reports' ? <Reports /> : <ListingList key={tab} kind={tab} />}
    </div>
  )
}

function ListingList({ kind }: { kind: Kind }) {
  const [filter, setFilter] = useState<Filter>('pending')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const list = useAdminQuery('listings.list', { kind, filter, q: query, offset })

  useEffect(() => {
    const id = setTimeout(() => (setQuery(q), setOffset(0)), 300)
    return () => clearTimeout(id)
  }, [q])

  const replace = (item: AdminListing) =>
    list.setData((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) })

  return (
    <div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за назвою, описом або ID автора" className={`${aInput} pl-10`} />
      </div>
      <Chips
        value={filter}
        onChange={(f) => (setFilter(f), setOffset(0))}
        options={[
          { value: 'pending', label: 'На перевірці' },
          { value: 'flagged', label: '🤖 Автоперевірка' },
          { value: 'reported', label: 'Зі скаргами' },
          { value: 'approved', label: 'Схвалені' },
          { value: 'rejected', label: 'Відхилені' },
          { value: 'deleted', label: 'Видалені' },
          { value: 'all', label: 'Усі' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Тут порожньо</Empty>
      ) : (
        <div className="space-y-3">
          {list.data.items.map((item) => (
            <ListingCard key={item.id} item={item} onChange={replace} />
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

function ListingCard({ item, onChange }: { item: AdminListing; onChange: (i: AdminListing) => void }) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const { busy, run } = useAction()
  const kindLabel = item.kind === 'ad' ? 'оголошення' : 'картку'

  const act = (id: string, fn: () => Promise<AdminListing>, confirm?: string) =>
    run(id, async () => onChange(await fn()), { confirm })

  return (
    <Panel className="!p-0 overflow-hidden">
      <div className="flex gap-3 p-3.5">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover bg-adm-ink" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-xl bg-adm-ink border border-adm-line grid place-items-center text-2xl">
            {item.kind === 'ad' ? '📢' : '🏪'}
          </div>
        )}
        <button onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <Badge status={item.status === 'active' ? item.moderation : item.status} />
            {item.openReports > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-down/15 text-down px-2 py-0.5 text-[11px] font-bold">
                <Flag size={11} /> {item.openReports}
              </span>
            )}
          </div>
          <div className="font-semibold leading-snug">{item.title}</div>
          {item.price && <div className="text-sm text-sun font-semibold truncate">{item.price}</div>}
          <div className="text-[11px] text-mute mt-0.5">
            {item.author} · {dt(item.createdAt)}
          </div>
        </button>
      </div>
      {open && <p className="px-3.5 pb-3 text-sm text-white/85 whitespace-pre-line">{item.description}</p>}

      {editing ? (
        <EditForm item={item} onCancel={() => setEditing(false)} onSaved={(i) => (onChange(i), setEditing(false))} />
      ) : (
        item.status !== 'deleted' && (
          <div className="flex flex-wrap gap-2 border-t border-adm-line p-3">
            {(item.moderation !== 'approved' || item.status === 'rejected') && (
              <Btn
                small
                tone="ok"
                busy={busy === 'approve'}
                onClick={() =>
                  act('approve', () => adminCall('listings.moderate', { kind: item.kind, id: item.id, decision: 'approve' }),
                    item.status === 'rejected' ? `Схвалити й знову опублікувати ${kindLabel} в каналі?` : undefined)
                }
              >
                <Check size={14} /> {item.status === 'rejected' ? 'Відновити' : 'Схвалити'}
              </Btn>
            )}
            {item.status === 'active' && (
              <Btn
                small
                tone="danger"
                busy={busy === 'reject'}
                onClick={() =>
                  act('reject', () => adminCall('listings.moderate', { kind: item.kind, id: item.id, decision: 'reject' }),
                    `Відхилити ${kindLabel}? Пост буде знято з каналу, автор його не побачить у застосунку.`)
                }
              >
                <X size={14} /> Відхилити
              </Btn>
            )}
            <Btn small onClick={() => setEditing(true)}>
              <Pencil size={14} /> Редагувати
            </Btn>
            {item.postUrl && (
              <Btn small onClick={() => openLink(item.postUrl!)}>
                <ExternalLink size={14} /> Пост
              </Btn>
            )}
            <Btn
              small
              tone="danger"
              className="ml-auto"
              busy={busy === 'delete'}
              onClick={() =>
                act('delete', () => adminCall('listings.delete', { kind: item.kind, id: item.id }),
                  `Видалити ${kindLabel} «${item.title}»? Пост буде знято з каналу. Запис залишиться в базі зі статусом «видалено».`)
              }
            >
              <Trash2 size={14} />
            </Btn>
          </div>
        )
      )}
    </Panel>
  )
}

const AD_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'title', label: 'Назва' },
  { key: 'description', label: 'Опис', multiline: true },
  { key: 'price', label: 'Ціна, ₴ (порожньо = договірна)' },
  { key: 'phone', label: 'Телефон' },
  { key: 'tgContact', label: 'Telegram' },
]
const PLACE_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'title', label: 'Назва' },
  { key: 'description', label: 'Опис', multiline: true },
  { key: 'country', label: 'Країна' },
  { key: 'city', label: 'Місто' },
  { key: 'hours', label: 'Графік' },
  { key: 'price', label: 'Прайс / послуги', multiline: true },
  { key: 'phone', label: 'Телефон' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tgContact', label: 'Telegram' },
  { key: 'mapUrl', label: 'Посилання на мапу' },
]

function EditForm({ item, onCancel, onSaved }: { item: AdminListing; onCancel: () => void; onSaved: (i: AdminListing) => void }) {
  const [fields, setFields] = useState(item.fields)
  const { busy, run } = useAction()
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }))
  const defs = item.kind === 'ad' ? AD_FIELDS : PLACE_FIELDS

  return (
    <div className="border-t border-adm-line p-3.5 space-y-3">
      {item.kind === 'place' && (
        <Field label="Категорія">
          <select value={fields.category} onChange={(e) => set('category', e.target.value)} className={aInput}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label.uk}
              </option>
            ))}
          </select>
        </Field>
      )}
      {defs.map((d) => (
        <Field key={d.key} label={d.label}>
          {d.multiline ? (
            <textarea rows={4} value={fields[d.key] ?? ''} onChange={(e) => set(d.key, e.target.value)} className={aInput} />
          ) : (
            <input value={fields[d.key] ?? ''} onChange={(e) => set(d.key, e.target.value)} className={aInput} />
          )}
        </Field>
      ))}
      <p className="text-[11px] text-mute">Зміни одразу застосуються і до поста в Telegram-каналі.</p>
      <div className="flex gap-2">
        <Btn onClick={onCancel} className="flex-1">
          Скасувати
        </Btn>
        <Btn
          tone="primary"
          className="flex-1"
          busy={busy === 'save'}
          onClick={() =>
            run('save', async () => onSaved(await adminCall('listings.update', { kind: item.kind, id: item.id, fields })), {
              confirm: 'Зберегти зміни?',
            })
          }
        >
          Зберегти
        </Btn>
      </div>
    </div>
  )
}

function Reports() {
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open')
  const list = useAdminQuery('reports.list', { status })
  const { busy, run } = useAction()

  const resolve = (r: AdminReport, how: 'dismissed' | 'resolved' | 'reject') =>
    run(
      `${r.id}:${how}`,
      async () => {
        await adminCall('reports.resolve', { id: r.id, status: how === 'reject' ? 'resolved' : how, rejectTarget: how === 'reject' })
        list.reload()
      },
      {
        confirm:
          how === 'reject'
            ? `Відхилити «${r.targetTitle}» і закрити всі скарги на нього? Пост буде знято з каналу.`
            : how === 'dismissed'
              ? 'Відхилити скаргу як безпідставну?'
              : undefined,
      },
    )

  return (
    <div>
      <Chips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Відкриті' },
          { value: 'resolved', label: 'Вирішені' },
          { value: 'dismissed', label: 'Відхилені' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Скарг немає</Empty>
      ) : (
        <div className="space-y-3">
          {list.data.items.map((r) => (
            <Panel key={r.id}>
              <div className="flex items-center gap-1.5 mb-1">
                <Badge status={r.status} />
                <span className="text-[11px] text-mute">
                  {r.kind === 'ad' ? 'Оголошення' : 'Бізнес-картка'} · {dt(r.createdAt)}
                </span>
              </div>
              <div className="font-semibold">
                {r.targetTitle} <Badge status={r.targetStatus} />
              </div>
              <div className="text-sm text-white/85 mt-1">
                <Flag size={13} className="inline text-down mr-1" />
                {r.reason}
              </div>
              <div className="text-[11px] text-mute mt-1">Від: {r.reporter}</div>
              {r.status === 'open' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {r.targetStatus === 'active' && (
                    <Btn small tone="danger" busy={busy === `${r.id}:reject`} onClick={() => resolve(r, 'reject')}>
                      <X size={14} /> Зняти з публікації
                    </Btn>
                  )}
                  <Btn small tone="ok" busy={busy === `${r.id}:resolved`} onClick={() => resolve(r, 'resolved')}>
                    <Check size={14} /> Вирішено
                  </Btn>
                  <Btn small busy={busy === `${r.id}:dismissed`} onClick={() => resolve(r, 'dismissed')}>
                    Безпідставна
                  </Btn>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
