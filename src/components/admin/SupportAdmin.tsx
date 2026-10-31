import { ChevronLeft, RefreshCw, Send } from 'lucide-react'
import { useState } from 'react'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Chips, Empty, ErrorBox, Loading, Panel, Title, aInput, dt, useAction } from './ui'

// "Підтримка": tickets from the Mini App chat. Escalated ones wait for the admin's reply, which is
// shown in the app and sent to the user by the bot.
export default function SupportAdmin() {
  const [status, setStatus] = useState('escalated')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useAdminQuery('support.list', { status })

  if (openId) return <TicketView id={openId} onBack={() => { setOpenId(null); list.reload() }} />

  return (
    <section>
      <Title action={<Btn small onClick={list.reload}><RefreshCw size={12} /></Btn>}>Звернення в підтримку</Title>
      <Chips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'escalated', label: 'Чекають відповіді' },
          { value: 'open', label: 'У AI-консультанта' },
          { value: '', label: 'Усі відкриті' },
          { value: 'closed', label: 'Закриті' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Звернень немає</Empty>
      ) : (
        <div className="space-y-2">
          {list.data.items.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="tap block w-full text-left">
              <Panel className="space-y-1">
                <div className="flex items-center gap-2">
                  {t.unread && <span className="h-2 w-2 rounded-full bg-down" />}
                  <span className="text-sm font-semibold flex-1 truncate">{t.user}</span>
                  <Badge status={t.status} />
                </div>
                {t.reason && <div className="text-[11px] text-sun">{t.reason}</div>}
                <div className="text-xs text-mute line-clamp-2">{t.lastText}</div>
                <div className="text-[10px] text-mute">
                  {dt(t.updatedAt)} · відповідей AI: {t.aiReplies}
                </div>
              </Panel>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

const ROLE: Record<string, string> = { user: 'Користувач', ai: 'AI-консультант', admin: 'Ви', system: '' }

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useAdminQuery('support.get', { id })
  const [text, setText] = useState('')
  const { busy, run } = useAction()

  const reply = () =>
    run('reply', async () => {
      const r = await adminCall('support.reply', { id, text })
      setText('')
      t.reload()
      if (!r.delivered) throw new Error('Відповідь збережено й видно в застосунку, але бот не зміг написати користувачу (не запускав бота або заблокував його).')
    })

  return (
    <section className="space-y-3">
      <Btn small onClick={onBack}>
        <ChevronLeft size={14} /> До списку
      </Btn>
      {t.error ? (
        <ErrorBox message={t.error} retry={t.reload} />
      ) : !t.data ? (
        <Loading />
      ) : (
        <>
          <Panel className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{t.data.user}</div>
              <div className="text-[11px] text-mute">Telegram ID {t.data.userId}{t.data.reason && ` · ${t.data.reason}`}</div>
            </div>
            <Badge status={t.data.status} />
          </Panel>
          <div className="space-y-2">
            {t.data.messages.map((m) =>
              m.role === 'system' ? (
                <div key={m.id} className="text-center text-[11px] text-mute px-4">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${
                      m.role === 'user' ? 'bg-adm-panel border border-adm-line' : m.role === 'admin' ? 'bg-adm text-adm-ink' : 'bg-adm-ink border border-adm-line'
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-70 mb-0.5">
                      {ROLE[m.role]} · {dt(m.createdAt)}
                    </div>
                    {m.text}
                  </div>
                </div>
              ),
            )}
          </div>
          {t.data.status !== 'closed' && (
            <Panel className="space-y-2">
              <textarea rows={4} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Відповідь користувачу" className={aInput} />
              <div className="flex gap-2">
                <Btn
                  tone="danger"
                  busy={busy === 'close'}
                  onClick={() =>
                    run('close', async () => {
                      await adminCall('support.close', { id })
                      t.reload()
                    }, { confirm: 'Закрити звернення? Історія збережеться.' })
                  }
                >
                  Закрити
                </Btn>
                <Btn tone="primary" className="flex-1" disabled={!text.trim()} busy={busy === 'reply'} onClick={reply}>
                  <Send size={14} /> Відповісти
                </Btn>
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  )
}
