import { ChevronRight, Send } from 'lucide-react'
import { TG_COUNTRIES } from '../../data/telegram'
import { useI18n } from '../../lib/i18n'
import { haptic, openLink } from '../../lib/telegram'
import { Card, CartToggle, ScreenTitle } from '../ui'

export default function TelegramScreen() {
  const { t } = useI18n()
  return (
    <div>
      <ScreenTitle title="Telegram" subtitle={t({
          uk: 'Групи та канали для українців за кордоном',
          ru: 'Группы и каналы для украинцев за границей'
        })} />
      <div className="space-y-3">
        {TG_COUNTRIES.map((c) => (
          <Card key={c.name.uk} className="rise">
              <div className="font-display font-bold mb-2">
                <span className="mr-2">{c.flag}</span>
                {t(c.name)}
              </div>
              <div className="divide-y divide-line">
                {c.channels.map((ch) => (
                  <div key={ch.handle} className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      haptic()
                      openLink(`https://t.me/${ch.handle}`)
                    }}
                    className="tap flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-[#229ed9]/15 text-[#229ed9] grid place-items-center">
                      <Send size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{ch.title}</div>
                      <div className="text-xs text-mute truncate">@{ch.handle}</div>
                    </div>
                    <ChevronRight size={18} className="text-mute shrink-0" />
                  </button>
                  <CartToggle item={{ kind: 'channel', ref: ch.handle, title: ch.title, subtitle: `@${ch.handle}`, url: `https://t.me/${ch.handle}` }} />
                  </div>
                ))}
              </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
