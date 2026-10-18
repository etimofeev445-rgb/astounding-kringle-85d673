import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { CARDS } from '../../data/links'
import { useI18n } from '../../lib/i18n'
import { haptic, openLink } from '../../lib/telegram'
import { CartToggle, ScreenTitle } from '../ui'

type CardId = (typeof CARDS)[number]['id']

// Visual style of each card face: background + brand logo.
const FACES: Record<CardId, { bg: string; text: string; logo: ReactNode }> = {
  kraken: {
    bg: 'bg-[linear-gradient(135deg,#5b1fe0,#7132f5_55%,#9b6bff)]',
    text: 'text-white',
    logo: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#fff" />
          <path
            d="M16 8c-4.4 0-8 3.6-8 8v6.2a1.8 1.8 0 0 0 3.6 0V17a1.2 1.2 0 0 1 2.4 0v5.2a1.8 1.8 0 0 0 3.6 0V17a1.2 1.2 0 0 1 2.4 0v5.2a1.8 1.8 0 0 0 3.6 0V16c0-4.4-3.2-8-7.6-8z"
            fill="#7132f5"
          />
        </svg>
        <span className="font-display text-xl font-bold tracking-tight">kraken</span>
      </div>
    ),
  },
  simple: {
    bg: 'bg-[linear-gradient(135deg,#0f0f10,#26262b_60%,#3a3a42)]',
    text: 'text-white',
    logo: (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-[#c6ff3d] text-[#0f0f10] grid place-items-center font-display font-black text-lg">
          S
        </div>
        <span className="font-display text-xl font-bold tracking-tight">Simple</span>
      </div>
    ),
  },
  kolo: {
    bg: 'bg-[linear-gradient(135deg,#00a86b,#14c98a_55%,#6ff0c0)]',
    text: 'text-[#06281c]',
    logo: (
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#06281c" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="#6ff0c0" strokeWidth="4" />
        </svg>
        <span className="font-display text-xl font-black tracking-widest">KOLO</span>
      </div>
    ),
  },
}

export default function CardsScreen() {
  const { t } = useI18n()
  const cta = t({ uk: 'Відкрити карту', ru: 'Открыть карту' })
  const open = (url: string) => {
    haptic('medium')
    openLink(url)
  }

  return (
    <div>
      <ScreenTitle
        title={t({ uk: 'Відкрити карту', ru: 'Открыть карту' })}
        subtitle={t({
          uk: 'Оберіть карту та оформіть її за посиланням',
          ru: 'Выберите карту и оформите её по ссылке'
        })}
      />
      <div className="space-y-6">
        {CARDS.map((c, i) => {
          const face = FACES[c.id]
          return (
            <div key={c.id} className="rise" style={{ animationDelay: `${80 * i}ms` }}>
              <button
                onClick={() => open(c.url)}
                aria-label={`${cta}: ${c.name}`}
                className={`tap relative w-full aspect-[1.586] rounded-3xl p-5 text-left overflow-hidden shadow-[0_24px_40px_-24px_rgba(0,0,0,0.8)] ${face.bg} ${face.text}`}
              >
                <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
                <div className="absolute -right-4 bottom-[-4.5rem] h-40 w-40 rounded-full bg-white/10" />
                <div className="relative h-full flex flex-col justify-between">
                  {face.logo}
                  <div className="h-8 w-11 rounded-md bg-[linear-gradient(135deg,#f5d77a,#c9a227)] border border-black/10" />
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-sm tracking-[0.2em] opacity-80">•••• •••• •••• ••••</span>
                    <span className="font-display text-lg font-black italic">VISA</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2 mt-2 px-1">
                <p className="flex-1 text-xs text-mute">{t(c.hint)}</p>
                <CartToggle item={{ kind: 'card', ref: c.id, title: c.name, subtitle: t(c.hint), url: c.url }} />
              </div>
              <button
                onClick={() => open(c.url)}
                className="tap glow-btn mt-2 w-full flex items-center justify-center gap-2 rounded-2xl text-white font-display font-bold py-3.5 shadow-[0_12px_30px_-12px_rgba(255,92,168,0.7)]"
              >
                <span className="relative">{cta}</span>
                <ExternalLink size={18} className="relative" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
