import { Instagram, MessageCircle, Phone, Plus, RotateCw, Search, Send, Store, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ADMIN_HANDLE, ADMIN_URL } from '../../lib/admin'
import { useI18n } from '../../lib/i18n'
import { CATEGORIES, category, placeLocation, placeSearchText, tgUsername, type PlaceCategory, type PlaceView } from '../../lib/places'
import { removePlace, upsertPlace, usePlaces } from '../../lib/placesData'
import { confirmAction, haptic, initData, notify, openLink } from '../../lib/telegram'
import { deletePlace } from '../../server/places'
import { PlaceForm } from '../map/PlaceForm'
import { BottomSheet, CategoryChip, MapsButton, PlaceDetails } from '../map/PlaceSheet'
import { ScreenTitle, inputCls } from '../ui'

type Filter = 'all' | 'mine' | PlaceCategory

// Small round contact shortcuts on a card; the full buttons live in the details sheet.
function ContactIcons({ place }: { place: PlaceView }) {
  const user = tgUsername(place.tgContact)
  const cls = 'tap h-9 w-9 shrink-0 rounded-xl grid place-items-center'
  const stop = (fn: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    haptic()
    fn()
  }
  return (
    <>
      {place.phone && (
        <a href={`tel:${place.phone}`} onClick={(e) => e.stopPropagation()} aria-label={place.phone} className={`${cls} bg-sky`}>
          <Phone size={15} />
        </a>
      )}
      {place.instagram && (
        <button
          onClick={stop(() => openLink(`https://instagram.com/${place.instagram}`))}
          aria-label="Instagram"
          className={`${cls} bg-[linear-gradient(135deg,#f58529,#dd2a7b,#8134af)]`}
        >
          <Instagram size={15} />
        </button>
      )}
      {user && (
        <button onClick={stop(() => openLink(`https://t.me/${user}`))} aria-label="Telegram" className={`${cls} bg-[#229ed9]`}>
          <Send size={15} />
        </button>
      )}
    </>
  )
}

function PlaceCard({ place, index, onOpen }: { place: PlaceView; index: number; onOpen: () => void }) {
  const { t } = useI18n()
  const c = category(place.category)
  const logo = place.photoUrl ? (
    <img src={place.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <span className="text-2xl">{c.emoji}</span>
  )
  return (
    <article
      onClick={onOpen}
      className="tap rise rounded-3xl bg-panel/90 border border-line overflow-hidden cursor-pointer"
      style={{ animationDelay: `${40 * Math.min(index, 8)}ms` }}
    >
      {place.coverUrl && <img src={place.coverUrl} alt="" loading="lazy" className="h-32 w-full object-cover bg-panel-2" />}
      <div className="p-3.5">
        <div className="flex gap-3">
          <span
            className={`h-16 w-16 shrink-0 rounded-2xl overflow-hidden grid place-items-center ${place.coverUrl ? '-mt-10 border-4 border-panel' : ''}`}
            style={{ background: place.photoUrl ? undefined : `${c.color}26` }}
          >
            {logo}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold leading-tight truncate">{place.title}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              <CategoryChip cat={place.category} />
              {place.mine && <span className="text-[11px] font-bold text-sun">{t({ uk: 'Ваша', ru: 'Ваша' })}</span>}
            </div>
          </div>
        </div>
        {placeLocation(place) && <p className="text-xs text-mute mt-2 truncate">📍 {placeLocation(place)}</p>}
        <p className="text-sm text-mute leading-snug mt-2 line-clamp-2">{place.description}</p>
        {place.hours && <p className="text-xs text-mute mt-2 truncate">🕒 {place.hours}</p>}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1">
            {place.mapUrl ? (
              <MapsButton place={place} compact />
            ) : (
              <span className="block text-center text-sm font-semibold text-sky py-2.5">{t({ uk: 'Детальніше', ru: 'Подробнее' })}</span>
            )}
          </div>
          <ContactIcons place={place} />
        </div>
      </div>
    </article>
  )
}

export default function MapScreen({ startAdd, openStore }: { startAdd?: boolean; openStore: (key: string) => void }) {
  const { t } = useI18n()
  const { places, error, reload } = usePlaces()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  // The feed filters on a debounced copy of the query so typing stays smooth.
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PlaceView>()
  const [form, setForm] = useState<PlaceView | 'new' | null>(null)
  const [inTelegram, setInTelegram] = useState(false)
  const [notice, setNotice] = useState<string>()

  useEffect(() => {
    const ok = !!initData()
    setInTelegram(ok)
    if (startAdd && ok) setForm('new')
  }, [startAdd])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of places ?? []) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    return m
  }, [places])

  useEffect(() => {
    const id = setTimeout(() => setSearch(query), 250)
    return () => clearTimeout(id)
  }, [query])

  const index = useMemo(() => new Map((places ?? []).map((p) => [p.id, placeSearchText(p)])), [places])

  // Case-insensitive search over every field of a card; each word of the query must match somewhere.
  const visible = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (places ?? []).filter((p) => {
      if (filter !== 'all' && (filter === 'mine' ? !p.mine : p.category !== filter)) return false
      const text = index.get(p.id) ?? ''
      return words.every((w) => text.includes(w))
    })
  }, [places, index, filter, search])

  const clearSearch = () => {
    haptic()
    setQuery('')
    setSearch('')
  }

  const remove = async (p: PlaceView) => {
    const ok = await confirmAction(t({ uk: `Видалити «${p.title}»?`, ru: `Удалить «${p.title}»?` }))
    if (!ok) return
    haptic('medium')
    const res = await deletePlace({ data: { initData: initData(), id: p.id } }).catch((e) => {
      console.error('Delete place error:', e)
      return { ok: false }
    })
    if (res.ok) {
      notify('success')
      removePlace(p.id)
      setSelected(undefined)
      if (mineCount <= 1) setFilter((f) => (f === 'mine' ? 'all' : f))
    } else notify('error')
  }

  // Outside Telegram there's no signed identity to submit with, so the button goes to the admin chat.
  const addBusiness = () => {
    haptic('medium')
    setNotice(undefined)
    if (inTelegram) setForm('new')
    else openLink(ADMIN_URL)
  }

  const mineCount = places?.filter((p) => p.mine).length ?? 0
  // "Мої" lets authors find and manage their own cards (matched by Telegram ID on the server).
  const filters: Filter[] = ['all', ...(mineCount ? ['mine' as const] : []), ...CATEGORIES.map((c) => c.id)]

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Каталог', ru: 'Каталог' })}
        subtitle={t({ uk: 'Магазини, салони, авто та послуги', ru: 'Магазины, салоны, авто и услуги' })}
      />

      <div className="relative mb-3">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
          className={`${inputCls} pl-10 pr-10`}
          placeholder={t({ uk: 'Назва, місто, послуга, контакт…', ru: 'Название, город, услуга, контакт…' })}
        />
        {query && (
          <button
            onClick={clearSearch}
            aria-label={t({ uk: 'Очистити', ru: 'Очистить' })}
            className="tap absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-mute"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 px-4 flex gap-2 overflow-x-auto mb-4">
        {filters.map((f) => {
          const active = filter === f
          const c = f === 'all' || f === 'mine' ? null : category(f)
          const n = f === 'all' ? places?.length ?? 0 : f === 'mine' ? mineCount : counts.get(f) ?? 0
          return (
            <button
              key={f}
              onClick={() => {
                haptic()
                setFilter(f)
              }}
              className={`tap shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold border ${
                active ? 'bg-sky border-sky text-white' : 'bg-panel border-line text-mute'
              }`}
            >
              {c ? `${c.emoji} ${t(c.label)}` : f === 'mine' ? `⭐ ${t({ uk: 'Мої', ru: 'Мои' })}` : t({ uk: 'Усі', ru: 'Все' })}
              {n > 0 && <span className={`text-[11px] ${active ? 'text-white/80' : 'text-mute/70'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <button
        onClick={addBusiness}
        className="tap glow-btn w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display font-bold text-white"
      >
        <Plus size={20} /> {t({ uk: 'Додати бізнес', ru: 'Добавить бизнес' })}
      </button>
      <button
        onClick={() => {
          haptic()
          openLink(ADMIN_URL)
        }}
        className="tap w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-mute"
      >
        <MessageCircle size={13} />
        {t({ uk: `Питання щодо розміщення — ${ADMIN_HANDLE}`, ru: `Вопросы по размещению — ${ADMIN_HANDLE}` })}
      </button>
      {notice && (
        <div className="rise rounded-2xl border border-up/30 bg-up/10 text-sm px-4 py-3 mt-1 flex items-start gap-2">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(undefined)} className="text-mute" aria-label="OK">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {!places && !error &&
          [0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-3xl" />)}
        {!places && error && (
          <button onClick={reload} className="tap w-full text-center py-8 text-mute">
            <RotateCw size={28} className="mx-auto mb-2 opacity-60" />
            {t({ uk: 'Каталог тимчасово недоступний — торкніться, щоб оновити', ru: 'Каталог временно недоступен — коснитесь, чтобы обновить' })}
          </button>
        )}
        {places && visible.length === 0 && (
          <div className="text-center py-8 text-mute">
            <Store size={34} className="mx-auto mb-2 opacity-60" />
            {places.length === 0
              ? t({ uk: 'Тут поки порожньо — додайте свій бізнес першим!', ru: 'Здесь пока пусто — добавьте свой бизнес первым!' })
              : t({ uk: 'Нічого не знайдено за вашим запитом', ru: 'Ничего не найдено по вашему запросу' })}
            {places.length > 0 && search.trim() && (
              <button onClick={clearSearch} className="tap block mx-auto mt-3 text-sm font-semibold text-sky">
                {t({ uk: 'Очистити пошук', ru: 'Очистить поиск' })}
              </button>
            )}
          </div>
        )}
        {visible.map((p, i) => (
          <PlaceCard
            key={p.id}
            index={i}
            place={p}
            onOpen={() => {
              haptic()
              setSelected(p)
            }}
          />
        ))}
      </div>

      {selected && (
        <BottomSheet key={selected.id} label={selected.title} onClose={() => setSelected(undefined)}>
          <PlaceDetails
            place={selected}
            onStore={() => {
              setSelected(undefined)
              openStore(selected.storeKey)
            }}
            onEdit={() => {
              setSelected(undefined)
              setForm(selected)
            }}
            onDelete={() => remove(selected)}
          />
        </BottomSheet>
      )}

      {form && (
        <PlaceForm
          place={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={(p) => {
            const isNew = form === 'new'
            setForm(null)
            upsertPlace(p)
            setFilter('all')
            setQuery('')
            setSearch('')
            if (!isNew) setSelected(p)
            setNotice(
              isNew
                ? t({ uk: 'Опубліковано ✅ — картка вже в каналі та в каталозі', ru: 'Опубликовано ✅ — карточка уже в канале и в каталоге' })
                : t({ uk: 'Зміни збережено ✅', ru: 'Изменения сохранены ✅' }),
            )
          }}
        />
      )}
    </div>
  )
}
