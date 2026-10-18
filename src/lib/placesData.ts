import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { listPlaces } from '../server/places'
import type { PlaceView } from './places'
import { initData } from './telegram'

// Module-level cache of map places, shared by the map and storefront screens so a
// freshly saved or deleted place shows up everywhere without a refetch.
type State = { places: PlaceView[] | null; error: boolean }
let state: State = { places: null, error: false }
let inflight: Promise<void> | null = null
const subs = new Set<() => void>()

const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  subs.forEach((f) => f())
}

function refresh() {
  inflight ??= listPlaces({ data: { initData: initData() } })
    .then((r) => {
      set({ places: r.places, error: false })
    })
    .catch((e) => {
      console.error('Load places error:', e)
      set({ error: state.places == null })
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function upsertPlace(p: PlaceView) {
  set({ places: [p, ...(state.places ?? []).filter((x) => x.id !== p.id)] })
}

export function removePlace(id: string) {
  set({ places: state.places?.filter((x) => x.id !== id) ?? null })
}

const SERVER: State = { places: null, error: false }

export function usePlaces() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
    () => SERVER,
  )
  useEffect(() => {
    refresh()
  }, [])
  const reload = useCallback(() => {
    set({ error: false })
    refresh()
  }, [])
  return { ...s, reload }
}
