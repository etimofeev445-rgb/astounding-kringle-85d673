import { createServerFn } from '@tanstack/react-start'

// Nova Poshta public API: tracking and warehouse lookup work without an API key.
const API = 'https://api.novaposhta.ua/v2.0/json/'

async function np<T>(modelName: string, calledMethod: string, methodProperties: object): Promise<T[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey: process.env.NOVA_POSHTA_API_KEY ?? '', modelName, calledMethod, methodProperties }),
  })
  if (!res.ok) throw new Error(`Nova Poshta ${res.status}`)
  const body = (await res.json()) as { success: boolean; data: T[]; errors?: string[] }
  if (!body.success) throw new Error(body.errors?.[0] || 'Nova Poshta error')
  return body.data
}

export interface Parcel {
  number: string
  status: string
  statusCode: string
  citySender: string
  cityRecipient: string
  warehouseRecipient: string
  scheduledDate: string
  deliveredDate: string
  weight: number
  cost: string
}

export const trackParcel = createServerFn({ method: 'POST' })
  .validator((d: { number: string; phone?: string }) => ({
    number: String(d.number).replace(/\D/g, '').slice(0, 20),
    phone: String(d.phone ?? '').replace(/\D/g, '').slice(0, 12),
  }))
  .handler(async ({ data }): Promise<Parcel | null> => {
    if (data.number.length < 10) return null
    const [r] = await np<Record<string, string | number>>('TrackingDocument', 'getStatusDocuments', {
      Documents: [{ DocumentNumber: data.number, Phone: data.phone }],
    })
    if (!r) return null
    return {
      number: String(r.Number ?? data.number),
      status: String(r.Status ?? ''),
      statusCode: String(r.StatusCode ?? ''),
      citySender: String(r.CitySender ?? ''),
      cityRecipient: String(r.CityRecipient ?? ''),
      warehouseRecipient: String(r.WarehouseRecipient ?? ''),
      scheduledDate: String(r.ScheduledDeliveryDate ?? ''),
      deliveredDate: String(r.RecipientDateTime ?? ''),
      weight: Number(r.DocumentWeight) || 0,
      cost: String(r.DocumentCost ?? ''),
    }
  })

export interface Warehouse {
  ref: string
  number: string
  title: string
  address: string
  postomat: boolean
  schedule: string
}

export const findWarehouses = createServerFn({ method: 'POST' })
  .validator((d: { city: string; query?: string }) => ({
    city: String(d.city).trim().slice(0, 60),
    query: String(d.query ?? '').trim().slice(0, 60),
  }))
  .handler(async ({ data }): Promise<Warehouse[]> => {
    if (data.city.length < 2) return []
    const rows = await np<Record<string, any>>('AddressGeneral', 'getWarehouses', {
      CityName: data.city,
      FindByString: data.query,
      Limit: '50',
      Page: '1',
    })
    return rows.map((w) => {
      const s = w.Schedule ?? {}
      return {
        ref: w.Ref,
        number: w.Number,
        title: w.Description,
        address: w.ShortAddress,
        postomat: w.CategoryOfWarehouse === 'Postomat',
        schedule: s.Monday ? `Пн–Пт ${s.Monday}, Сб ${s.Saturday || '—'}, Нд ${s.Sunday || '—'}` : '',
      }
    })
  })
