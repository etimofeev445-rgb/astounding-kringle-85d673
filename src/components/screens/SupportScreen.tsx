import { Loader2, Send, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppConfig } from '../../lib/appState'
import { useI18n } from '../../lib/i18n'
import { haptic, initData, notify, openLink, showAlert } from '../../lib/telegram'
import { askForHuman, getSupportChat, sendSupportMessage, type SupportChat, type SupportSendResult } from '../../server/support'
import { ScreenTitle, inputCls } from '../ui'

// "Підтримка": chat with the AI consultant; complex questions are handed to the admin, whose replies
// show up here (polled) and arrive in the bot chat.
export default function SupportScreen() {
  const { t } = useI18n()
  const { contacts } = useAppConfig()
  const [chat, setChat] = useState<SupportChat | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const load = () =>
    getSupportChat({ data: { initData: initData() } })
      .then((c) => {
        setChat(c)
        setFailed(false)
      })
      .catch(() => setFailed(true))

  useEffect(() => {
    load()
  }, [])
  // While the admin handles the ticket, check for their reply every 15 seconds.
  useEffect(() => {
    if (chat?.status !== 'escalated') return
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [chat?.status])
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [chat?.messages.length, busy])

  const handle = (r: SupportSendResult) => {
    if (r.ok) {
      setChat(r.chat)
      return true
    }
    notify('error')
    showAlert(
      t(
        r.reason === 'blocked'
          ? { uk: 'Ваш акаунт обмежено модератором.', ru: 'Ваш аккаунт ограничен модератором.' }
          : r.reason === 'rate'
            ? { uk: 'Забагато повідомлень. Спробуйте трохи пізніше.', ru: 'Слишком много сообщений. Попробуйте чуть позже.' }
            : r.reason === 'unauthorized'
              ? { uk: 'Відкрийте застосунок у Telegram.', ru: 'Откройте приложение в Telegram.' }
              : { uk: 'Не вдалося надіслати. Спробуйте ще раз.', ru: 'Не удалось отправить. Попробуйте ещё раз.' },
      ),
    )
    return false
  }

  const send = async () => {
    const msg = text.trim()
    if (!msg || busy) return
    haptic()
    setBusy(true)
    // Show the message right away; the server answer replaces the list.
    setChat((c) => c && { ...c, messages: [...c.messages, { id: 'pending', role: 'user', text: msg, createdAt: new Date().toISOString() }] })
    setText('')
    try {
      if (!handle(await sendSupportMessage({ data: { initData: initData(), text: msg } }))) {
        setText(msg)
        load()
      }
    } catch {
      handle({ ok: false, reason: 'server' })
      setText(msg)
      load()
    } finally {
      setBusy(false)
    }
  }

  const human = async () => {
    haptic('medium')
    setBusy(true)
    try {
      if (handle(await askForHuman({ data: { initData: initData() } }))) notify('success')
    } catch {
      handle({ ok: false, reason: 'server' })
    } finally {
      setBusy(false)
    }
  }

  const label = (role: string) =>
    role === 'ai'
      ? t({ uk: 'AI-консультант', ru: 'AI-консультант' })
      : role === 'admin'
        ? t({ uk: 'Адміністратор', ru: 'Администратор' })
        : ''

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Підтримка', ru: 'Поддержка' })}
        subtitle={
          chat && !chat.aiOn
            ? t({ uk: 'Напишіть питання — відповість адміністратор', ru: 'Напишите вопрос — ответит администратор' })
            : t({ uk: 'AI-консультант відповість одразу, складні питання — адміністратору', ru: 'AI-консультант ответит сразу, сложные вопросы — администратору' })
        }
      />

      {failed && !chat ? (
        <div className="rounded-3xl bg-panel/90 border border-line p-5 text-center text-sm text-mute">
          {t({ uk: 'Не вдалося завантажити чат.', ru: 'Не удалось загрузить чат.' })}{' '}
          <button onClick={load} className="tap font-semibold text-sky">
            {t({ uk: 'Повторити', ru: 'Повторить' })}
          </button>
        </div>
      ) : !chat ? (
        <div className="flex justify-center py-10 text-mute">
          <Loader2 className="animate-spin" />
        </div>
      ) : !chat.authorized ? (
        <div className="rounded-3xl bg-panel/90 border border-line p-5 text-sm text-mute space-y-3">
          <p>{t({ uk: 'Чат підтримки працює всередині Telegram. Або напишіть нам напряму:', ru: 'Чат поддержки работает внутри Telegram. Или напишите нам напрямую:' })}</p>
          <button onClick={() => openLink(contacts.supportUrl)} className="tap font-semibold text-sky">
            {contacts.supportHandle}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2.5 mb-4">
            {chat.messages.length === 0 && (
              <div className="rounded-3xl bg-panel/90 border border-line p-4 text-sm text-mute">
                {t({
                  uk: 'Вітаємо! Опишіть, з чим потрібна допомога: публікація оголошення чи бізнесу, поповнення, розділи застосунку…',
                  ru: 'Здравствуйте! Опишите, с чем нужна помощь: публикация объявления или бизнеса, пополнение, разделы приложения…',
                })}
              </div>
            )}
            {chat.messages.map((m) =>
              m.role === 'system' ? (
                <div key={m.id} className="text-center text-[12px] text-mute px-6">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-line ${
                      m.role === 'user' ? 'bg-sky text-ink rounded-br-md' : m.role === 'admin' ? 'bg-sun/15 border border-sun/30 rounded-bl-md' : 'bg-panel border border-line rounded-bl-md'
                    }`}
                  >
                    {label(m.role) && <div className="text-[11px] font-bold text-mute mb-0.5">{label(m.role)}</div>}
                    {m.text}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-panel border border-line px-3.5 py-2.5 text-mute">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              </div>
            )}
            <div ref={end} />
          </div>

          {chat.status === 'open' && chat.messages.some((m) => m.role === 'ai') && (
            <button onClick={human} disabled={busy} className="tap mb-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel/90 py-2.5 text-sm font-semibold text-mute disabled:opacity-50">
              <UserRound size={16} /> {t({ uk: 'Покликати адміністратора', ru: 'Позвать администратора' })}
            </button>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t({ uk: 'Ваше питання…', ru: 'Ваш вопрос…' })}
              className={`${inputCls} resize-none`}
            />
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              aria-label={t({ uk: 'Надіслати', ru: 'Отправить' })}
              className="tap h-12 w-12 shrink-0 rounded-2xl bg-sun text-ink grid place-items-center disabled:opacity-40"
            >
              <Send size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
