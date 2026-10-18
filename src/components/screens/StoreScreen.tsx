import { Clock, Share2, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AdView } from '../../lib/ads'
import { useI18n } from '../../lib/i18n'
import { category, tgUsername, type PlaceView } from '../../lib/places'
import { removePlace, upsertPlace, usePlaces } from '../../lib/placesData'
import { confirmAction, haptic, initData, notify, openLink, shareText } from '../../lib/telegram'
import { deletePlace, getStorefront } from '../../server/places'
import { PlaceForm } from '../map/PlaceForm'
import { BottomSheet, CategoryChip, ContactButtons, MapsButton, PlaceDetails } from '../map/PlaceSheet'

type Data = { business: PlaceView | null; items: PlaceView[]; ads: AdView[] }

const adPrice = (p: number | null, t: (tr: { uk: string; ru: string }) => string) =>
  p == null ? t({ uk: 'Договірна', ru: 'Договорная' }) : `${p.toLocaleString('uk-UA')} ₴`

// Public storefront of a seller (?store=<username>): profile header plus all their listings.
export default function StoreScreen({ storeKey }: { storeKey: string }) {
  const { t } = useI18n()
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<PlaceView>()
  const [editing, setEditing] = useState<PlaceView>()
  // Keeps the page in sync with edits/deletions made from the map.
  const { places } = usePlaces()

  useEffect(() => {
    setError(false)
    getStorefront({ data: { initData: initData(), store: storeKey } })
      .then(setData)
      .catch(() => setError(true))
  }, [storeKey, places])

  if (error) {
    return <div className="text-center py-16 text-mute">{t({ uk: 'Не вдалося завантажити сторінку', ru: 'Не удалось загрузить страницу' })}</div>
  }
  if (!data) {
    return (
      <div>
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-20 w-20 rounded-3xl -mt-10 ml-4 border-4 border-ink" />
        <div className="skeleton h-6 w-2/3 mt-4" />
        <div className="skeleton h-4 w-full mt-3" />
      </div>
    )
  }

  const { business, items, ads } = data
  const head = business ?? items[0]
  if (!head && ads.length === 0) {
    return (
      <div className="text-center py-16 text-mute">
        <Store size={40} className="mx-auto mb-3 opacity-60" />
        {t({ uk: 'Магазин не знайдено', ru: 'Магазин не найден' })}
      </div>
    )
  }

  const handle = head ? tgUsername(head.tgContact) : /^[a-z]/.test(storeKey) ? storeKey : ''
  const name = business?.title ?? (handle ? `@${handle}` : t({ uk: 'Продавець', ru: 'Продавец' }))
  const c = category(business?.category ?? head?.category ?? 'shop')

  const share = () => {
    haptic()
    shareText(`${name} — UAT Market\n${location.origin}/?store=${storeKey}`)
  }

  const remove = async (p: PlaceView) => {
    const ok = await confirmAction(t({ uk: `Видалити «${p.title}»?`, ru: `Удалить «${p.title}»?` }))
    if (!ok) return
    const res = await deletePlace({ data: { initData: initData(), id: p.id } }).catch(() => ({ ok: false }))
    if (res.ok) {
      notify('success')
      removePlace(p.id)
      setSelected(undefined)
    } else notify('error')
  }

  return (
    <div>
      {/* Header: cover, logo, name */}
      <div className="relative">
        {business?.coverUrl ? (
          <img src={business.coverUrl} alt="" className="h-40 w-full rounded-3xl object-cover bg-panel-2" />
        ) : (
          <div className="h-40 rounded-3xl" style={{ background: `linear-gradient(135deg, ${c.color}, #1a2943 85%)` }} />
        )}
        <button
          onClick={share}
          aria-label={t({ uk: 'Поділитися', ru: 'Поделиться' })}
          className="tap absolute top-3 right-3 h-9 w-9 rounded-xl bg-ink/70 grid place-items-center"
        >
          <Share2 size={16} />
        </button>
        <div className="absolute -bottom-9 left-4 h-20 w-20 rounded-3xl border-4 border-ink bg-panel-2 overflow-hidden grid place-items-center text-3xl">
          {business?.photoUrl ? <img src={business.photoUrl} alt="" className="h-full w-full object-cover" /> : c.emoji}
        </div>
      </div>

      <div className="mt-11 rise">
        <h1 className="font-display text-2xl font-bold tracking-tight leading-tight">{name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {business && <CategoryChip cat={business.category} />}
          {handle && <span className="text-sm text-mute">@{handle}</span>}
        </div>
        {business?.description && <p className="text-[15px] text-white/90 leading-relaxed mt-3 whitespace-pre-line">{business.description}</p>}

        {business?.hours && (
          <div className="mt-3 flex items-start gap-2 text-sm text-mute">
            <Clock size={15} className="mt-0.5 shrink-0" />
            <span>{business.hours}</span>
          </div>
        )}

        {business?.price && (
          <div className="mt-3 rounded-2xl bg-sun/10 border border-sun/25 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-sun/80 mb-1">{t({ uk: 'Прайс / Послуги', ru: 'Прайс / Услуги' })}</div>
            <div className="text-sm font-semibold text-sun whitespace-pre-line">{business.price}</div>
          </div>
        )}

        {head && (
          <div className="mt-4">
            <ContactButtons place={business ?? head} primaryLabel={t({ uk: 'Написати в Telegram', ru: 'Написать в Telegram' })} />
          </div>
        )}

        {business && (
          <div className="mt-2">
            <MapsButton place={business} />
          </div>
        )}
        {business?.mine && (
          <button
            onClick={() => setSelected(business)}
            className="tap w-full mt-3 rounded-2xl bg-line py-2.5 text-sm font-semibold"
          >
            {t({ uk: 'Редагувати або видалити', ru: 'Редактировать или удалить' })}
          </button>
        )}
      </div>

      {/* Seller's listings */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-mute mt-7 mb-2 px-1">
        {t({ uk: 'Інші картки та оголошення', ru: 'Другие карточки и объявления' })}
        {items.length + ads.length > 0 && ` · ${items.length + ads.length}`}
      </h2>
      {items.length + ads.length === 0 ? (
        <p className="text-sm text-mute px-1">{t({ uk: 'Поки немає оголошень', ru: 'Пока нет объявлений' })}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((p, i) => (
            <Tile
              key={p.id}
              delay={i}
              photo={p.photoUrl}
              emoji={category(p.category).emoji}
              title={p.title}
              price={p.price.split('\n')[0]}
              onClick={() => {
                haptic()
                setSelected(p)
              }}
            />
          ))}
          {ads.map((a, i) => (
            <Tile
              key={a.id}
              delay={items.length + i}
              photo={a.photoUrl}
              emoji="📢"
              title={a.title}
              price={adPrice(a.price, t)}
              onClick={() => a.postUrl && openLink(a.postUrl)}
            />
          ))}
        </div>
      )}

      {selected && (
        <BottomSheet key={selected.id} label={selected.title} onClose={() => setSelected(undefined)}>
          <PlaceDetails
            place={selected}
            onEdit={() => {
              setSelected(undefined)
              setEditing(selected)
            }}
            onDelete={() => remove(selected)}
          />
        </BottomSheet>
      )}

      {editing && (
        <PlaceForm
          place={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(p) => {
            setEditing(undefined)
            upsertPlace(p)
          }}
        />
      )}
    </div>
  )
}

function Tile({
  photo,
  emoji,
  title,
  price,
  delay,
  onClick,
}: {
  photo: string | null
  emoji: string
  title: string
  price: string
  delay: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="tap rise text-left rounded-3xl bg-panel border border-line overflow-hidden"
      style={{ animationDelay: `${40 * Math.min(delay, 8)}ms` }}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="h-28 w-full object-cover bg-panel-2" />
      ) : (
        <div className="h-28 grid place-items-center text-4xl bg-panel-2">{emoji}</div>
      )}
      <div className="p-3">
        <div className="font-semibold text-sm leading-snug line-clamp-2">{title}</div>
        {price && <div className="font-display text-sm font-bold text-sun mt-1 truncate">{price}</div>}
      </div>
    </button>
  )
}
