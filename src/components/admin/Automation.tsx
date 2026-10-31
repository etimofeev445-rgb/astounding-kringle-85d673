import { ChevronDown, ChevronUp, Pause, Play, RefreshCw, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  INTERVALS,
  MODULES,
  TIMEZONES,
  WEEKDAYS,
  describeSchedule,
  scheduleProblem,
  type AutomationConfig,
  type FieldDef,
  type ModuleDef,
  type ModuleId,
  type Schedule,
} from '../../lib/automation'
import type { AdminResult } from '../../server/admin/actions'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Chips, Empty, ErrorBox, Field, Loading, Panel, Switch, Title, aInput, dt, useAction } from './ui'

type Overview = AdminResult<'automation.get'>
type JobView = NonNullable<Overview['modules'][number]['lastJob']>
type View = 'modules' | 'jobs' | 'events'

const TRIGGER: Record<string, string> = { schedule: 'за розкладом', manual: 'вручну', event: 'подія' }

export default function Automation() {
  const [view, setView] = useState<View>('modules')
  const ov = useAdminQuery('automation.get')
  const [draft, setDraft] = useState<AutomationConfig | null>(null)
  const { busy, run } = useAction()

  useEffect(() => {
    if (ov.data) setDraft(ov.data.config)
  }, [ov.data])

  const save = (next: AutomationConfig, done?: string) =>
    run('save', async () => {
      const saved = await adminCall('automation.save', { config: next })
      setDraft(saved)
      ov.reload()
    }, { done })

  if (ov.error) return <ErrorBox message={ov.error} retry={ov.reload} />
  if (!ov.data || !draft) return <Loading />
  const { stats, env } = ov.data

  return (
    <div className="space-y-4">
      <Panel className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-display font-bold">{draft.paused ? 'Автоматизацію призупинено' : 'Автоматизація працює'}</div>
            <div className="text-xs text-mute">Загальний вимикач: коли вимкнено, жоден модуль не запускається</div>
          </div>
          <Switch
            label="Автоматизація"
            checked={!draft.paused}
            onChange={(v) => save({ ...draft, paused: !v })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat n={stats.queueFlagged} label="на автомодерації" />
          <Stat n={stats.supportWaiting} label="звернень чекають" />
          <Stat n={stats.errors24} label="помилок за 24 год" tone={stats.errors24 ? 'down' : undefined} />
        </div>
        {!env.production && (
          <p className="text-[11px] text-sun">
            Це не робочий (production) сайт: Netlify запускає планувальник лише на опублікованому деплої. Тут працює тільки «Запустити зараз».
          </p>
        )}
        {!env.bot && <p className="text-[11px] text-down">TELEGRAM_BOT_TOKEN не задано — сповіщення й розсилки не працюватимуть.</p>}
        <Btn small busy={busy === 'test'} onClick={() => run('test', () => adminCall('automation.testNotify'), { done: 'Тестове сповіщення надіслано' })}>
          <Send size={12} /> Тестове сповіщення {env.adminChat ? '(чат адміністратора)' : '(ваш чат з ботом)'}
        </Btn>
      </Panel>

      <Chips<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'modules', label: 'Модулі' },
          { value: 'jobs', label: 'Задачі' },
          { value: 'events', label: 'Події' },
        ]}
      />

      {view === 'modules' &&
        MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            def={m}
            draft={draft}
            setDraft={setDraft}
            info={ov.data!.modules.find((x) => x.id === m.id)!}
            save={save}
            saving={busy === 'save'}
            reload={ov.reload}
          />
        ))}
      {view === 'jobs' && <Jobs />}
      {view === 'events' && <Events />}
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'down' }) {
  return (
    <div className="rounded-xl bg-adm-ink border border-adm-line py-2">
      <div className={`font-display text-lg font-bold tabular-nums ${tone === 'down' ? 'text-down' : ''}`}>{n}</div>
      <div className="text-[10px] text-mute leading-tight">{label}</div>
    </div>
  )
}

function ModuleCard({
  def,
  draft,
  setDraft,
  info,
  save,
  saving,
  reload,
}: {
  def: ModuleDef
  draft: AutomationConfig
  setDraft: (c: AutomationConfig) => void
  info: Overview['modules'][number]
  save: (c: AutomationConfig, done?: string) => Promise<unknown>
  saving: boolean
  reload: () => void
}) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<AdminResult<'automation.result'> | undefined>()
  const { busy, run } = useAction()
  const mc = draft.modules[def.id]
  const set = (patch: Partial<typeof mc>) => setDraft({ ...draft, modules: { ...draft.modules, [def.id]: { ...mc, ...patch } } })
  const job = info.openJob ?? info.lastJob

  const runNow = () =>
    run('run', async () => {
      const r = await adminCall('automation.run', { module: def.id })
      reload()
      if (r.job.status === 'done') setResult({ job: r.job, result: (await adminCall('automation.result', { id: r.job.id }))?.result })
      return r
    })

  return (
    <Panel className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{def.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">{def.title}</div>
          <div className="text-[11px] text-mute mt-0.5">{describeSchedule(mc.schedule)}</div>
        </div>
        <Switch
          label={def.title}
          checked={mc.enabled}
          onChange={(v) => save({ ...draft, modules: { ...draft.modules, [def.id]: { ...mc, enabled: v } } })}
        />
      </div>
      <p className="text-xs text-mute">{def.description}</p>

      {job && (
        <div className="rounded-xl bg-adm-ink border border-adm-line px-3 py-2 text-xs space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={job.status} />
            <span className="text-mute">
              {TRIGGER[job.trigger] ?? job.trigger} · {dt(job.finishedAt ?? job.startedAt ?? job.createdAt)}
            </span>
            {job.attempts > 0 && <span className="text-sun">спроб: {job.attempts}</span>}
          </div>
          {job.summary && <div>{job.summary}</div>}
          {job.progressText && job.status !== 'done' && <div className="text-mute">{job.progressText}</div>}
          {job.error && job.status !== 'done' && <div className="text-down">{job.error}</div>}
        </div>
      )}
      {info.nextRun && <div className="text-[11px] text-mute">Наступний запуск: {dt(info.nextRun)}</div>}
      {mc.enabled && info.problem && <div className="text-[11px] text-down">{info.problem}</div>}

      <div className="flex gap-2 flex-wrap">
        {def.manual && (
          <Btn small tone="primary" disabled={!mc.enabled || draft.paused} busy={busy === 'run'} onClick={runNow}>
            <Play size={12} /> Запустити зараз
          </Btn>
        )}
        {def.manual && (
          <Btn
            small
            busy={busy === 'result'}
            onClick={() => run('result', async () => setResult(await adminCall('automation.result', { module: def.id })))}
          >
            Результат
          </Btn>
        )}
        <Btn small onClick={() => setOpen(!open)}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Налаштування
        </Btn>
      </div>

      {result !== undefined && (
        <div className="rounded-xl bg-adm-ink border border-adm-line p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-mute">
              Останній результат {result?.job.finishedAt ? `· ${dt(result.job.finishedAt)}` : ''}
            </span>
            <button onClick={() => setResult(undefined)} aria-label="Закрити" className="tap text-mute">
              <X size={14} />
            </button>
          </div>
          {result ? <ResultView module={def.id} data={result.result} /> : <div className="text-xs text-mute">Ще не було успішних запусків</div>}
        </div>
      )}

      {open && (
        <div className="space-y-3 pt-2 border-t border-adm-line">
          {mc.schedule && <ScheduleEditor value={mc.schedule} onChange={(schedule) => set({ schedule })} />}
          <Fields defs={def.fields} values={mc.settings} onChange={(settings) => set({ settings })} />
          <Btn tone="primary" className="w-full" busy={saving} onClick={() => save(draft, 'Збережено')}>
            Зберегти
          </Btn>
        </div>
      )}
    </Panel>
  )
}

function ScheduleEditor({ value: s, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const problem = s.enabled ? scheduleProblem(s) : null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Розклад</span>
        <Switch label="Розклад" checked={s.enabled} onChange={(enabled) => onChange({ ...s, enabled })} />
      </div>
      {s.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Як часто">
              <select value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as Schedule['kind'] })} className={aInput}>
                <option value="interval">Інтервал</option>
                <option value="daily">Щодня</option>
                <option value="weekly">Щотижня</option>
              </select>
            </Field>
            {s.kind === 'interval' ? (
              <Field label="Кожні">
                <select value={s.every} onChange={(e) => onChange({ ...s, every: Number(e.target.value) })} className={aInput}>
                  {INTERVALS.map((n) => (
                    <option key={n} value={n}>
                      {n % 60 === 0 ? `${n / 60} год` : `${n} хв`}
                    </option>
                  ))}
                </select>
              </Field>
            ) : s.kind === 'weekly' ? (
              <Field label="День">
                <select value={s.weekday} onChange={(e) => onChange({ ...s, weekday: Number(e.target.value) })} className={aInput}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <div />
            )}
            <Field label={s.kind === 'interval' ? 'Від (ГГ:ХХ)' : 'Час'}>
              <input type="time" step={300} value={s.time} onChange={(e) => onChange({ ...s, time: e.target.value })} className={aInput} />
            </Field>
            <Field label="Часовий пояс">
              <select value={s.tz} onChange={(e) => onChange({ ...s, tz: e.target.value })} className={aInput}>
                {[...new Set([s.tz, ...TIMEZONES])].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className={`text-[11px] ${problem ? 'text-down' : 'text-mute'}`}>{problem ?? describeSchedule(s)}</div>
        </>
      )}
    </div>
  )
}

type Values = Record<string, boolean | number | string | string[]>

function Fields({ defs, values, onChange }: { defs: FieldDef[]; values: Values; onChange: (v: Values) => void }) {
  const set = (k: string, v: Values[string]) => onChange({ ...values, [k]: v })
  let group = ''
  return (
    <div className="space-y-2.5">
      {defs.map((f) => {
        const header = f.group && f.group !== group ? (group = f.group) : null
        return (
          <div key={f.key}>
            {header && <div className="text-[11px] font-semibold uppercase tracking-wider text-adm mt-2 mb-1.5">{header}</div>}
            {f.type === 'bool' ? (
              <div className="flex items-center gap-3">
                <span className="flex-1 text-sm">
                  {f.label}
                  {f.hint && <span className="block text-[11px] text-mute">{f.hint}</span>}
                </span>
                <Switch label={f.label} checked={values[f.key] === true} onChange={(v) => set(f.key, v)} />
              </div>
            ) : f.type === 'number' ? (
              <Field label={f.label} hint={f.hint}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={String(values[f.key] ?? f.default)}
                  onChange={(e) => set(f.key, e.target.value === '' ? f.min : Number(e.target.value))}
                  className={aInput}
                />
              </Field>
            ) : f.type === 'text' ? (
              <Field label={f.label} hint={f.hint}>
                {f.max > 200 ? (
                  <textarea rows={4} maxLength={f.max} value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} className={aInput} />
                ) : (
                  <input maxLength={f.max} value={String(values[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} className={aInput} />
                )}
              </Field>
            ) : (
              <ListField label={f.label} hint={f.hint} value={(values[f.key] as string[]) ?? []} onChange={(v) => set(f.key, v)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Comma-separated list, kept as raw text while typing and parsed on every change.
function ListField({ label, hint, value, onChange }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void }) {
  const [raw, setRaw] = useState(value.join(', '))
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={3}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          onChange(e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
        }}
        className={aInput}
      />
    </Field>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────────────────────

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="divide-y divide-adm-line text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5">
          <span className="text-mute">{k}</span>
          <span className="font-semibold text-right tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  )
}

function ResultView({ module, data }: { module: ModuleId; data: unknown }) {
  const d = (data ?? {}) as Record<string, any>
  if (module === 'analytics' && d.dau !== undefined)
    return (
      <div className="space-y-3">
        <Rows
          rows={[
            ['DAU / WAU / MAU', `${d.dau} / ${d.wau} / ${d.mau}`],
            ['Залученість (DAU/MAU)', `${d.stickiness}%`],
            ['Утримання D7', `${d.retentionD7.pct}% (${d.retentionD7.returned} з ${d.retentionD7.cohort})`],
            ['Усього користувачів', d.totalUsers],
            ['Сесій на активного користувача (30 дн)', d.sessionsPerUser],
            ['Авторів публікацій', `${d.authors} (${d.authorsShare}%)`],
          ]}
        />
        {d.topCategories?.length > 0 && (
          <div>
            <div className="text-[11px] text-mute mb-1">Топ категорій бізнесу</div>
            <Rows rows={d.topCategories.map((c: any) => [c.label, c.n])} />
          </div>
        )}
        {d.topReported?.length > 0 && (
          <div>
            <div className="text-[11px] text-mute mb-1">Найбільше скарг (30 днів)</div>
            <Rows rows={d.topReported.map((r: any) => [`${r.kind === 'ad' ? '📢' : '🏪'} ${r.title}`, r.n])} />
          </div>
        )}
      </div>
    )
  if (module === 'server' && Array.isArray(d.checks))
    return (
      <Rows
        rows={d.checks.map((c: any) => [
          c.name,
          <span className={!c.ok ? 'text-down' : c.ms > d.slowMs ? 'text-sun' : 'text-up'}>{c.ok ? `${c.ms} мс` : `недоступне: ${c.error}`}</span>,
        ])}
      />
    )
  if (module === 'reports' && d.users)
    return (
      <Rows
        rows={[
          ['Нових користувачів', d.users.new],
          ['Активних / відкриттів', `${d.users.active} / ${d.users.opens}`],
          ['Нових оголошень / карток', `${d.content.newAds} / ${d.content.newPlaces}`],
          ['Чекають модерації', `${d.content.pendingAds + d.content.pendingPlaces}`],
          ['Скарги (користувачі / авто)', `${d.reports.user} / ${d.reports.auto}`],
          ['Відкритих скарг', d.reports.open],
          ['Звернень / передано адміну', `${d.support.tickets} / ${d.support.escalated}`],
          ['Помилок / збоїв задач', `${d.errors.total} / ${d.errors.jobFailures}`],
          ...(d.orders
            ? ([['Поповнень виконано', `${d.orders.fulfilled?.n ?? 0} · ${d.orders.fulfilled?.sum ?? 0} ₴`]] as [string, React.ReactNode][])
            : []),
        ]}
      />
    )
  if (module === 'webhook' && d.configured !== false && 'url' in d)
    return (
      <Rows
        rows={[
          ['Адреса', d.url || '—'],
          ['Очікувана', d.expected || '—'],
          ['У черзі', d.pendingUpdateCount],
          ['Остання помилка', d.lastErrorDate ? `${dt(d.lastErrorDate)}: ${d.lastErrorMessage}` : '—'],
          ['Проблеми', d.problems?.length ? d.problems.join('; ') : 'немає'],
        ]}
      />
    )
  const flat = Object.entries(d).filter(([, v]) => typeof v !== 'object' || v === null)
  return flat.length ? <Rows rows={flat.map(([k, v]) => [k, String(v)])} /> : <div className="text-xs text-mute">Немає даних</div>
}

// ── Jobs ─────────────────────────────────────────────────────────────────────────────────────

const moduleTitle = (id: string) => {
  const m = MODULES.find((x) => x.id === id)
  return m ? `${m.emoji} ${m.title}` : id
}

function Jobs() {
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const list = useAdminQuery('automation.jobs', { status, offset })
  const { busy, run } = useAction()
  const control = (j: JobView, op: 'pause' | 'resume' | 'cancel') =>
    run(`${op}:${j.id}`, async () => {
      await adminCall('automation.job', { id: j.id, op })
      list.reload()
    }, op === 'cancel' ? { confirm: 'Скасувати задачу?' } : {})

  return (
    <section>
      <Title action={<Btn small onClick={list.reload}><RefreshCw size={12} /></Btn>}>Журнал задач</Title>
      <Chips
        value={status}
        onChange={(v) => {
          setStatus(v)
          setOffset(0)
        }}
        options={[
          { value: '', label: 'Усі' },
          { value: 'queued', label: 'У черзі' },
          { value: 'running', label: 'Виконуються' },
          { value: 'failed', label: 'Помилки' },
          { value: 'done', label: 'Завершені' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Задач ще не було</Empty>
      ) : (
        <div className="space-y-2">
          {list.data.items.map((j) => (
            <Panel key={j.id} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{moduleTitle(j.module)}</span>
                <Badge status={j.status} />
              </div>
              <div className="text-[11px] text-mute">
                {TRIGGER[j.trigger] ?? j.trigger} · створено {dt(j.createdAt)}
                {j.finishedAt && ` · завершено ${dt(j.finishedAt)}`}
                {j.attempts > 0 && ` · спроб ${j.attempts}`}
              </div>
              {j.summary && <div className="text-xs">{j.summary}</div>}
              {j.error && <div className="text-xs text-down">{j.error}</div>}
              {(j.status === 'queued' || j.status === 'paused') && (
                <div className="flex gap-2 pt-1">
                  {j.status === 'queued' ? (
                    <Btn small busy={busy === `pause:${j.id}`} onClick={() => control(j, 'pause')}>
                      <Pause size={12} /> Пауза
                    </Btn>
                  ) : (
                    <Btn small busy={busy === `resume:${j.id}`} onClick={() => control(j, 'resume')}>
                      <Play size={12} /> Продовжити
                    </Btn>
                  )}
                  <Btn small tone="danger" busy={busy === `cancel:${j.id}`} onClick={() => control(j, 'cancel')}>
                    Скасувати
                  </Btn>
                </div>
              )}
            </Panel>
          ))}
          <Pager offset={offset} size={list.data.pageSize} count={list.data.items.length} set={setOffset} />
        </div>
      )}
    </section>
  )
}

function Pager({ offset, size, count, set }: { offset: number; size: number; count: number; set: (n: number) => void }) {
  if (offset === 0 && count < size) return null
  return (
    <div className="flex gap-2 justify-center pt-1">
      <Btn small disabled={offset === 0} onClick={() => set(Math.max(0, offset - size))}>
        Новіші
      </Btn>
      <Btn small disabled={count < size} onClick={() => set(offset + size)}>
        Старіші
      </Btn>
    </div>
  )
}

// ── Events ───────────────────────────────────────────────────────────────────────────────────

const LEVEL: Record<string, string> = { info: 'border-l-sky', warn: 'border-l-sun', error: 'border-l-down' }

function Events() {
  const [group, setGroup] = useState('')
  const [offset, setOffset] = useState(0)
  const list = useAdminQuery('automation.events', { group, offset })
  return (
    <section>
      <Title action={<Btn small onClick={list.reload}><RefreshCw size={12} /></Btn>}>Події та сигнали</Title>
      <Chips
        value={group}
        onChange={(v) => {
          setGroup(v)
          setOffset(0)
        }}
        options={[
          { value: '', label: 'Усі' },
          { value: 'security', label: 'Безпека' },
          { value: 'errors', label: 'Помилки' },
          { value: 'webhook', label: 'Webhook' },
          { value: 'jobs', label: 'Задачі' },
          { value: 'support', label: 'Підтримка' },
        ]}
      />
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Подій немає</Empty>
      ) : (
        <div className="space-y-1.5">
          {list.data.items.map((e) => (
            <div key={e.id} className={`rounded-xl bg-adm-panel border border-adm-line border-l-4 ${LEVEL[e.level] ?? ''} px-3 py-2`}>
              <div className="text-xs">{e.message}</div>
              <div className="text-[10px] text-mute mt-0.5">
                {dt(e.createdAt)} · {e.kind}
              </div>
            </div>
          ))}
          <Pager offset={offset} size={list.data.pageSize} count={list.data.items.length} set={setOffset} />
        </div>
      )}
    </section>
  )
}
