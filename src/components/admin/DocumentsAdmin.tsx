import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { AdminResult } from '../../server/admin/actions'
import { adminCall, useAdminQuery } from './api'
import { Badge, Btn, Empty, ErrorBox, Field, Loading, Panel, Switch, Title, aInput, dt, useAction } from './ui'

type Doc = AdminResult<'docs.list'>['items'][number]
type Draft = Omit<Doc, 'id' | 'updatedAt'> & { id?: string }

const EMPTY: Draft = { title: '', body: '', url: '', published: true, sortOrder: 0 }

// Information materials shown at the top of the "Документи" screen.
export default function DocumentsAdmin() {
  const list = useAdminQuery('docs.list')
  const [draft, setDraft] = useState<Draft | null>(null)
  const { busy, run } = useAction()

  const save = () =>
    draft &&
    run('save', async () => {
      await adminCall('docs.save', draft)
      setDraft(null)
      list.reload()
    }, { confirm: draft.id ? 'Зберегти зміни документа?' : 'Додати документ?' })

  const remove = (d: Doc) =>
    run(`del:${d.id}`, async () => {
      await adminCall('docs.delete', { id: d.id })
      list.reload()
    }, { confirm: `Видалити документ «${d.title}»? Щоб лише сховати його, вимкніть «Опубліковано».` })

  return (
    <div className="space-y-4">
      <Title action={!draft && <Btn small tone="primary" onClick={() => setDraft({ ...EMPTY, sortOrder: (list.data?.items.length ?? 0) * 10 })}><Plus size={14} /> Документ</Btn>}>
        Документи
      </Title>
      <p className="text-xs text-mute -mt-2">Матеріали з’являються на екрані «Документи» над довідником центрів ДП «Документ».</p>

      {draft && (
        <Panel className="space-y-3">
          <Field label="Назва">
            <input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={aInput} />
          </Field>
          <Field label="Текст">
            <textarea rows={8} maxLength={10000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className={aInput} />
          </Field>
          <Field label="Посилання (необовʼязково)" hint="Наприклад, на PDF або офіційну сторінку — https://">
            <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className={aInput} />
          </Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Порядок" hint="Менше — вище">
              <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} className={aInput} />
            </Field>
            <div className="flex items-center gap-3 pb-3">
              <Switch checked={draft.published} onChange={(published) => setDraft({ ...draft, published })} label="Опубліковано" />
              <span className="text-sm font-semibold">Опубліковано</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => setDraft(null)}>
              Скасувати
            </Btn>
            <Btn tone="primary" className="flex-1" disabled={!draft.title.trim()} busy={busy === 'save'} onClick={save}>
              Зберегти
            </Btn>
          </div>
        </Panel>
      )}

      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Empty>Документів ще немає</Empty>
      ) : (
        <div className="space-y-2">
          {list.data.items.map((d) => (
            <Panel key={d.id} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge status={d.published ? 'active' : 'deleted'}>{d.published ? 'опубліковано' : 'приховано'}</Badge>
                  <span className="text-[11px] text-mute">#{d.sortOrder} · {dt(d.updatedAt)}</span>
                </div>
                <div className="font-semibold">{d.title}</div>
                {d.body && <p className="text-xs text-mute line-clamp-2 mt-0.5">{d.body}</p>}
              </div>
              <Btn small onClick={() => setDraft(d)}>
                <Pencil size={14} />
              </Btn>
              <Btn small tone="danger" busy={busy === `del:${d.id}`} onClick={() => remove(d)}>
                <Trash2 size={14} />
              </Btn>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
