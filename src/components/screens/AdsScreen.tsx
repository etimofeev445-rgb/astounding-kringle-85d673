import { Camera, ExternalLink, ImagePlus, Megaphone, Pencil, Phone, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AD_LIMITS, normalizePhone, normalizeTg, type AdInput, type AdView } from '../../lib/ads'
import { dropFromCart } from '../../lib/cart'
import { toJpeg } from '../../lib/image'
import { useI18n, type Tr } from '../../lib/i18n'
import { confirmAction, haptic, initData, notify, openLink, userHandle } from '../../lib/telegram'
import { deleteAd, listAds, saveAd } from '../../server/ads'
import { ReportButton } from '../ReportButton'
import { CartToggle, Field, ScreenTitle, Segmented, inputCls } from '../ui'

const CHANNEL_URL = 'https://t.me/UATmarket'

type Tab = 'all' | 'mine'

export default function AdsScreen() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('all')
  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Оголошення', ru: 'Объявления' })}
        subtitle={t({ uk: 'Публікуються в каналі @UATmarket', ru: 'Публикуются в канале @UATmarket' })}
      />
      <Segmented
        value={tab}
        onChange={(v) => {
          haptic()
          setTab(v)
        }}
        options={[
          { value: 'all', label: t({ uk: 'Усі оголошення', ru: 'Все объявления' }) },
          { value: 'mine', label: t({ uk: 'Мої', ru: 'Мои' }) },
        ]}
      />
      <AdsBoard key={tab} mine={tab === 'mine'} />
    </div>
  )
}

const fmtPrice = (p: number | null, t: (tr: Tr) => string) =>
  p == null ? t({ uk: 'Договірна', ru: 'Договорная' }) : `${p.toLocaleString('uk-UA')} ₴`

// Ad list plus the create/edit form. Also embedded in the «Кошик» screen as "Мої оголошення".
export function AdsBoard({ mine }: { mine: boolean }) {
  const { t } = useI18n()
  const [ads, setAds] = useState<AdView[] | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<AdView | 'new' | null>(null)
  const [inTelegram, setInTelegram] = useState(false)
  const [notice, setNotice] = useState<string>()

  const load = useCallback(() => {
    setError(false)
    listAds({ data: { initData: initData(), mine } })
      .then((r) => setAds(r.ads))
      .catch(() => setError(true))
  }, [mine])

  useEffect(() => {
    setInTelegram(!!initData())
    load()
  }, [load])

  const remove = async (ad: AdView) => {
    const ok = await confirmAction(t({ uk: `Видалити «${ad.title}»?`, ru: `Удалить «${ad.title}»?` }))
    if (!ok) return
    haptic('medium')
    const res = await deleteAd({ data: { initData: initData(), id: ad.id } }).catch(() => ({ ok: false }))
    if (res.ok) {
      notify('success')
      dropFromCart('ad', ad.id)
      setAds((list) => list?.filter((a) => a.id !== ad.id) ?? null)
    } else notify('error')
  }

  if (editing) {
    return (
      <AdForm
        ad={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={(ad, published) => {
          setEditing(null)
          setNotice(
            published
              ? t({ uk: 'Опубліковано в каналі ✅', ru: 'Опубликовано в канале ✅' })
              : t({
                  uk: 'Збережено, але не вдалося опублікувати в каналі. Спробуйте відредагувати пізніше.',
                  ru: 'Сохранено, но не удалось опубликовать в канале. Попробуйте отредактировать позже.',
                }),
          )
          setAds((list) => [ad, ...(list ?? []).filter((a) => a.id !== ad.id)])
          window.scrollTo({ top: 0 })
        }}
      />
    )
  }

  return (
    <div>
      <button
        onClick={() => {
          haptic('medium')
          setNotice(undefined)
          setEditing('new')
        }}
        disabled={!inTelegram}
        className="tap glow-btn w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display font-bold text-white mb-3 disabled:opacity-50"
      >
        <Plus size={20} /> {t({ uk: 'Подати оголошення', ru: 'Подать объявление' })}
      </button>
      {!inTelegram && (
        <p className="text-xs text-mute mb-3 px-1">
          {t({
            uk: 'Щоб подати чи редагувати оголошення, відкрийте застосунок у Telegram.',
            ru: 'Чтобы подать или редактировать объявление, откройте приложение в Telegram.',
          })}
        </p>
      )}
      {notice && (
        <div className="rise rounded-2xl border border-up/30 bg-up/10 text-sm px-4 py-3 mb-3 flex items-start gap-2">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(undefined)} className="text-mute" aria-label="OK">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <button onClick={load} className="tap w-full rounded-2xl bg-panel border border-line py-3 text-mute flex items-center justify-center gap-2">
          <RefreshCw size={16} /> {t({ uk: 'Не вдалося завантажити. Повторити', ru: 'Не удалось загрузить. Повторить' })}
        </button>
      )}
      {!ads && !error && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-panel border border-line animate-pulse" />
          ))}
        </div>
      )}
      {ads && ads.length === 0 && (
        <div className="text-center py-10 text-mute">
          <Megaphone size={36} className="mx-auto mb-3 opacity-60" />
          {mine
            ? t({ uk: 'У вас ще немає оголошень', ru: 'У вас ещё нет объявлений' })
            : t({ uk: 'Оголошень поки немає — станьте першим!', ru: 'Объявлений пока нет — станьте первым!' })}
        </div>
      )}
      <div className="space-y-3">
        {ads?.map((ad, i) => (
          <AdCard
            key={ad.id}
            ad={ad}
            delay={i}
            onEdit={() => {
              haptic()
              setNotice(undefined)
              setEditing(ad)
            }}
            onDelete={() => remove(ad)}
          />
        ))}
      </div>
      <button
        onClick={() => openLink(CHANNEL_URL)}
        className="tap w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#229ed9] py-3 font-semibold"
      >
        <Send size={16} /> {t({ uk: 'Канал @UATmarket', ru: 'Канал @UATmarket' })}
      </button>
    </div>
  )
}

function AdCard({ ad, delay, onEdit, onDelete }: { ad: AdView; delay: number; onEdit: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const tgUser = ad.tgContact.startsWith('@') ? ad.tgContact.slice(1) : ''
  return (
    <article className="rise rounded-3xl bg-panel border border-line overflow-hidden" style={{ animationDelay: `${50 * Math.min(delay, 8)}ms` }}>
      {ad.photoUrl && (
        <button onClick={() => setOpen(!open)} className="block w-full">
          <img src={ad.photoUrl} alt="" loading="lazy" className={`w-full object-cover bg-panel-2 ${open ? 'max-h-[28rem]' : 'h-48'}`} />
        </button>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
            <h3 className="font-display font-bold leading-snug">{ad.title}</h3>
            <div className="font-display text-lg font-bold text-sun mt-1">{fmtPrice(ad.price, t)}</div>
          </button>
          <CartToggle item={{ kind: 'ad', ref: ad.id, title: ad.title, subtitle: fmtPrice(ad.price, t), url: '' }} />
        </div>
        <p
          onClick={() => setOpen(!open)}
          className={`text-sm text-white/85 mt-2 whitespace-pre-line ${open ? '' : 'line-clamp-3'}`}
        >
          {ad.description}
        </p>
        <div className="text-[11px] text-mute mt-2">{new Date(ad.createdAt).toLocaleDateString('uk-UA')}</div>

        <div className="flex flex-wrap gap-2 mt-3">
          {ad.phone && (
            <a href={`tel:${ad.phone}`} className="tap flex-1 min-w-[8rem] flex items-center justify-center gap-2 rounded-2xl bg-sky py-2.5 text-sm font-semibold">
              <Phone size={15} /> {ad.phone}
            </a>
          )}
          {tgUser ? (
            <button
              onClick={() => openLink(`https://t.me/${tgUser}`)}
              className="tap flex-1 min-w-[8rem] flex items-center justify-center gap-2 rounded-2xl bg-[#229ed9] py-2.5 text-sm font-semibold"
            >
              <Send size={15} /> {ad.tgContact}
            </button>
          ) : (
            ad.tgContact && (
              <span className="flex-1 min-w-[8rem] flex items-center justify-center gap-2 rounded-2xl bg-panel-2 py-2.5 text-sm">
                <Send size={15} /> ID {ad.tgContact}
              </span>
            )
          )}
          {ad.postUrl && (
            <button
              onClick={() => openLink(ad.postUrl!)}
              aria-label={t({ uk: 'Відкрити в каналі', ru: 'Открыть в канале' })}
              className="tap h-10 w-10 rounded-2xl bg-panel-2 grid place-items-center text-mute"
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>

        {!ad.mine && <ReportButton kind="ad" id={ad.id} />}
        {ad.mine && (
          <div className="flex gap-2 mt-2">
            <button onClick={onEdit} className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-line py-2.5 text-sm font-semibold">
              <Pencil size={15} /> {t({ uk: 'Редагувати', ru: 'Редактировать' })}
            </button>
            <button onClick={onDelete} className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-down/15 text-down py-2.5 text-sm font-semibold">
              <Trash2 size={15} /> {t({ uk: 'Видалити', ru: 'Удалить' })}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function AdForm({
  ad,
  onCancel,
  onSaved,
}: {
  ad?: AdView
  onCancel: () => void
  onSaved: (ad: AdView, published: boolean) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(ad?.title ?? '')
  const [description, setDescription] = useState(ad?.description ?? '')
  const [price, setPrice] = useState(ad?.price != null ? String(ad.price) : '')
  const [phone, setPhone] = useState(ad?.phone ?? '')
  const [tgContact, setTg] = useState(ad?.tgContact ?? '')
  const [photo, setPhoto] = useState<string>() // newly picked image
  const [keepPhoto, setKeepPhoto] = useState(!!ad?.photoUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ad) setTg(userHandle() ?? '')
  }, [ad])

  const preview = photo ?? (keepPhoto ? ad?.photoUrl ?? undefined : undefined)

  const pick = async (f?: File) => {
    if (!f) return
    try {
      setPhoto(await toJpeg(f, AD_LIMITS.photoBytes))
      setError(undefined)
    } catch {
      setError(t({ uk: 'Не вдалося обробити фото', ru: 'Не удалось обработать фото' }))
    }
  }

  const submit = async () => {
    const input: AdInput = {
      title: title.trim(),
      description: description.trim(),
      price: price.trim() === '' ? null : Number(price.replace(/\s/g, '')),
      phone: phone.trim(),
      tgContact: tgContact.trim(),
    }
    if (!input.title || !input.description) {
      return setError(t({ uk: 'Заповніть назву та опис', ru: 'Заполните название и описание' }))
    }
    if (input.price != null && !(Number.isInteger(input.price) && input.price >= 0 && input.price <= AD_LIMITS.price)) {
      return setError(t({ uk: 'Ціна має бути цілим числом', ru: 'Цена должна быть целым числом' }))
    }
    const phoneOk = !input.phone || normalizePhone(input.phone)
    const tgOk = !input.tgContact || normalizeTg(input.tgContact)
    if (!phoneOk || !tgOk || (!input.phone && !input.tgContact)) {
      return setError(
        t({
          uk: 'Вкажіть коректний номер телефону або Telegram (@username чи ID)',
          ru: 'Укажите корректный номер телефона или Telegram (@username или ID)',
        }),
      )
    }

    setBusy(true)
    setError(undefined)
    haptic('medium')
    try {
      const res = await saveAd({
        data: { initData: initData(), id: ad?.id, ad: input, photo, removePhoto: !photo && !keepPhoto },
      })
      if (res.ok) {
        notify('success')
        onSaved(res.ad, res.published)
      } else {
        notify('error')
        setError(
          t(
            res.reason === 'limit'
              ? { uk: `Максимум ${AD_LIMITS.perUser} активних оголошень`, ru: `Максимум ${AD_LIMITS.perUser} активных объявлений` }
              : res.reason === 'unauthorized'
                ? { uk: 'Відкрийте застосунок у Telegram', ru: 'Откройте приложение в Telegram' }
                : res.reason === 'blocked'
                  ? { uk: 'Публікацію для вашого акаунта обмежено. Зверніться до підтримки', ru: 'Публикация для вашего аккаунта ограничена. Обратитесь в поддержку' }
                  : res.reason === 'disabled'
                    ? { uk: 'Подання оголошень тимчасово вимкнено', ru: 'Подача объявлений временно отключена' }
                    : { uk: 'Перевірте поля форми', ru: 'Проверьте поля формы' },
          ),
        )
      }
    } catch {
      notify('error')
      setError(t({ uk: 'Помилка мережі. Спробуйте ще раз', ru: 'Ошибка сети. Попробуйте ещё раз' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rise space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          {ad ? t({ uk: 'Редагування', ru: 'Редактирование' }) : t({ uk: 'Нове оголошення', ru: 'Новое объявление' })}
        </h2>
        <button onClick={onCancel} className="tap h-9 w-9 rounded-xl bg-panel border border-line grid place-items-center text-mute" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div>
        <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{t({ uk: 'Фото', ru: 'Фото' })}</span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }} />
        {preview ? (
          <div className="relative rounded-3xl overflow-hidden border border-line">
            <img src={preview} alt="" className="w-full max-h-72 object-cover" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button onClick={() => fileRef.current?.click()} className="tap h-9 w-9 rounded-xl bg-ink/80 grid place-items-center" aria-label="Change">
                <Camera size={16} />
              </button>
              <button
                onClick={() => {
                  setPhoto(undefined)
                  setKeepPhoto(false)
                }}
                className="tap h-9 w-9 rounded-xl bg-ink/80 text-down grid place-items-center"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="tap w-full h-36 rounded-3xl border-2 border-dashed border-line bg-panel/60 flex flex-col items-center justify-center gap-2 text-mute"
          >
            <ImagePlus size={28} />
            <span className="text-sm">{t({ uk: 'Додати фото', ru: 'Добавить фото' })}</span>
          </button>
        )}
      </div>

      <Field label={t({ uk: 'Назва', ru: 'Название' })}>
        <input value={title} maxLength={AD_LIMITS.title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={t({ uk: 'Напр. iPhone 13, 128 ГБ', ru: 'Напр. iPhone 13, 128 ГБ' })} />
      </Field>
      <Field label={`${t({ uk: 'Опис', ru: 'Описание' })} · ${description.length}/${AD_LIMITS.description}`}>
        <textarea
          value={description}
          maxLength={AD_LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className={`${inputCls} resize-none`}
          placeholder={t({ uk: 'Стан, характеристики, місто…', ru: 'Состояние, характеристики, город…' })}
        />
      </Field>
      <Field label={t({ uk: 'Ціна, ₴ (порожньо — договірна)', ru: 'Цена, ₴ (пусто — договорная)' })}>
        <input value={price} inputMode="numeric" onChange={(e) => setPrice(e.target.value.replace(/[^\d\s]/g, ''))} className={inputCls} placeholder="0" />
      </Field>
      <Field label={t({ uk: 'Номер телефону', ru: 'Номер телефона' })}>
        <input value={phone} type="tel" inputMode="tel" onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+380 67 123 45 67" />
      </Field>
      <Field label={t({ uk: 'Telegram: @username або ID', ru: 'Telegram: @username или ID' })}>
        <input value={tgContact} onChange={(e) => setTg(e.target.value)} className={inputCls} placeholder="@username" autoCapitalize="off" autoCorrect="off" />
      </Field>
      <p className="text-xs text-mute -mt-2 px-1">
        {t({ uk: 'Потрібен телефон або Telegram — хоча б одне.', ru: 'Нужен телефон или Telegram — хотя бы одно.' })}
      </p>

      {error && <div className="rounded-2xl bg-down/10 border border-down/30 text-down text-sm px-4 py-3">{error}</div>}

      <button onClick={submit} disabled={busy} className="tap glow-btn w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display font-bold text-white disabled:opacity-60">
        <Send size={18} />
        {busy
          ? t({ uk: 'Публікуємо…', ru: 'Публикуем…' })
          : ad
            ? t({ uk: 'Зберегти зміни', ru: 'Сохранить изменения' })
            : t({ uk: 'Опублікувати в канал', ru: 'Опубликовать в канал' })}
      </button>
    </div>
  )
}
