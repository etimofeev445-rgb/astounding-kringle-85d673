import { useState } from 'react'
import { useAdminQuery } from './api'
import { Btn, Chips, Empty, ErrorBox, Loading, Title } from './ui'

type Group = 'all' | 'login' | 'users' | 'listings' | 'settings' | 'broadcasts' | 'orders'

const ACTIONS: Record<string, string> = {
  'admin.login': 'Вхід в адмін-панель',
  'user.block': 'Блокування користувача',
  'user.unblock': 'Розблокування користувача',
  'ad.approve': 'Схвалено оголошення',
  'ad.reject': 'Відхилено оголошення',
  'ad.edit': 'Відредаговано оголошення',
  'ad.delete': 'Видалено оголошення',
  'place.approve': 'Схвалено бізнес-картку',
  'place.reject': 'Відхилено бізнес-картку',
  'place.edit': 'Відредаговано бізнес-картку',
  'place.delete': 'Видалено бізнес-картку',
  'report.resolved': 'Скаргу вирішено',
  'report.dismissed': 'Скаргу відхилено',
  'report.reject_target': 'Скаргу вирішено, обʼєкт знято',
  'settings.update': 'Змінено налаштування',
  'asset.upload': 'Завантажено зображення',
  'document.create': 'Додано документ',
  'document.edit': 'Змінено документ',
  'document.delete': 'Видалено документ',
  'broadcast.test': 'Тестова розсилка',
  'broadcast.create': 'Запущено розсилку',
  'broadcast.done': 'Розсилку завершено',
  'broadcast.stop': 'Розсилку зупинено',
  'order.manual_fulfilled': 'Поповнення підтверджено вручну',
  'webhook.setup': 'Встановлено webhook',
}

const summary = (d: Record<string, unknown>) =>
  Object.entries(d)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')

export default function AuditLog() {
  const [group, setGroup] = useState<Group>('all')
  const [offset, setOffset] = useState(0)
  const list = useAdminQuery('log.list', { group, offset })

  return (
    <div>
      <Title>Журнал дій</Title>
      <Chips
        value={group}
        onChange={(g) => (setGroup(g), setOffset(0))}
        options={[
          { value: 'all', label: 'Усе' },
          { value: 'login', label: 'Входи' },
          { value: 'users', label: 'Користувачі' },
          { value: 'listings', label: 'Оголошення' },
          { value: 'settings', label: 'Налаштування' },
          { value: 'broadcasts', label: 'Розсилки' },
          { value: 'orders', label: 'Поповнення' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Записів немає</Empty>
      ) : (
        <ol className="rounded-2xl border border-adm-line bg-adm-panel divide-y divide-adm-line overflow-hidden">
          {list.data.items.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{ACTIONS[e.action] ?? e.action}</span>
                <time className="text-[11px] text-mute tabular-nums shrink-0" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleString('uk-UA')}
                </time>
              </div>
              <div className="text-[11px] text-mute break-all mt-0.5">
                {e.targetKind && `${e.targetKind}${e.targetId ? ` ${e.targetId}` : ''} · `}адмін {e.adminId}
                {Object.keys(e.details).length > 0 && <span className="block">{summary(e.details)}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {list.data && (offset > 0 || list.data.items.length === list.data.pageSize) && (
        <div className="flex justify-between mt-3">
          <Btn small disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - list.data!.pageSize))}>
            ← Новіші
          </Btn>
          <Btn small disabled={list.data.items.length < list.data.pageSize} onClick={() => setOffset(offset + list.data!.pageSize)}>
            Старіші →
          </Btn>
        </div>
      )}
    </div>
  )
}
