import { getStore } from '@netlify/blobs'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { ads } from '../../db/schema.js'

// Server-only: ad photo storage in Netlify Blobs. Kept out of src/server/ads.ts so the
// client bundle of that file (server function stubs) doesn't pull in Blobs/Node APIs.
const photos = () => getStore({ name: 'ad-photos', consistency: 'strong' })

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

export const savePhoto = (id: string, photo: Uint8Array<ArrayBuffer>) =>
  photos().set(id, photo.buffer, { metadata: { type: 'image/jpeg' } })

export const deletePhoto = (id: string) => photos().delete(id)

export async function storedPhoto(id: string) {
  const buf = await photos().get(id, { type: 'arrayBuffer' })
  return buf ? new Uint8Array(buf) : null
}

export async function adPhoto(id: string) {
  if (!isUuid(id)) return null
  const [ad] = await db.select({ status: ads.status }).from(ads).where(eq(ads.id, id))
  if (ad?.status !== 'active') return null
  return storedPhoto(id)
}
