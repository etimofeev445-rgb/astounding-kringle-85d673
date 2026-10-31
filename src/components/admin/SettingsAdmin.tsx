import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import type { AppConfig } from '../../lib/appConfig'
import type { ConfigCtx } from './AdminApp'
import { adminCall, useAdminQuery } from './api'
import { useDraft } from './ConfigEditors'
import { ImageUpload } from './ImageUpload'
import { Btn, ErrorBox, Field, Loading, Panel, Switch, Title, aInput, dt, useAction } from './ui'

type Env = Record<'botToken' | 'webhookSecret' | 'providerToken' | 'adminChat' | 'aggregator' | 'miniAppUrl', boolean>

const FEATURES: { key: keyof AppConfig['features']; label: string; hint: string }[] = [
  { key: 'adsPosting', label: 'Подання оголошень', hint: 'Нові оголошення від користувачів' },
  { key: 'catalogPosting', label: 'Додавання бізнес-карток', hint: 'Нові картки в каталозі «Карта»' },
  { key: 'cart', label: 'Кошик', hint: 'Кнопки «додати в кошик» на картках' },
  { key: 'reports', label: 'Скарги', hint: 'Кнопка «Поскаржитися» на оголошеннях і картках' },
]

export default function SettingsAdmin({ env, ...ctx }: ConfigCtx & { env: Env }) {
  const { draft, setDraft, bar } = useDraft(ctx, 'settings')
  const set = <K extends keyof AppConfig>(k: K, v: Partial<AppConfig[K]>) =>
    setDraft({ ...draft, [k]: typeof v === 'object' ? { ...(draft[k] as object), ...v } : v })

  return (
    <div className="space-y-5">
      <Panel className="space-y-3">
        <Title>Бренд</Title>
        <Field label="Назва застосунку" hint="Друге слово виділяється жовтим, як «UAT Market»">
          <input value={draft.appName} maxLength={40} onChange={(e) => setDraft({ ...draft, appName: e.target.value })} className={aInput} />
        </Field>
        <Field label="Логотип" hint="Замість текстової назви на головній. PNG з прозорим фоном виглядає найкраще.">
          <ImageUpload value={draft.logoUrl} onChange={(logoUrl) => setDraft({ ...draft, logoUrl })} />
        </Field>
      </Panel>

      <Panel className="space-y-3">
        <Title>Контакти підтримки</Title>
        <Field label="Telegram підтримки">
          <input value={draft.contacts.supportHandle} onChange={(e) => set('contacts', { supportHandle: e.target.value })} className={aInput} />
        </Field>
        <Field label="Посилання підтримки" hint="https://t.me/…">
          <input value={draft.contacts.supportUrl} onChange={(e) => set('contacts', { supportUrl: e.target.value })} className={aInput} />
        </Field>
        <Field label="Email">
          <input type="email" value={draft.contacts.email} onChange={(e) => set('contacts', { email: e.target.value })} className={aInput} />
        </Field>
        <Field label="Телефон">
          <input type="tel" value={draft.contacts.phone} onChange={(e) => set('contacts', { phone: e.target.value })} className={aInput} />
        </Field>
      </Panel>

      <Panel className="space-y-3">
        <Title>Відображення</Title>
        <Field label="Мова за замовчуванням" hint="Якщо користувач не обрав мову і Telegram її не підказав">
          <select value={draft.display.defaultLang} onChange={(e) => set('display', { defaultLang: e.target.value as 'uk' | 'ru' })} className={aInput}>
            <option value="uk">Українська</option>
            <option value="ru">Русский</option>
          </select>
        </Field>
        <Row label="Привітання з імʼям" checked={draft.display.showGreeting} onChange={(v) => set('display', { showGreeting: v })} />
        <Row label="Перемикач мови" checked={draft.display.showLangSwitch} onChange={(v) => set('display', { showLangSwitch: v })} />
      </Panel>

      <Panel className="space-y-3">
        <Title>Функції</Title>
        {FEATURES.map((f) => (
          <Row key={f.key} label={f.label} hint={f.hint} checked={draft.features[f.key]} onChange={(v) => set('features', { [f.key]: v })} />
        ))}
      </Panel>

      <Webhook env={env} />
      {bar}
    </div>
  )
}

function Row({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-[11px] text-mute">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

const ENV_LABELS: [keyof Env, string][] = [
  ['botToken', 'TELEGRAM_BOT_TOKEN'],
  ['webhookSecret', 'TELEGRAM_WEBHOOK_SECRET'],
  ['adminChat', 'TELEGRAM_ADMIN_CHAT_ID'],
  ['providerToken', 'TELEGRAM_PROVIDER_TOKEN'],
  ['aggregator', 'TOPUP_API_URL / TOPUP_API_KEY'],
  ['miniAppUrl', 'TELEGRAM_MINIAPP_URL'],
]

function Webhook({ env }: { env: Env }) {
  const wh = useAdminQuery('webhook.get')
  const { busy, run } = useAction()
  const info = wh.data?.configured ? wh.data.info : null
  const expected = wh.data?.configured ? wh.data.expected : ''
  const ok = !!info && !!expected && info.url === expected

  return (
    <Panel className="space-y-3">
      <Title action={<Btn small onClick={wh.reload}><RefreshCw size={13} /></Btn>}>Telegram webhook</Title>
      {wh.error ? (
        <ErrorBox message={wh.error} retry={wh.reload} />
      ) : wh.loading && !wh.data ? (
        <Loading />
      ) : !wh.data?.configured ? (
        <p className="text-sm text-mute">Бот не налаштований (немає TELEGRAM_BOT_TOKEN).</p>
      ) : (
        <>
          <div className={`flex items-start gap-2 text-sm ${ok ? 'text-up' : 'text-sun'}`}>
            {ok ? <CheckCircle2 size={16} className="mt-0.5" /> : <XCircle size={16} className="mt-0.5" />}
            <span className="break-all">{info?.url || 'Webhook не встановлено'}</span>
          </div>
          {info && (
            <div className="text-[11px] text-mute">
              Черга оновлень: {info.pendingUpdateCount}
              {info.lastErrorMessage && (
                <span className="block text-down">
                  Остання помилка ({dt(info.lastErrorDate)}): {info.lastErrorMessage}
                </span>
              )}
            </div>
          )}
          {!ok && expected && (
            <Btn
              tone="primary"
              busy={busy === 'setup'}
              onClick={() =>
                run('setup', async () => {
                  await adminCall('webhook.setup')
                  wh.reload()
                }, { confirm: `Встановити webhook на ${expected}? Секрет передається тільки в заголовку.`, done: 'Webhook встановлено' })
              }
            >
              Встановити webhook
            </Btn>
          )}
        </>
      )}
      <div className="pt-2 border-t border-adm-line">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-mute mb-1.5">Змінні середовища</div>
        <ul className="space-y-1 text-xs">
          {ENV_LABELS.map(([k, label]) => (
            <li key={k} className="flex items-center gap-2">
              {env[k] ? <CheckCircle2 size={13} className="text-up" /> : <XCircle size={13} className="text-mute" />}
              <span className={env[k] ? '' : 'text-mute'}>{label}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-mute mt-2">Значення секретів не показуються. Змінити їх можна в налаштуваннях проєкту Netlify.</p>
      </div>
    </Panel>
  )
}
