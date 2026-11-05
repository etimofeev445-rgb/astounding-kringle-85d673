import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  LINKABLE_SCREENS, MAX_CUSTOM_MENU_ITEMS, finalizeMenuItem, isBuiltinMenuId, menuItemError, menuItemView, normalizeMenuItem,
  type MenuAction, type MenuItem,
} from '../../lib/appConfig'
import { SCREENS, type Screen } from '../../lib/nav'
import { Btn, Field, OrderButtons, Panel, Switch, Title, aInput, move } from './ui'

const ACTION_LABEL: Record<MenuAction, string> = {
  screen: 'Внутрішня сторінка',
  link: 'Зовнішнє посилання',
  bot: 'Telegram-бот',
  info: 'Інформаційний блок',
}

const EXTRA_SCREENS: Partial<Record<Screen, string>> = {
  topup: '📱 Поповнити мобільний',
  telegram: '✈️ Telegram: групи та канали',
  support: '🛟 Підтримка',
  cart: '🛒 Кошик',
}
const screenLabel = (id: Screen) => {
  const s = SCREENS.find((x) => x.id === id)
  return s ? `${s.emoji} ${s.title.uk}` : (EXTRA_SCREENS[id] ?? id)
}

const QUICK_EMOJI = ['🔗', '🛒', '🎁', '📣', '⭐', '🔥', '📞', '💬', '🤖', '📍', '🧾', '🚚']

const newId = () => `m${Date.now().toString(36)}${Math.floor(Math.random() * 36).toString(36)}`
const blankItem = (): MenuItem => ({
  id: newId(), enabled: true, emoji: '', title: '', titleRu: '', hint: '', hintRu: '', action: 'link', target: 'https://', body: '', buttonText: '', openIn: 'app',
})

const subtitle = (i: MenuItem) => {
  if (isBuiltinMenuId(i.id)) return 'Вбудований розділ'
  if (i.action === 'screen') return `Власний · сторінка: ${screenLabel(i.target as Screen)}`
  if (i.action === 'info') return 'Власний · інформаційний блок'
  return `Власний · ${ACTION_LABEL[i.action].toLowerCase()}: ${i.target.replace(/^https:\/\/(t\.me\/)?/, '')}`
}

interface Props {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  // Saves the given list right away (publishes it to users). Resolves to true when it was stored.
  commit: (items: MenuItem[], opts: { confirm?: string; done?: string }) => Promise<boolean>
  busy: boolean
}

type Editing = { item: MenuItem; isNew: boolean } | null

// List of the «Розділи» entries with reorder/visibility controls plus a full form for every entry.
export default function MenuItemsEditor({ items, onChange, commit, busy }: Props) {
  const [editing, setEditing] = useState<Editing>(null)
  const customCount = items.filter((i) => !isBuiltinMenuId(i.id)).length

  const store = async (clean: MenuItem, position: number) => {
    const rest = items.filter((i) => i.id !== clean.id)
    const at = Math.min(Math.max(position, 1), rest.length + 1) - 1
    const next = [...rest.slice(0, at), clean, ...rest.slice(at)]
    if (await commit(next, { done: 'Пункт збережено й опублікований' })) setEditing(null)
  }

  const remove = async (id: string, label: string) => {
    const ok = await commit(items.filter((i) => i.id !== id), {
      confirm: `Видалити пункт «${label}»? Він зникне з меню в усіх користувачів.`,
      done: 'Пункт видалено',
    })
    if (ok) setEditing(null)
  }

  const form = (item: MenuItem, isNew: boolean) => (
    <MenuItemForm
      key={`${item.id}:${isNew}`}
      initial={item}
      isNew={isNew}
      others={items.filter((i) => i.id !== item.id || isNew).map((i) => i.id)}
      position={isNew ? items.length + 1 : items.findIndex((i) => i.id === item.id) + 1}
      total={isNew ? items.length + 1 : items.length}
      busy={busy}
      onSave={store}
      onCancel={() => setEditing(null)}
      onDelete={() => remove(item.id, menuItemView(item, 'uk').title)}
    />
  )

  return (
    <section>
      <Title
        action={
          customCount < MAX_CUSTOM_MENU_ITEMS && (
            <Btn small tone="primary" onClick={() => setEditing({ item: blankItem(), isNew: true })}>
              <Plus size={14} /> Додати пункт меню
            </Btn>
          )
        }
      >
        Пункти меню
      </Title>
      <p className="text-xs text-mute mb-2">
        Список «Розділи» у вкладці «Меню»: порядок, видимість і вміст. Вбудовані розділи можна перейменувати й приховати, але не видалити.
      </p>

      {editing?.isNew && <div className="mb-3">{form(editing.item, true)}</div>}

      <div className="rounded-2xl border border-adm-line divide-y divide-adm-line overflow-hidden">
        {items.map((it, i) => {
          const v = menuItemView(it, 'uk')
          const open = editing && !editing.isNew && editing.item.id === it.id
          return (
            <div key={it.id}>
              <div className={`flex items-center gap-2.5 px-3 py-2.5 ${it.enabled ? '' : 'opacity-60'}`}>
                <OrderButtons first={i === 0} last={i === items.length - 1} onUp={() => onChange(move(items, i, -1))} onDown={() => onChange(move(items, i, 1))} />
                <button type="button" onClick={() => setEditing(open ? null : { item: it, isNew: false })} className="tap flex-1 min-w-0 text-left">
                  <span className="block text-sm font-semibold truncate">
                    {v.emoji} {v.title}
                  </span>
                  <span className="block text-[11px] text-mute truncate">{subtitle(it)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(open ? null : { item: it, isNew: false })}
                  aria-label={`Редагувати «${v.title}»`}
                  className="tap h-8 w-8 shrink-0 rounded-lg bg-adm-ink border border-adm-line grid place-items-center"
                >
                  <Pencil size={14} />
                </button>
                <Switch checked={it.enabled} label={v.title} onChange={(enabled) => onChange(items.map((x) => (x.id === it.id ? { ...x, enabled } : x)))} />
              </div>
              {open && <div className="p-3 bg-adm-ink/40">{form(editing.item, false)}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MenuItemForm({
  initial, isNew, others, position, total, busy, onSave, onCancel, onDelete,
}: {
  initial: MenuItem
  isNew: boolean
  others: string[]
  position: number
  total: number
  busy: boolean
  onSave: (item: MenuItem, position: number) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [item, setItem] = useState(initial)
  const [pos, setPos] = useState(String(position))
  const builtin = isBuiltinMenuId(item.id)
  const set = (p: Partial<MenuItem>) => setItem((cur) => ({ ...cur, ...p }))
  const clean = normalizeMenuItem(item)
  const error = menuItemError(clean) || (others.includes(item.id) ? 'Такий ідентифікатор уже використовується' : '')
  const hasLink = item.action === 'link' || item.action === 'bot' || (item.action === 'info' && !!item.target)
  const posNum = Math.min(Math.max(parseInt(pos, 10) || position, 1), total)

  return (
    <Panel className="space-y-3.5">
      <div className="text-sm font-bold">{isNew ? 'Новий пункт меню' : builtin ? 'Вбудований розділ' : 'Редагування пункту'}</div>

      <Field label="Ідентифікатор" hint={builtin ? 'Системний, змінити не можна.' : isNew ? 'Унікальний, лише малі латинські літери, цифри, «-» і «_». Після збереження не змінюється.' : 'Не змінюється після створення.'}>
        <input
          value={item.id}
          maxLength={30}
          readOnly={builtin || !isNew}
          onChange={(e) => set({ id: e.target.value.toLowerCase().trim() })}
          className={`${aInput} ${builtin || !isNew ? 'opacity-60' : ''}`}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </Field>

      <Field label="Емодзі / іконка" hint={builtin ? 'Порожньо — стандартна іконка розділу.' : undefined}>
        <input value={item.emoji} maxLength={8} onChange={(e) => set({ emoji: e.target.value })} placeholder="🔗" className={aInput} />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => set({ emoji: e })} className="tap h-9 w-9 rounded-xl bg-adm-ink border border-adm-line text-lg grid place-items-center">
              {e}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Назва (укр.)" hint={builtin ? 'Порожньо — стандартна назва.' : undefined}>
          <input value={item.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} className={aInput} />
        </Field>
        <Field label="Назва (рос.)" hint={builtin ? 'Порожньо — стандартна назва.' : 'Порожньо — показується українська.'}>
          <input value={item.titleRu} maxLength={60} onChange={(e) => set({ titleRu: e.target.value })} className={aInput} />
        </Field>
        <Field label="Короткий опис (укр.)">
          <input value={item.hint} maxLength={120} onChange={(e) => set({ hint: e.target.value })} className={aInput} />
        </Field>
        <Field label="Короткий опис (рос.)">
          <input value={item.hintRu} maxLength={120} onChange={(e) => set({ hintRu: e.target.value })} className={aInput} />
        </Field>
      </div>

      <Field label="Тип дії" hint={builtin ? 'Дія вбудованого розділу фіксована: він відкриває свою сторінку.' : undefined}>
        <select
          value={builtin ? 'screen' : item.action}
          disabled={builtin}
          onChange={(e) => set({ action: e.target.value as MenuAction, target: e.target.value === 'link' ? 'https://' : e.target.value === 'screen' ? LINKABLE_SCREENS[0] : '' })}
          className={`${aInput} ${builtin ? 'opacity-60' : ''}`}
        >
          {(Object.keys(ACTION_LABEL) as MenuAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </select>
      </Field>

      {!builtin && item.action === 'screen' && (
        <Field label="Внутрішня сторінка">
          <select value={item.target} onChange={(e) => set({ target: e.target.value })} className={aInput}>
            {LINKABLE_SCREENS.map((id) => (
              <option key={id} value={id}>
                {screenLabel(id)}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!builtin && item.action === 'link' && (
        <Field label="Посилання (URL)" hint="Лише https://">
          <input value={item.target} maxLength={500} onChange={(e) => set({ target: e.target.value })} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://example.com" className={aInput} />
        </Field>
      )}
      {!builtin && item.action === 'bot' && (
        <Field label="Telegram-бот" hint="@username бота або посилання t.me/… (можна з ?start=параметр)">
          <input value={item.target} maxLength={200} onChange={(e) => set({ target: e.target.value })} autoCapitalize="none" autoCorrect="off" placeholder="@UATmarket_bot" className={aInput} />
        </Field>
      )}
      {!builtin && item.action === 'info' && (
        <>
          <Field label="Текст блоку" hint="Звичайний текст, без HTML. Показується під пунктом при натисканні.">
            <textarea value={item.body} maxLength={2000} rows={5} onChange={(e) => set({ body: e.target.value })} className={`${aInput} resize-y`} />
          </Field>
          <Field label="Посилання кнопки (необов'язково)" hint="Лише https://. Якщо порожньо — кнопки не буде.">
            <input value={item.target} maxLength={500} onChange={(e) => set({ target: e.target.value })} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://" className={aInput} />
          </Field>
        </>
      )}

      {!builtin && (item.action !== 'screen') && (
        <Field label="Текст кнопки" hint={item.action === 'info' ? 'Підпис кнопки в інформаційному блоці (за замовчуванням «Відкрити»).' : 'Підпис у списку замість стрілки (необов\'язково).'}>
          <input value={item.buttonText} maxLength={30} onChange={(e) => set({ buttonText: e.target.value })} placeholder="Відкрити" className={aInput} />
        </Field>
      )}

      {!builtin && hasLink && (
        <Field label="Відкривати" hint="Telegram сам вирішує, як показати сторінку: «У Mini App» просить показати її всередині Telegram, «У браузері» — у зовнішньому браузері. Посилання t.me завжди відкриваються в Telegram.">
          <select value={item.openIn} onChange={(e) => set({ openIn: e.target.value as 'app' | 'external' })} className={aInput}>
            <option value="app">У Mini App (всередині Telegram)</option>
            <option value="external">У зовнішньому браузері</option>
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3.5">
        <Field label={`Позиція (1–${total})`} hint="Порядок у списку.">
          <input value={pos} inputMode="numeric" onChange={(e) => setPos(e.target.value.replace(/\D/g, '').slice(0, 3))} className={aInput} />
        </Field>
        <Field label="Статус">
          <select value={item.enabled ? 'on' : 'off'} onChange={(e) => set({ enabled: e.target.value === 'on' })} className={aInput}>
            <option value="on">Активний</option>
            <option value="off">Прихований</option>
          </select>
        </Field>
      </div>

      {error && <div className="rounded-xl border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

      <div className="flex flex-wrap gap-2 pt-1">
        <Btn tone="primary" disabled={!!error} busy={busy} className="flex-[2] min-w-[8rem]" onClick={() => onSave(finalizeMenuItem(clean), posNum)}>
          Зберегти
        </Btn>
        <Btn onClick={onCancel} className="flex-1 min-w-[6rem]">
          Скасувати
        </Btn>
        {!isNew && (
          <Btn tone="danger" disabled={builtin || busy} onClick={onDelete} className="flex-1 min-w-[6rem]">
            <Trash2 size={14} /> Видалити
          </Btn>
        )}
      </div>
      {builtin && <p className="text-[11px] text-mute -mt-1">Вбудований розділ не можна видалити — його можна приховати перемикачем «Статус».</p>}
    </Panel>
  )
}
