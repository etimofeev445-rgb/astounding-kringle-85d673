// Downscales the picked image to a JPEG data URL small enough for the server limit.
// Older WebViews can't decode some formats via createImageBitmap; fall back to an <img>.
async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  try {
    const b = await createImageBitmap(file)
    return { src: b, w: b.width, h: b.height, done: () => b.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise((ok, fail) => {
      img.onload = ok
      img.onerror = fail
      img.src = url
    })
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  }
}

export async function toJpeg(file: File, maxBytes: number, maxSide = 1280): Promise<string> {
  const img = await decode(file)
  const scale = Math.min(1, maxSide / Math.max(img.w, img.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.w * scale)
  canvas.height = Math.round(img.h * scale)
  canvas.getContext('2d')!.drawImage(img.src, 0, 0, canvas.width, canvas.height)
  img.done()
  for (const q of [0.85, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length * 0.75 < maxBytes) return url
  }
  throw new Error('too big')
}
