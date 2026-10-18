import { Clock, ExternalLink, RefreshCw, Send, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n, type Lang, type Tr } from '../../lib/i18n'
import { timeAgo, useNews, type NewsCategory, type NewsItem } from '../../lib/news'
import { haptic, tg } from '../../lib/telegram'
import { Card } from '../ui'

type Filter = 'all' | NewsCategory

const FILTERS: { id: Filter; label: Tr }[] = [
  { id: 'all', label: { uk: 'Всі', ru: 'Все' } },
  { id: 'finance', label: { uk: '📈 Фінанси', ru: '📈 Финансы' } },
  { id: 'tech', label: { uk: '💻 Технології', ru: '💻 Технологии' } },
  { id: 'world', label: { uk: '🌍 Світ', ru: '🌍 Мир' } },
  { id: 'telegram', label: { uk: '🇺🇦 Telegram', ru: '🇺🇦 Telegram' } },
]

const PAGE = 20
const PULL_TRIGGER = 64
const TG_BLUE = '#229ed9'

// Telegram posts open natively inside Telegram; everything else in the in-app browser.
function openNews(n: NewsItem) {
  haptic('medium')
  const app = window.Telegram?.WebApp
  if (n.isTelegram && app?.openTelegramLink) app.openTelegramLink(n.link)
  else if (app?.openLink) app.openLink(n.link)
  else window.open(n.link, '_blank', 'noopener')
}

export default function NewsScreen() {
  const { t, lang } = useI18n()
  const { items, error, refreshing, reload } = useNews()
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<NewsItem | null>(null)
  const [pull, setPull] = useState(0)
  const startY = useRef<number | null>(null)
  // Re-render every minute so "15 хвилин тому" stays current.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Pulling down inside Telegram would otherwise minimise the Mini App.
  useEffect(() => {
    tg()?.disableVerticalSwipes?.()
    return () => tg()?.enableVerticalSwipes?.()
  }, [])

  const refresh = () => {
    if (refreshing) return
    haptic('medium')
    reload().then(() => setNow(Date.now()))
  }

  const onTouchStart = (e: TouchEvent) => {
    startY.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null
  }
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return
    const d = e.touches[0].clientY - startY.current
    const next = d > 0 ? Math.min(d * 0.45, 96) : 0
    if (next >= PULL_TRIGGER && pull < PULL_TRIGGER) haptic('soft')
    setPull(next)
  }
  const onTouchEnd = () => {
    if (pull >= PULL_TRIGGER) refresh()
    startY.current = null
    setPull(0)
  }

  const list = (items ?? []).filter((n) => filter === 'all' || n.category === filter)
  const indicator = refreshing && items ? 52 : pull

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <div className="mb-4 rise flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t({ uk: 'Новини', ru: 'Новости' })}</h1>
          <p className="text-sm text-mute mt-1">
            {t({ uk: 'Фінанси, технології та Telegram-канали', ru: 'Финансы, технологии и Telegram-каналы' })}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          aria-label={t({ uk: 'Оновити', ru: 'Обновить' })}
          className="tap h-10 w-10 shrink-0 rounded-2xl bg-panel border border-line grid place-items-center text-mute disabled:opacity-60"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin text-sky' : ''} />
        </button>
      </div>

      <div
        className="overflow-hidden grid place-items-center"
        style={{ height: indicator, transition: startY.current === null ? 'height 0.25s ease' : 'none' }}
        aria-hidden
      >
        <RefreshCw
          size={20}
          className={`${refreshing ? 'animate-spin text-sky' : pull >= PULL_TRIGGER ? 'text-sun' : 'text-mute'}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(pull / PULL_TRIGGER, 1) }}
        />
      </div>

      <div className="no-scrollbar -mx-4 px-4 mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                haptic()
                setFilter(f.id)
                setLimit(PAGE)
              }}
              className={`tap shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors duration-200 ${
                active ? 'bg-sky border-sky text-white shadow-[0_8px_20px_-10px_rgba(47,140,255,0.9)]' : 'bg-panel border-line text-mute'
              }`}
            >
              {t(f.label)}
            </button>
          )
        })}
      </div>

      {!items && !error && <Skeletons />}

      {error && !items && (
        <Card className="rise text-center py-8">
          <WifiOff size={28} className="mx-auto text-mute" />
          <div className="font-display font-bold mt-3">{t({ uk: 'Не вдалося завантажити', ru: 'Не удалось загрузить' })}</div>
          <p className="text-sm text-mute mt-1">{t({ uk: 'Перевірте зʼєднання та спробуйте ще раз', ru: 'Проверьте соединение и попробуйте ещё раз' })}</p>
          <button onClick={refresh} className="tap mt-4 px-5 py-2.5 rounded-2xl bg-sky text-white font-semibold">
            {t({ uk: 'Повторити', ru: 'Повторить' })}
          </button>
        </Card>
      )}

      {error && items && (
        <div className="rise mb-3 rounded-2xl bg-down/10 border border-down/30 px-4 py-2.5 text-sm flex items-center gap-2">
          <WifiOff size={16} className="text-down shrink-0" />
          <span className="flex-1">{t({ uk: 'Не вдалося оновити стрічку', ru: 'Не удалось обновить ленту' })}</span>
          <button onClick={refresh} className="tap font-semibold text-sky">{t({ uk: 'Повторити', ru: 'Повторить' })}</button>
        </div>
      )}

      {items && (
        <div key={filter} className="space-y-3">
          {list.length === 0 && (
            <Card className="rise text-center text-sm text-mute py-8">
              {t({ uk: 'У цій категорії поки немає новин', ru: 'В этой категории пока нет новостей' })}
            </Card>
          )}
          {list.slice(0, limit).map((n, i) => (
            <NewsCard key={n.id} item={n} lang={lang} now={now} delay={i < 8 ? i * 45 : 0} onOpen={() => {
              haptic()
              setOpen(n)
            }} />
          ))}
          {list.length > limit && (
            <button
              onClick={() => {
                haptic()
                setLimit((l) => l + PAGE)
              }}
              className="tap w-full py-3 rounded-2xl bg-panel border border-line font-semibold text-sm text-mute"
            >
              {t({ uk: 'Показати ще', ru: 'Показать ещё' })}
            </button>
          )}
        </div>
      )}

      {open && <Reader item={open} lang={lang} now={now} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Cover({ src, className = '' }: { src: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return null
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`w-full object-cover bg-panel-2 ${className}`}
    />
  )
}

function SourceRow({ item, lang, now }: { item: NewsItem; lang: Lang; now: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-mute min-w-0">
      <img src={item.sourceIcon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-md bg-panel-2 shrink-0 object-cover" />
      <span className="font-semibold text-white/85 truncate">{item.sourceName}</span>
      {item.isTelegram && <Send size={12} className="shrink-0" style={{ color: TG_BLUE }} aria-label="Telegram" />}
      <span className="shrink-0">·</span>
      <span className="shrink-0 whitespace-nowrap">{timeAgo(item.pubDate, lang, now)}</span>
    </div>
  )
}

function NewsCard({ item, lang, now, delay, onOpen }: { item: NewsItem; lang: Lang; now: number; delay: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="tap rise block w-full text-left rounded-3xl bg-panel/90 border border-line overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Cover src={item.imageUrl} className="aspect-[16/9]" />
      <div className="p-4">
        <SourceRow item={item} lang={lang} now={now} />
        <h3 className="font-bold text-[15px] leading-snug mt-2 line-clamp-3">{item.title}</h3>
        {item.description && <p className="text-sm text-mute leading-snug mt-1.5 line-clamp-2">{item.description}</p>}
      </div>
    </button>
  )
}

function Skeletons() {
  return (
    <div className="space-y-3" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl bg-panel/90 border border-line overflow-hidden">
          {i % 2 === 0 && <div className="skeleton aspect-[16/9] rounded-none" />}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="skeleton h-5 w-5 rounded-md" />
              <div className="skeleton h-3 w-32" />
            </div>
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Reader({ item, lang, now, onClose }: { item: NewsItem; lang: Lang; now: number; onClose: () => void }) {
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

  // Swipe down closes the sheet, but only once its content is scrolled to the top.
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

  const paragraphs = (item.content || item.description).split(/\n{2,}/).filter(Boolean)

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal aria-label={item.title}>
      <div onClick={close} className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${closing ? 'fade-out' : 'fade-in'}`} />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-md max-h-[92vh] flex flex-col rounded-t-[28px] bg-panel border border-line border-b-0 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] ${
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
            className="tap absolute right-3 top-2.5 h-9 w-9 rounded-xl bg-panel-2 grid place-items-center text-mute"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={scroller} className="overflow-y-auto overscroll-contain px-5 pb-4 pt-3">
          <SourceRow item={item} lang={lang} now={now} />
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight mt-3">{item.title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-mute mt-2">
            <Clock size={12} />
            {new Date(item.pubDate).toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-UA', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </div>
          <Cover src={item.imageUrl} className="mt-4 rounded-2xl max-h-72" />
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/90">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line break-words">{p}</p>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] border-t border-line bg-panel">
          <button
            onClick={() => openNews(item)}
            className="tap w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 text-white"
            style={{ background: item.isTelegram ? TG_BLUE : 'var(--color-sky)' }}
          >
            {item.isTelegram ? <Send size={18} /> : <ExternalLink size={18} />}
            {item.isTelegram ? t({ uk: 'Перейти в канал', ru: 'Перейти в канал' }) : t({ uk: 'Читати в джерелі', ru: 'Читать в источнике' })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
