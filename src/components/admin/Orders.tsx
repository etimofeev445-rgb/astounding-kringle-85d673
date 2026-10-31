import { Check } from 'lucide-react'
import { useState } from 'react'
import { prompt } from './prompt'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Chips, Empty, ErrorBox, Loading, Panel, Title, dt, useAction } from './ui'

type Filter = 'attention' | 'fulfilled' | 'pending' | 'all'

// Read-only order history plus one manual step: confirming an order that was topped up by hand.
export default function Orders() {
  const [status, setStatus] = useState<Filter>('attention')
  const list = useAdminQuery('orders.list', { status })
  const { busy, run } = useAction()

  return (
    <div>
      <Title>Поповнення мобільного</Title>
      <p className="text-xs text-mute -mt-2 mb-3">
        «Потребують уваги» — оплачені замовлення, які не зараховано автоматично (ручний режим, помилка або перервана обробка).
      </p>
      <Chips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'attention', label: 'Потребують уваги' },
          { value: 'fulfilled', label: 'Виконані' },
          { value: 'pending', label: 'Не оплачені' },
          { value: 'all', label: 'Усі' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Замовлень немає</Empty>
      ) : (
        <div className="space-y-2">
          {list.data.items.map((o) => (
            <Panel key={o.id}>
              <div className="flex items-center gap-2">
                <Badge status={o.status} />
                <span className="text-[11px] text-mute">{dt(o.createdAt)}</span>
                <span className="ml-auto font-display font-bold text-sun tabular-nums">{o.amount} ₴</span>
              </div>
              <div className="font-semibold mt-1">
                {o.operator} {o.phone}
              </div>
              <div className="text-[11px] text-mute break-all">
                Замовлення {o.id} · користувач {o.userId}
                {o.providerChargeId && <> · платіж {o.providerChargeId}</>}
                {o.aggregatorRef && <> · {o.aggregatorRef}</>}
              </div>
              {o.error && <div className="text-xs text-down mt-1">{o.error}</div>}
              {['paid', 'processing', 'failed'].includes(o.status) && (
                <Btn
                  small
                  tone="ok"
                  className="mt-2"
                  busy={busy === o.id}
                  onClick={async () => {
                    const note = await prompt('Коментар (наприклад, номер операції у оператора), необовʼязково')
                    if (note === null) return
                    run(o.id, async () => {
                      await adminCall('orders.fulfill', { id: o.id, note })
                      list.reload()
                    }, {
                      confirm: `Підтвердити, що ${o.phone} поповнено на ${o.amount} ₴ вручну? Клієнт отримає повідомлення від бота.`,
                    })
                  }}
                >
                  <Check size={14} /> Поповнено вручну
                </Btn>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
