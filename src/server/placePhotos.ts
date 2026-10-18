import { getStore } from '@netlify/blobs'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { places } from '../../db/schema.js'

// Server-only: place photo/cover storage in Netlify Blobs (same split as adPhotos.ts).
const photos = () => getStore({ name: 'place-photos', consistency: 'strong' })

export type PhotoSlot = 'photo' | 'cover'

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s)

export const savePlacePhoto = (id: string, slot: PhotoSlot, photo: Uint8Array<ArrayBuffer>) =>
  photos().set(`${id}/${slot}`, photo.buffer, { metadata: { type: 'image/jpeg' } })

export const deletePlacePhoto = (id: string, slot: PhotoSlot) => photos().delete(`${id}/${slot}`)

export async function placePhoto(id: string, slot: PhotoSlot) {
  if (!isUuid(id)) return null
  const [place] = await db.select({ status: places.status }).from(places).where(eq(places.id, id))
  if (place?.status !== 'active') return null
  const buf = await photos().get(`${id}/${slot}`, { type: 'arrayBuffer' })
  return buf ? new Uint8Array(buf) : null
}

// Raw read without the status check, used when (re)publishing a card to the channel.
export async function storedPlacePhoto(id: string, slot: PhotoSlot) {
  const buf = await photos().get(`${id}/${slot}`, { type: 'arrayBuffer' })
  return buf ? new Uint8Array(buf) : null
}
