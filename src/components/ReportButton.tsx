import { Flag } from 'lucide-react'
import { useState } from 'react'
import { useAppConfig } from '../lib/appState'
import { useI18n, type Tr } from '../lib/i18n'
import { haptic, initData, notify, showAlert } from '../lib/telegram'
import { reportContent } from '../server/app'

const REASONS: Tr[] = [
  { uk: 'Шахрайство', ru: 'Мошенничество' },
  { uk: 'Спам або реклама', ru: 'Спам или реклама' },
  { uk: 'Неправдива інформація', ru: 'Недостоверная информация' },
  { uk: 'Заборонений товар чи послуга', ru: 'Запрещённый товар или услуга' },
  { uk: 'Образливий вміст', ru: 'Оскорбительное содержание' },
]

// "Поскаржитися" on someone else's ad or catalog card. Telegram only (the report is tied to the
// signed user); hidden when the admin switched reports off.
export function ReportButton({ kind, id }: { kind: 'ad' | 'place'; id: string }) {
  const { t } = useI18n()
  const { features } = useAppConfig()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  if (!features.reports || !initData()) return null

  const send = async (reason: Tr) => {
    setBusy(true)
    haptic()
    try {
      const res = await reportContent({ data: { initData: initData(), kind, id, reason: reason.uk } })
      if (res.ok) {
        notify('success')
        setDone(true)
        setOpen(false)
      } else {
        notify('error')
        showAlert(
          t(
            res.reason === 'blocked'
              ? { uk: 'Для вашого акаунта скарги обмежено', ru: 'Для вашего аккаунта жалобы ограничены' }
              : { uk: 'Не вдалося надіслати скаргу. Спробуйте пізніше', ru: 'Не удалось отправить жалобу. Попробуйте позже' },
          ),
        )
      }
    } catch {
      notify('error')
      showAlert(t({ uk: 'Помилка мережі. Спробуйте ще раз', ru: 'Ошибка сети. Попробуйте ещё раз' }))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p className="mt-2 text-xs text-mute">{t({ uk: 'Дякуємо, скаргу надіслано модератору.', ru: 'Спасибо, жалоба отправлена модератору.' })}</p>
  }
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="tap flex items-center gap-1.5 text-xs font-semibold text-mute"
      >
        <Flag size={13} /> {t({ uk: 'Поскаржитися', ru: 'Пожаловаться' })}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r.uk}
              disabled={busy}
              onClick={() => send(r)}
              className="tap rounded-xl border border-line bg-panel-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {t(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
