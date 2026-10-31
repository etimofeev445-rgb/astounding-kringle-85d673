import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toJpeg } from '../../lib/image'
import { showAlert } from '../../lib/telegram'
import { adminCall } from './api'

const readAsDataUrl = (file: File) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fail(r.error)
    r.readAsDataURL(file)
  })

// Uploads to the app-assets store and reports the served URL. PNG/WebP keep their transparency
// (logos); anything large or in another format is converted to a downscaled JPEG.
export function ImageUpload({ value, onChange, label = 'Завантажити' }: { value: string; onChange: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File) => {
    setBusy(true)
    try {
      const keep = (file.type === 'image/png' || file.type === 'image/webp') && file.size <= 1_400_000
      const dataUrl = keep ? await readAsDataUrl(file) : await toJpeg(file, 1_000_000, 1600)
      const { url } = await adminCall('assets.upload', { dataUrl })
      onChange(url)
    } catch (e) {
      showAlert(e instanceof Error ? e.message : 'Не вдалося завантажити зображення')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="h-16 w-24 rounded-xl object-contain bg-adm-ink border border-adm-line" />
          <button type="button" onClick={() => onChange('')} aria-label="Прибрати" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-down text-white grid place-items-center">
            <X size={13} />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="tap flex items-center gap-2 rounded-xl border border-dashed border-adm-line px-3.5 py-2.5 text-sm font-semibold text-mute disabled:opacity-50"
      >
        <ImagePlus size={16} /> {busy ? 'Завантаження…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) pick(f)
        }}
      />
    </div>
  )
}
