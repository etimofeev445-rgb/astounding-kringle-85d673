import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { HOME_SECTIONS, TABS, type AppConfig, type Banner, type Toggle } from '../../lib/appConfig'
import { SCREENS } from '../../lib/nav'
import { CATEGORIES, type PlaceCategory } from '../../lib/places'
import type { ConfigCtx } from './AdminApp'
import { ImageUpload } from './ImageUpload'
import MenuItemsEditor from './MenuItems'
import { Btn, Field, OrderButtons, Panel, Switch, Title, aInput, move, useAction } from './ui'

const screenName = (id: string) => {
  const s = SCREENS.find((x) => x.id === id)
  return s ? `${s.emoji} ${s.title.uk}` : id
}

// Local draft of the config with a sticky "save" bar; nothing goes live until it is saved.
function useDraft({ config, save }: ConfigCtx, area: string) {
  const [draft, setDraft] = useState(config)
  const { busy, run } = useAction()
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  // Saves `next` right away and adopts what the server stored (it sanitizes), so the draft stays in sync.
  const commit = async (next: AppConfig, opts: { confirm?: string; done?: string } = {}) => {
    const saved = await run('save', () => save(next, area), opts)
    if (saved) setDraft(saved)
    return !!saved
  }
  const bar = (
    <div className="sticky bottom-3 z-20 mt-5">
      <div className="flex gap-2 rounded-2xl border border-adm-line bg-adm-panel/95 backdrop-blur p-2 shadow-2xl">
        <Btn disabled={!dirty} onClick={() => setDraft(config)} className="flex-1">
          Скасувати
        </Btn>
        <Btn
          tone="primary"
          disabled={!dirty}
          busy={busy === 'save'}
          className="flex-[2]"
          onClick={() => commit(draft, { confirm: 'Зберегти зміни? Вони одразу побачать усі користувачі.', done: 'Збережено' })}
        >
          {dirty ? 'Зберегти зміни' : 'Збережено'}
        </Btn>
      </div>
    </div>
  )
  return { draft, setDraft, bar, commit, busy: busy === 'save' }
}

function ToggleList<T extends string>({
  items,
  onChange,
  name,
  extra,
}: {
  items: Toggle<T>[]
  onChange: (items: Toggle<T>[]) => void
  name: (id: T) => string
  extra?: (id: T) => ReactNode
}) {
  return (
    <div className="rounded-2xl border border-adm-line divide-y divide-adm-line overflow-hidden">
      {items.map((it, i) => (
        <div key={it.id} className={`flex items-center gap-3 px-3 py-2.5 ${it.enabled ? '' : 'opacity-60'}`}>
          <OrderButtons first={i === 0} last={i === items.length - 1} onUp={() => onChange(move(items, i, -1))} onDown={() => onChange(move(items, i, 1))} />
          <span className="flex-1 min-w-0 text-sm font-semibold">
            {name(it.id)}
            {extra?.(it.id)}
          </span>
          <Switch
            checked={it.enabled}
            label={name(it.id)}
            onChange={(v) => onChange(items.map((x) => (x.id === it.id ? { ...x, enabled: v } : x)))}
          />
        </div>
      ))}
    </div>
  )
}

export function HomeEditor(ctx: ConfigCtx) {
  const { draft, setDraft, bar } = useDraft(ctx, 'home')
  const home = draft.home
  const setHome = (h: Partial<AppConfig['home']>) => setDraft({ ...draft, home: { ...home, ...h } })
  const disabled = (id: string) => draft.menu.disabledScreens.includes(id as never)

  return (
    <div className="space-y-5">
      <section>
        <Title>Розділи головної</Title>
        <p className="text-xs text-mute mb-2">Порядок блоків зверху вниз і їх видимість.</p>
        <ToggleList items={home.sections} onChange={(sections) => setHome({ sections })} name={(id) => HOME_SECTIONS.find((s) => s.id === id)?.label ?? id} />
      </section>

      <section>
        <Title>Плитки розділів</Title>
        <p className="text-xs text-mute mb-2">Картки в сітці «Плитки розділів». Вимкнені розділи (Меню → Доступність) не показуються.</p>
        <ToggleList
          items={home.cards}
          onChange={(cards) => setHome({ cards })}
          name={screenName}
          extra={(id) => disabled(id) && <span className="block text-[11px] text-down">розділ вимкнено</span>}
        />
      </section>

      <section>
        <Title>Популярні категорії</Title>
        <CategoryEditor value={home.categories} onChange={(categories) => setHome({ categories })} />
      </section>

      <section>
        <Title action={home.banners.length < 10 && (
          <Btn small onClick={() => setHome({ banners: [...home.banners, { id: `b${Date.now().toString(36)}`, title: '', text: '', imageUrl: '', link: '', enabled: true }] })}>
            <Plus size={14} /> Банер
          </Btn>
        )}>Банери</Title>
        {home.banners.length === 0 ? (
          <p className="text-sm text-mute">Банерів немає. Банер без назви й зображення не зберігається.</p>
        ) : (
          <div className="space-y-3">
            {home.banners.map((b, i) => (
              <BannerEditor
                key={b.id}
                banner={b}
                first={i === 0}
                last={i === home.banners.length - 1}
                onMove={(dir) => setHome({ banners: move(home.banners, i, dir) })}
                onChange={(nb) => setHome({ banners: home.banners.map((x) => (x.id === b.id ? nb : x)) })}
                onRemove={() => setHome({ banners: home.banners.filter((x) => x.id !== b.id) })}
              />
            ))}
          </div>
        )}
      </section>
      {bar}
    </div>
  )
}

function CategoryEditor({ value, onChange }: { value: PlaceCategory[]; onChange: (v: PlaceCategory[]) => void }) {
  const rest = CATEGORIES.filter((c) => !value.includes(c.id))
  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-adm-line divide-y divide-adm-line overflow-hidden">
        {value.map((id, i) => {
          const c = CATEGORIES.find((x) => x.id === id)!
          return (
            <div key={id} className="flex items-center gap-3 px-3 py-2.5">
              <OrderButtons first={i === 0} last={i === value.length - 1} onUp={() => onChange(move(value, i, -1))} onDown={() => onChange(move(value, i, 1))} />
              <span className="flex-1 text-sm font-semibold">
                {c.emoji} {c.label.uk}
              </span>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="Прибрати" className="tap h-8 w-8 rounded-lg grid place-items-center text-down">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
        {value.length === 0 && <div className="px-3 py-3 text-sm text-mute">Блок не показується, доки немає жодної категорії.</div>}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rest.map((c) => (
            <Btn key={c.id} small onClick={() => onChange([...value, c.id])}>
              <Plus size={13} /> {c.emoji} {c.label.uk}
            </Btn>
          ))}
        </div>
      )}
    </div>
  )
}

function BannerEditor({
  banner,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  banner: Banner
  onChange: (b: Banner) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  first: boolean
  last: boolean
}) {
  const set = (p: Partial<Banner>) => onChange({ ...banner, ...p })
  const linkScreen = banner.link.startsWith('screen:') ? banner.link.slice(7) : ''
  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-2">
        <OrderButtons first={first} last={last} onUp={() => onMove(-1)} onDown={() => onMove(1)} />
        <span className="flex-1 text-sm font-semibold truncate">{banner.title || 'Новий банер'}</span>
        <Switch checked={banner.enabled} onChange={(enabled) => set({ enabled })} label="Показувати" />
        <button type="button" onClick={onRemove} aria-label="Видалити банер" className="tap h-8 w-8 rounded-lg grid place-items-center text-down">
          <Trash2 size={16} />
        </button>
      </div>
      <Field label="Заголовок">
        <input value={banner.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} className={aInput} />
      </Field>
      <Field label="Текст">
        <input value={banner.text} maxLength={200} onChange={(e) => set({ text: e.target.value })} className={aInput} />
      </Field>
      <Field label="Зображення">
        <ImageUpload value={banner.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
      </Field>
      <Field label="Куди веде" hint="Розділ застосунку або посилання https://">
        <select
          value={linkScreen ? `screen:${linkScreen}` : banner.link ? 'url' : ''}
          onChange={(e) => set({ link: e.target.value === 'url' ? 'https://' : e.target.value })}
          className={`${aInput} mb-2`}
        >
          <option value="">Нікуди</option>
          <option value="url">Посилання</option>
          {SCREENS.map((s) => (
            <option key={s.id} value={`screen:${s.id}`}>
              {s.emoji} {s.title.uk}
            </option>
          ))}
        </select>
        {banner.link && !linkScreen && (
          <input value={banner.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" className={aInput} />
        )}
      </Field>
    </Panel>
  )
}

export function MenuEditor(ctx: ConfigCtx) {
  const { draft, setDraft, bar, commit, busy } = useDraft(ctx, 'menu')
  const menu = draft.menu
  const setMenu = (m: Partial<AppConfig['menu']>) => setDraft({ ...draft, menu: { ...menu, ...m } })
  return (
    <div className="space-y-5">
      <MenuItemsEditor
        items={menu.items}
        onChange={(items) => setMenu({ items })}
        commit={(items, opts) => commit({ ...draft, menu: { ...menu, items } }, opts)}
        busy={busy}
      />
      <section>
        <Title>Нижня панель</Title>
        <p className="text-xs text-mute mb-2">«Головна» показується завжди першою.</p>
        <ToggleList items={menu.tabs} onChange={(tabs) => setMenu({ tabs })} name={(id) => TABS.find((t) => t.id === id)?.label ?? id} />
      </section>
      <section>
        <Title>Доступність розділів</Title>
        <p className="text-xs text-mute mb-2">Вимкнений розділ не відкривається ніде (меню, пошук, посилання) — користувач побачить «Розділ тимчасово недоступний».</p>
        <div className="rounded-2xl border border-adm-line divide-y divide-adm-line overflow-hidden">
          {SCREENS.map((s) => {
            const on = !menu.disabledScreens.includes(s.id)
            return (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${on ? '' : 'opacity-60'}`}>
                <span className="flex-1 text-sm font-semibold">{screenName(s.id)}</span>
                <Switch
                  checked={on}
                  label={s.title.uk}
                  onChange={(v) => setMenu({ disabledScreens: v ? menu.disabledScreens.filter((x) => x !== s.id) : [...menu.disabledScreens, s.id] })}
                />
              </div>
            )
          })}
        </div>
      </section>
      {bar}
    </div>
  )
}

export { useDraft }
