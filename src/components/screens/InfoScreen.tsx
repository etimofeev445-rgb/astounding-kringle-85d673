import { ChevronLeft, Send } from 'lucide-react'
import { Fragment, useState } from 'react'
import { INFO, SUPPORT_HANDLE, SUPPORT_URL, type InfoBlock, type InfoId } from '../../data/info'
import { useI18n } from '../../lib/i18n'
import type { Go } from '../../lib/nav'
import { haptic, openLink } from '../../lib/telegram'
import { Card, ScreenTitle } from '../ui'

const openSupport = () => {
  haptic('medium')
  openLink(SUPPORT_URL)
}

// Paragraph text with `{support}` replaced by a tappable @UATmarket link.
function Rich({ text }: { text: string }) {
  const parts = text.split('{support}')
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <button onClick={openSupport} className="tap font-semibold text-sky underline-offset-2 hover:underline">
              {SUPPORT_HANDLE}
            </button>
          )}
        </Fragment>
      ))}
    </>
  )
}

function Block({ b }: { b: InfoBlock }) {
  const { t } = useI18n()
  switch (b.kind) {
    case 'date':
      return (
        <div className="inline-block rounded-xl bg-sun/10 border border-sun/30 text-sun text-xs font-semibold px-3 py-1.5">
          {t(b.text)}
        </div>
      )
    case 'h':
      return <h3 className="font-display font-bold text-base pt-3">{t(b.text)}</h3>
    case 'p':
      return (
        <p className="text-[15px] leading-relaxed text-white/85">
          <Rich text={t(b.text)} />
        </p>
      )
    case 'list':
      return (
        <ul className="space-y-1.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-white/85">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-sun" />
              <span>{t(it)}</span>
            </li>
          ))}
        </ul>
      )
  }
}

export default function InfoScreen({ go }: { go: Go }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<InfoId>('about')
  const section = INFO.find((s) => s.id === tab)!

  return (
    <div>
      <button
        onClick={() => go('home')}
        className="tap -ml-1 mb-2 flex items-center gap-1 text-sm font-semibold text-mute"
      >
        <ChevronLeft size={18} />
        {t({ uk: 'Назад', ru: 'Назад' })}
      </button>

      <ScreenTitle
        title={t({ uk: 'Інформація', ru: 'Информация' })}
        subtitle={t({ uk: 'Про застосунок, підтримка та правила', ru: 'О приложении, поддержка и правила' })}
      />

      <div className="grid grid-cols-2 gap-2 mb-4" role="tablist">
        {INFO.map((s) => {
          const active = s.id === tab
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                haptic()
                setTab(s.id)
              }}
              className={`tap flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold leading-tight ${
                active ? 'bg-sky border-sky text-white' : 'bg-panel border-line text-mute'
              }`}
            >
              <span className="text-lg">{s.emoji}</span>
              <span className="min-w-0">{t(s.title)}</span>
            </button>
          )
        })}
      </div>

      <Card key={tab} className="rise space-y-3 p-5">
        <h2 className="font-display text-xl font-bold tracking-tight">{t(section.title)}</h2>
        {section.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
      </Card>

      <button
        onClick={openSupport}
        className="tap w-full mt-4 rounded-3xl p-4 flex items-center gap-4 bg-[#229ed9] text-white text-left"
      >
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/15 grid place-items-center">
          <Send size={20} />
        </div>
        <div className="flex-1">
          <div className="font-display font-bold">{t({ uk: 'Написати в підтримку', ru: 'Написать в поддержку' })}</div>
          <div className="text-xs font-semibold opacity-80 mt-0.5">{SUPPORT_HANDLE}</div>
        </div>
      </button>
    </div>
  )
}
