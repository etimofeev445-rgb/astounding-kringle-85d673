import type { places } from '../../db/schema.js'
import { normalizePhone } from '../lib/ads'
import {
  PLACE_LIMITS,
  isCategory,
  normalizeInstagram,
  normalizeMapUrl,
  normalizeTg,
  type PlaceInput,
  type PlaceView,
} from '../lib/places'
import { postUrl } from './catalogChannel'
import type { PhotoSlot } from './placePhotos'

// Server-only: catalog card view and input parsing, shared by places.ts and the admin panel.
// Kept out of places.ts so the client stubs of that file never reach the channel code.

type Place = typeof places.$inferSelect

const photoUrl = (p: Place, slot: PhotoSlot) =>
  `/api/places/photo/${p.id}?${slot === 'cover' ? 'slot=cover&' : ''}v=${p.updatedAt.getTime()}`

export function placeView(p: Place, userId: string | null): PlaceView {
  return {
    id: p.id,
    storeKey: p.storeKey,
    category: isCategory(p.category) ? p.category : 'services',
    country: p.country,
    city: p.city,
    title: p.title,
    description: p.description,
    hours: p.hours,
    price: p.price,
    mapUrl: p.mapUrl,
    phone: p.phone,
    instagram: p.instagram,
    tgContact: p.tgContact,
    photoUrl: p.hasPhoto ? photoUrl(p, 'photo') : null,
    coverUrl: p.hasCover ? photoUrl(p, 'cover') : null,
    postUrl: postUrl(p),
    createdAt: p.createdAt.toISOString(),
    mine: p.telegramUserId === userId,
  }
}

const clip = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export function parsePlaceInput(d: Partial<PlaceInput>): PlaceInput | null {
  const category = String(d.category ?? '')
  const title = clip(d.title, PLACE_LIMITS.title)
  const description = clip(d.description, PLACE_LIMITS.description)
  const country = clip(d.country, PLACE_LIMITS.country)
  const city = clip(d.city, PLACE_LIMITS.city)
  const rawPhone = clip(d.phone, 40)
  const rawInsta = clip(d.instagram, 80)
  const rawTg = clip(d.tgContact, 80)
  const rawMap = clip(d.mapUrl, PLACE_LIMITS.mapUrl)
  const phone = normalizePhone(rawPhone)
  const instagram = normalizeInstagram(rawInsta)
  const tgContact = normalizeTg(rawTg)
  const mapUrl = normalizeMapUrl(rawMap)
  if (!title || !description || !country || !city || !isCategory(category)) return null
  if ((rawPhone && !phone) || (rawInsta && !instagram) || (rawTg && !tgContact) || (rawMap && !mapUrl)) return null
  if (!phone && !instagram && !tgContact) return null
  return {
    category,
    country,
    city,
    title,
    description,
    hours: clip(d.hours, PLACE_LIMITS.hours),
    price: clip(d.price, PLACE_LIMITS.price),
    mapUrl,
    phone,
    instagram,
    tgContact,
  }
}

