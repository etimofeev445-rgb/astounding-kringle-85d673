import { CalendarClock, Eye, Send, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BROADCAST_AUDIENCES, type BroadcastAudience } from '../../lib/automation'
import { confirmAction, notify, showAlert } from '../../lib/telegram'
import type { AdminResult } from '../../server/admin/actions'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Empty, ErrorBox, Field, Loading, Panel, Title, aInput, dt, useAction } from './ui'

type Broadcast = AdminResult<'broadcasts.list'>['items'][number]
type Preview = AdminResult<'broadcasts.preview'>

const audienceLabel = (a: string) => BROADCAST_AUDIENCES.find((x) => x.value === a)?.label ?? a

export default function Notifications() {
  const list = useAdminQuery('broadcasts.list')
  const [text, setText] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [when, setWhen] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [active, setActive] = useState<Broadcast | null>(null)
  const { busy, run } = useAction()
  const stop = useRef(false)
  const msg = { text, buttonText, buttonUrl, audience }
  // Any edit invalidates the reviewed preview: the admin must review again before confirming.
  useEffect(() => setPreview(null), [text, buttonText, buttonUrl, audience, when])

  // Pulls batches until the mailing is done (or stopped); honours Telegram's flood-wait.
  const pump = async (b: Broadcast) => {
    stop.current = false
    setActive(b)
    let cur = b
    try {
      while (cur.status === 'sending' && !stop.current) {
        const r = await adminCall('broadcasts.send', { id: cur.id })
        cur = r.broadcast
        setActive(cur)
        if (r.retryAfter) await new Promise((ok) => setTimeout(ok, r.retryAfter * 1000))
      }
      if (cur.status === 'done') notify('success')
    } catch (e) {
      notify('error')
      showAlert(`Розсилку призупинено: ${e instanceof Error ? e.message : e}. Її можна продовжити зі списку нижче.`)
    } finally {
      setActive(null)
      list.reload()
    }
  }

  useEffect(() => () => void (stop.current = true), [])

  const review = () => run('preview', async () => setPreview(await adminCall('broadcasts.preview', msg)))

  // Second, explicit confirmation; the server re-checks that the recipient count is still the one shown.
  const start = async () => {
    if (!preview) return
    const at = when ? new Date(when) : null
    const ok = await confirmAction(
      at
        ? `Запланувати розсилку на ${at.toLocaleString('uk-UA')} для ${preview.recipients} користувачів (${audienceLabel(preview.audience)})?`
        : `Надіслати повідомлення ${preview.recipients} користувачам (${audienceLabel(preview.audience)}) зараз? Скасувати вже надіслані повідомлення буде неможливо.`,
    )
    if (!ok) return
    const b = await run('create', () =>
      adminCall('broadcasts.create', { ...msg, confirm: true, recipients: preview.recipients, scheduledAt: at ? at.toISOString() : null }),
    )
    if (b) {
      setText('')
      setButtonText('')
      setButtonUrl('')
      setWhen('')
      setPreview(null)
      if (b.status === 'sending') pump(b)
      else {
        showAlert('Розсилку заплановано. Її надішле модуль «Керування розсилками» (Автоматизація) — переконайтеся, що він увімкнений.')
        list.reload()
      }
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="space-y-3">
        <Title>Нова розсилка</Title>
        <p className="text-xs text-mute">
          Надсилається від імені бота незаблокованим користувачам вибраної аудиторії (усього користувачів: {list.data?.audience ?? '…'}).
          Повідомлення отримають лише ті, хто хоч раз запускав бота; решта рахується як «не доставлено». Порядок: перегляд → підтвердження.
        </p>
        <Field label="Текст">
          <textarea rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={aInput} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Кнопка (необовʼязково)">
            <input value={buttonText} maxLength={40} onChange={(e) => setButtonText(e.target.value)} placeholder="Відкрити" className={aInput} />
          </Field>
          <Field label="Посилання кнопки">
            <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://" className={aInput} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Аудиторія">
            <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)} className={aInput}>
              {BROADCAST_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Час (порожньо — одразу)">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={aInput} />
          </Field>
        </div>

        {text.trim() && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-mute mb-1.5">Попередній перегляд</div>
            <div className="rounded-2xl bg-[#17212b] p-3 max-w-[85%]">
              <div className="rounded-xl rounded-bl-sm bg-[#182533] border border-white/5 px-3 py-2 text-sm whitespace-pre-line">{text.trim()}</div>
              {buttonText && buttonUrl && (
                <div className="mt-1 rounded-lg bg-white/10 py-1.5 text-center text-xs font-semibold">{buttonText} ↗</div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Btn
            className="flex-1"
            disabled={!text.trim()}
            busy={busy === 'test'}
            onClick={() => run('test', () => adminCall('broadcasts.test', msg), { done: 'Тестове повідомлення надіслано вам у Telegram' })}
          >
            Тест собі
          </Btn>
          <Btn className="flex-[2]" disabled={!text.trim() || !!active} busy={busy === 'preview'} onClick={review}>
            <Eye size={15} /> Переглянути
          </Btn>
        </div>

        {preview && (
          <div className="rounded-xl border border-adm/40 bg-adm/10 p-3 space-y-2">
            <div className="text-sm">
              Одержувачів зараз: <b className="tabular-nums">{preview.recipients}</b> · {audienceLabel(preview.audience)}
              {when && <> · {new Date(when).toLocaleString('uk-UA')}</>}
            </div>
            <Btn tone="primary" className="w-full" disabled={!preview.recipients || !!active} busy={busy === 'create'} onClick={start}>
              {when ? <CalendarClock size={15} /> : <Send size={15} />} {when ? 'Підтвердити й запланувати' : `Підтвердити й надіслати (${preview.recipients})`}
            </Btn>
          </div>
        )}
      </Panel>

      {active && (
        <Panel className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Надсилання…</span>
            <Btn small tone="danger" onClick={() => (stop.current = true)}>
              <Square size={12} /> Пауза
            </Btn>
          </div>
          <Progress b={active} />
        </Panel>
      )}

      <section>
        <Title>Історія розсилок</Title>
        {list.error ? (
          <ErrorBox message={list.error} retry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : list.data.items.length === 0 ? (
          <Empty>Розсилок ще не було</Empty>
        ) : (
          <div className="space-y-2">
            {list.data.items.map((b) => (
              <Panel key={b.id}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge status={b.status} />
                  <span className="text-[11px] text-mute">{dt(b.createdAt)}</span>
                  <span className="text-[11px] text-mute">· {audienceLabel(b.audience)}</span>
                  {b.scheduledAt && b.status === 'scheduled' && <span className="text-[11px] text-sun">· на {dt(b.scheduledAt)}</span>}
                </div>
                <p className="text-sm whitespace-pre-line line-clamp-3">{b.text}</p>
                <Progress b={b} />
                {b.status === 'scheduled' && (
                  <div className="flex gap-2 mt-2">
                    <Btn
                      small
                      tone="danger"
                      onClick={() =>
                        run('stop', async () => {
                          await adminCall('broadcasts.stop', { id: b.id })
                          list.reload()
                        }, { confirm: 'Скасувати заплановану розсилку?' })
                      }
                    >
                      Скасувати
                    </Btn>
                  </div>
                )}
                {b.status === 'sending' && !active && (
                  <div className="flex gap-2 mt-2">
                    <Btn small tone="primary" onClick={() => pump(b)}>
                      Продовжити
                    </Btn>
                    <Btn
                      small
                      tone="danger"
                      onClick={() =>
                        run('stop', async () => {
                          await adminCall('broadcasts.stop', { id: b.id })
                          list.reload()
                        }, { confirm: 'Завершити розсилку? Решта користувачів її не отримає.' })
                      }
                    >
                      Завершити
                    </Btn>
                  </div>
                )}
              </Panel>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Progress({ b }: { b: Broadcast }) {
  const done = b.sent + b.failed
  const pct = b.total ? Math.min(100, Math.round((done / b.total) * 100)) : 100
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-adm-ink overflow-hidden">
        <div className="h-full bg-adm" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] text-mute mt-1 tabular-nums">
        Доставлено {b.sent} · не доставлено {b.failed} · усього {b.total}
      </div>
    </div>
  )
}
