import { Clock, Instagram, MapPin, Megaphone, Navigation, Pencil, Phone, Send, Store, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n'
import { category, placeLocation, tgUsername, type PlaceView } from '../../lib/places'
import { haptic, openLink } from '../../lib/telegram'
import { ReportButton } from '../ReportButton'

// Slide-up sheet; swipe down (when scrolled to top), tap the backdrop or Esc to close.
export function BottomSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n()
  const [closing, setClosing] = useState(false)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 260)
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const onTouchStart = (e: TouchEvent) => {
    e.stopPropagation()
    dragStart.current = (scroller.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null
  }
  const onTouchMove = (e: TouchEvent) => {
    e.stopPropagation()
    if (dragStart.current === null) return
    setDrag(Math.max(0, e.touches[0].clientY - dragStart.current))
  }
  const onTouchEnd = (e: TouchEvent) => {
    e.stopPropagation()
    if (drag > 110) close()
    dragStart.current = null
    setDrag(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal aria-label={label}>
      <div onClick={close} className={`absolute inset-0 bg-black/50 ${closing ? 'fade-out' : 'fade-in'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md max-h-[85vh] flex flex-col rounded-t-[28px] bg-panel border border-line border-b-0 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] ${
          closing ? 'sheet-out' : 'sheet-in'
        }`}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="relative pt-2.5 pb-1 shrink-0">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-line" />
          <button
            onClick={close}
            aria-label={t({ uk: 'Закрити', ru: 'Закрыть' })}
            className="tap absolute right-3 top-2.5 z-10 h-9 w-9 rounded-xl bg-panel-2 grid place-items-center text-mute"
          >
            <X size={18} />
          </button>
        </div>
        <div ref={scroller} className="overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function CategoryChip({ cat }: { cat: string }) {
  const { t } = useI18n()
  const c = category(cat)
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${c.color}26`, color: c.color }}>
      {c.emoji} {t(c.label)}
    </span>
  )
}

// "Відкрити на мапі": opens the author's direct address link (Google Maps etc.); hidden without one.
export function MapsButton({ place, compact }: { place: PlaceView; compact?: boolean }) {
  const { t } = useI18n()
  if (!place.mapUrl) return null
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        haptic('medium')
        openLink(place.mapUrl)
      }}
      className={`tap w-full flex items-center justify-center gap-2 rounded-2xl bg-up text-ink font-bold ${compact ? 'py-2.5 text-sm' : 'py-3'}`}
    >
      <Navigation size={compact ? 15 : 17} /> {t({ uk: 'Відкрити на мапі', ru: 'Открыть на карте' })}
    </button>
  )
}

// Telegram / phone / Instagram buttons. Telegram is the primary action.
export function ContactButtons({ place, primaryLabel }: { place: PlaceView; primaryLabel?: string }) {
  const { t } = useI18n()
  const user = tgUsername(place.tgContact)
  return (
    <div className="space-y-2">
      {user && (
        <button
          onClick={() => {
            haptic('medium')
            openLink(`https://t.me/${user}`)
          }}
          className="tap w-full flex items-center justify-center gap-2 rounded-2xl bg-[#229ed9] py-3 font-semibold"
        >
          <Send size={17} /> {primaryLabel ?? t({ uk: "Зв'язатися в Telegram", ru: 'Связаться в Telegram' })}
        </button>
      )}
      {(place.phone || place.instagram) && (
        <div className="flex gap-2">
          {place.phone && (
            <a href={`tel:${place.phone}`} className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-sky py-2.5 text-sm font-semibold">
              <Phone size={15} /> {place.phone}
            </a>
          )}
          {place.instagram && (
            <button
              onClick={() => openLink(`https://instagram.com/${place.instagram}`)}
              className="tap flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f58529,#dd2a7b,#8134af)] py-2.5 text-sm font-semibold"
            >
              <Instagram size={15} /> {place.instagram}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PlaceDetails({
  place,
  onStore,
  onEdit,
  onDelete,
}: {
  place: PlaceView
  onStore?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { t } = useI18n()
  const c = category(place.category)
  return (
    <div>
      <div className="relative mb-11">
        {place.coverUrl ? (
          <img src={place.coverUrl} alt="" className="w-full h-44 object-cover rounded-2xl bg-panel-2" />
        ) : (
          <div className="h-28 rounded-2xl" style={{ background: `linear-gradient(135deg, ${c.color}, #1a2943 85%)` }} />
        )}
        <div className="absolute -bottom-8 left-3 h-16 w-16 rounded-2xl border-4 border-panel bg-panel-2 overflow-hidden grid place-items-center text-2xl">
          {place.photoUrl ? <img src={place.photoUrl} alt="" className="h-full w-full object-cover" /> : c.emoji}
        </div>
      </div>
      <CategoryChip cat={place.category} />
      <h2 className="font-display text-xl font-bold leading-tight tracking-tight mt-2 pr-10">{place.title}</h2>
      {placeLocation(place) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm text-mute">
          <MapPin size={14} className="shrink-0" />
          <span>{placeLocation(place)}</span>
        </div>
      )}
      <p className="text-[15px] text-white/90 leading-relaxed mt-3 whitespace-pre-line">{place.description}</p>
      {place.hours && (
        <div className="mt-3 flex items-start gap-2 text-sm text-mute">
          <Clock size={15} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-line">{place.hours}</span>
        </div>
      )}
      {place.price && (
        <div className="mt-3 rounded-2xl bg-sun/10 border border-sun/25 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-sun/80 mb-1">{t({ uk: 'Прайс / Послуги', ru: 'Прайс / Услуги' })}</div>
          <div className="text-sm font-semibold text-sun whitespace-pre-line">{place.price}</div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <MapsButton place={place} />
        <ContactButtons place={place} />
      </div>
      {place.postUrl && (
        <button
          onClick={() => {
            haptic()
            openLink(place.postUrl!)
          }}
          className="tap w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-panel-2 border border-line py-2.5 text-sm font-semibold"
        >
          <Megaphone size={15} /> {t({ uk: 'Пост у каналі', ru: 'Пост в канале' })}
        </button>
      )}
      {onStore && (
        <button onClick={onStore} className="tap w-full mt-2 flex items-center justify-center gap-2 rounded-2xl bg-panel-2 border border-line py-2.5 text-sm font-semibold">
          <Store size={15} /> {t({ uk: 'Усі картки автора', ru: 'Все карточки автора' })}
        </button>
      )}
      {!place.mine && <ReportButton kind="place" id={place.id} />}
      {place.mine && onEdit && onDelete && (
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
  )
}
