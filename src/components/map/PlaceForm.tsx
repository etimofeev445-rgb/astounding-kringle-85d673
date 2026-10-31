import { Camera, ImagePlus, Instagram, MapPin, Phone, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { normalizePhone } from '../../lib/ads'
import { useI18n } from '../../lib/i18n'
import { toJpeg } from '../../lib/image'
import {
  CATEGORIES,
  COUNTRIES,
  PLACE_LIMITS,
  normalizeInstagram,
  normalizeMapUrl,
  normalizeTg,
  type PlaceCategory,
  type PlaceInput,
  type PlaceView,
} from '../../lib/places'
import { haptic, initData, notify, showAlert, userHandle } from '../../lib/telegram'
import { savePlace } from '../../server/places'
import { Field, inputCls } from '../ui'

function PhotoPicker({
  label,
  hint,
  preview,
  onPick,
  onRemove,
}: {
  label: string
  hint: string
  preview?: string
  onPick: (f: File) => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
      {preview ? (
        <div className="relative rounded-3xl overflow-hidden border border-line h-32">
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button type="button" onClick={() => ref.current?.click()} className="tap h-8 w-8 rounded-xl bg-ink/80 grid place-items-center" aria-label="Change">
              <Camera size={15} />
            </button>
            <button type="button" onClick={onRemove} className="tap h-8 w-8 rounded-xl bg-ink/80 text-down grid place-items-center" aria-label="Remove">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`tap w-full rounded-3xl border-2 border-dashed border-line bg-panel/60 flex flex-col items-center justify-center gap-1.5 text-mute h-32`}
        >
          <ImagePlus size={24} />
          <span className="text-xs">{hint}</span>
        </button>
      )}
    </div>
  )
}

// Add / edit a catalog card. "Опублікувати" posts it to the Telegram catalog channel.
export function PlaceForm({
  place,
  onClose,
  onSaved,
}: {
  place?: PlaceView
  onClose: () => void
  onSaved: (p: PlaceView) => void
}) {
  const { t } = useI18n()
  const [cat, setCat] = useState<PlaceCategory>(place?.category ?? 'shop')
  const [country, setCountry] = useState(place?.country ?? '')
  const [city, setCity] = useState(place?.city ?? '')
  const [title, setTitle] = useState(place?.title ?? '')
  const [description, setDescription] = useState(place?.description ?? '')
  const [hours, setHours] = useState(place?.hours ?? '')
  const [price, setPrice] = useState(place?.price ?? '')
  const [phone, setPhone] = useState(place?.phone ?? '')
  const [instagram, setInstagram] = useState(place?.instagram ?? '')
  const [telegram, setTelegram] = useState(place?.tgContact ?? '')
  const [mapUrl, setMapUrl] = useState(place?.mapUrl ?? '')
  const [photo, setPhoto] = useState<string>()
  const [cover, setCover] = useState<string>()
  const [keepPhoto, setKeepPhoto] = useState(!!place?.photoUrl)
  const [keepCover, setKeepCover] = useState(!!place?.coverUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    // New cards start with the author's own @username as the Telegram contact.
    if (!place) setTelegram(userHandle() ?? '')
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const pick = (set: (v: string) => void, maxBytes: number, maxSide: number) => async (f: File) => {
    try {
      set(await toJpeg(f, maxBytes, maxSide))
      setError(undefined)
    } catch {
      setError(t({ uk: 'Не вдалося обробити фото', ru: 'Не удалось обработать фото' }))
    }
  }

  const submit = async () => {
    if (!country.trim() || !city.trim()) {
      return setError(t({ uk: 'Вкажіть країну та місто', ru: 'Укажите страну и город' }))
    }
    if (!title.trim() || !description.trim()) {
      return setError(t({ uk: 'Заповніть назву та опис', ru: 'Заполните название и описание' }))
    }
    if (!phone.trim() && !instagram.trim() && !telegram.trim()) {
      return setError(t({ uk: 'Додайте хоча б один контакт', ru: 'Добавьте хотя бы один контакт' }))
    }
    if (phone.trim() && !normalizePhone(phone)) return setError(t({ uk: 'Перевірте номер телефону', ru: 'Проверьте номер телефона' }))
    if (instagram.trim() && !normalizeInstagram(instagram)) return setError(t({ uk: 'Перевірте Instagram', ru: 'Проверьте Instagram' }))
    if (telegram.trim() && !normalizeTg(telegram)) {
      return setError(t({ uk: 'Telegram — у форматі @username', ru: 'Telegram — в формате @username' }))
    }
    if (mapUrl.trim() && !normalizeMapUrl(mapUrl)) return setError(t({ uk: 'Перевірте посилання на адресу', ru: 'Проверьте ссылку на адрес' }))

    const input: PlaceInput = {
      category: cat,
      country: country.trim(),
      city: city.trim(),
      title: title.trim(),
      description: description.trim(),
      hours: hours.trim(),
      price: price.trim(),
      mapUrl: mapUrl.trim(),
      phone: phone.trim(),
      instagram: instagram.trim(),
      tgContact: telegram.trim(),
    }
    setBusy(true)
    setError(undefined)
    haptic('medium')
    try {
      const res = await savePlace({
        data: {
          initData: initData(),
          id: place?.id,
          place: input,
          photo,
          cover,
          removePhoto: !photo && !keepPhoto,
          removeCover: !cover && !keepCover,
        },
      })
      if (!res.ok) {
        console.error('Save place error:', res.reason)
        notify('error')
        return setError(
          t(
            res.reason === 'limit'
              ? { uk: `Максимум ${PLACE_LIMITS.perUser} карток на акаунт`, ru: `Максимум ${PLACE_LIMITS.perUser} карточек на аккаунт` }
              : res.reason === 'unauthorized'
                ? { uk: 'Відкрийте застосунок у Telegram', ru: 'Откройте приложение в Telegram' }
                : res.reason === 'blocked'
                  ? { uk: 'Публікацію для вашого акаунта обмежено. Зверніться до підтримки', ru: 'Публикация для вашего аккаунта ограничена. Обратитесь в поддержку' }
                  : res.reason === 'disabled'
                    ? { uk: 'Додавання карток тимчасово вимкнено', ru: 'Добавление карточек временно отключено' }
                    : res.reason === 'channel'
                      ? { uk: 'Канал зараз недоступний — спробуйте пізніше', ru: 'Канал сейчас недоступен — попробуйте позже' }
                      : res.reason === 'invalid'
                        ? { uk: 'Перевірте поля форми', ru: 'Проверьте поля формы' }
                        : { uk: 'Не вдалося зберегти. Спробуйте ще раз', ru: 'Не удалось сохранить. Попробуйте ещё раз' },
          ),
        )
      }
      notify(res.published ? 'success' : 'warning')
      showAlert(
        t(
          !place
            ? { uk: 'Опубліковано! Картка вже в каналі та в каталозі.', ru: 'Опубликовано! Карточка уже в канале и в каталоге.' }
            : res.published
              ? { uk: 'Зміни збережено й оновлено в каналі!', ru: 'Изменения сохранены и обновлены в канале!' }
              : { uk: 'Зміни збережено, але пост у каналі не оновився.', ru: 'Изменения сохранены, но пост в канале не обновился.' },
        ),
      )
      onSaved(res.place)
    } catch (e) {
      console.error('Save place error:', e)
      notify('error')
      setError(t({ uk: 'Не вдалося відправити. Спробуйте ще раз', ru: 'Не удалось отправить. Попробуйте ещё раз' }))
    } finally {
      setBusy(false)
    }
  }

  // City suggestions follow the chosen country; for a custom country every known city is offered.
  const cities = COUNTRIES[country.trim()] ?? Object.values(COUNTRIES).flat()

  const photoPreview = photo ?? (keepPhoto ? place?.photoUrl ?? undefined : undefined)
  const coverPreview = cover ?? (keepCover ? place?.coverUrl ?? undefined : undefined)

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink overflow-y-auto overscroll-contain fade-in" role="dialog" aria-modal>
      <div className="mx-auto max-w-md px-4 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {place ? t({ uk: 'Редагування', ru: 'Редактирование' }) : t({ uk: 'Додати бізнес', ru: 'Добавить бизнес' })}
          </h2>
          <button onClick={onClose} className="tap h-9 w-9 rounded-xl bg-panel border border-line grid place-items-center text-mute" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t({ uk: 'Країна', ru: 'Страна' })} *`}>
            <input
              value={country}
              maxLength={PLACE_LIMITS.country}
              onChange={(e) => setCountry(e.target.value)}
              list="place-countries"
              autoComplete="off"
              required
              className={inputCls}
              placeholder={t({ uk: 'Україна', ru: 'Украина' })}
            />
          </Field>
          <Field label={`${t({ uk: 'Місто', ru: 'Город' })} *`}>
            <input
              value={city}
              maxLength={PLACE_LIMITS.city}
              onChange={(e) => setCity(e.target.value)}
              list="place-cities"
              autoComplete="off"
              required
              className={inputCls}
              placeholder={t({ uk: 'Київ', ru: 'Киев' })}
            />
          </Field>
          <datalist id="place-countries">
            {Object.keys(COUNTRIES).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <datalist id="place-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <Field label={t({ uk: 'Назва', ru: 'Название' })}>
          <input
            value={title}
            maxLength={PLACE_LIMITS.title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder={t({ uk: 'Напр. Салон «Лілея»', ru: 'Напр. Салон «Лилия»' })}
          />
        </Field>

        <Field label={t({ uk: 'Категорія', ru: 'Категория' })}>
          <select value={cat} onChange={(e) => setCat(e.target.value as PlaceCategory)} className={`${inputCls} appearance-none`}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {t(c.label)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`${t({ uk: 'Опис', ru: 'Описание' })} · ${description.length}/${PLACE_LIMITS.description}`}>
          <textarea
            value={description}
            maxLength={PLACE_LIMITS.description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${inputCls} resize-none`}
            placeholder={t({ uk: 'Чим ви займаєтесь, переваги…', ru: 'Чем вы занимаетесь, преимущества…' })}
          />
        </Field>

        <Field label={t({ uk: 'Графік роботи', ru: 'График работы' })}>
          <input
            value={hours}
            maxLength={PLACE_LIMITS.hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputCls}
            placeholder={t({ uk: 'Пн–Пт 9:00–19:00, Сб 10:00–16:00', ru: 'Пн–Пт 9:00–19:00, Сб 10:00–16:00' })}
          />
        </Field>

        <Field label={t({ uk: 'Прайс / Послуги', ru: 'Прайс / Услуги' })}>
          <textarea
            value={price}
            maxLength={PLACE_LIMITS.price}
            onChange={(e) => setPrice(e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder={t({ uk: 'Стрижка — 400 ₴\nМанікюр — 550 ₴', ru: 'Стрижка — 400 ₴\nМаникюр — 550 ₴' })}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <PhotoPicker
              label={t({ uk: 'Обкладинка', ru: 'Обложка' })}
              hint={t({ uk: 'Додати обкладинку', ru: 'Добавить обложку' })}
              preview={coverPreview}
              onPick={pick(setCover, PLACE_LIMITS.coverUploadBytes, 1600)}
              onRemove={() => {
                setCover(undefined)
                setKeepCover(false)
              }}
            />
          </div>
          <PhotoPicker
            label={t({ uk: 'Логотип', ru: 'Логотип' })}
            hint={t({ uk: 'Додати', ru: 'Добавить' })}
            preview={photoPreview}
            onPick={pick(setPhoto, PLACE_LIMITS.logoUploadBytes, 800)}
            onRemove={() => {
              setPhoto(undefined)
              setKeepPhoto(false)
            }}
          />
        </div>

        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-mute mb-1.5">{t({ uk: 'Контакти', ru: 'Контакты' })}</span>
          <div className="space-y-2">
            <IconInput icon={<Phone size={16} />}>
              <input value={phone} type="tel" inputMode="tel" onChange={(e) => setPhone(e.target.value)} className={`${inputCls} pl-10`} placeholder="+380…" aria-label={t({ uk: 'Телефон', ru: 'Телефон' })} />
            </IconInput>
            <IconInput icon={<Instagram size={16} />}>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={`${inputCls} pl-10`} placeholder="Instagram" autoCapitalize="off" autoCorrect="off" />
            </IconInput>
            <IconInput icon={<Send size={16} />}>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className={`${inputCls} pl-10`} placeholder="Telegram @username" autoCapitalize="off" autoCorrect="off" />
            </IconInput>
          </div>
        </div>

        <Field label={t({ uk: 'Посилання на адресу', ru: 'Ссылка на адрес' })}>
          <IconInput icon={<MapPin size={16} />}>
            <input
              value={mapUrl}
              maxLength={PLACE_LIMITS.mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className={`${inputCls} pl-10`}
              placeholder="https://maps.app.goo.gl/…"
            />
          </IconInput>
          <p className="text-xs text-mute mt-1.5 px-1">
            {t({
              uk: 'Скопіюйте «Поділитися» в Google Maps. Можна просто вписати адресу.',
              ru: 'Скопируйте «Поделиться» в Google Maps. Можно просто вписать адрес.',
            })}
          </p>
        </Field>

        {error && <div className="rounded-2xl bg-down/10 border border-down/30 text-down text-sm px-4 py-3">{error}</div>}

        <button onClick={submit} disabled={busy} aria-busy={busy} className="tap glow-btn w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display font-bold text-white disabled:opacity-60">
          <Send size={18} />
          {busy
            ? place
              ? t({ uk: 'Збереження…', ru: 'Сохранение…' })
              : t({ uk: 'Публікація…', ru: 'Публикация…' })
            : place
              ? t({ uk: 'Зберегти зміни', ru: 'Сохранить изменения' })
              : t({ uk: 'Опублікувати', ru: 'Опубликовать' })}
        </button>
        {!place && (
          <p className="text-xs text-mute text-center -mt-1">
            {t({ uk: 'Картка з’явиться в каналі та в каталозі застосунку', ru: 'Карточка появится в канале и в каталоге приложения' })}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function IconInput({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute pointer-events-none">{icon}</span>
      {children}
    </div>
  )
}
