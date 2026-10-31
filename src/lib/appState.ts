import { useEffect, useSyncExternalStore } from 'react'
import { getAppConfig, openApp } from '../server/app'
import { DEFAULT_CONFIG, type AppConfig } from './appConfig'
import { initData } from './telegram'

// Shared client copy of the admin-editable config and of this session's flags. Until the config
// arrives the defaults are used, which render the stock app.
type State = { config: AppConfig; configLoaded: boolean; admin: boolean; blocked: boolean }

let state: State = { config: DEFAULT_CONFIG, configLoaded: false, admin: false, blocked: false }
const SERVER_STATE = state
const subs = new Set<() => void>()
let started = false

const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  subs.forEach((f) => f())
}

function start() {
  if (started) return
  started = true
  getAppConfig()
    .then((config) => set({ config, configLoaded: true }))
    .catch((e) => {
      console.error('Load config error:', e)
      set({ configLoaded: true })
    })
  const data = initData()
  if (data) {
    openApp({ data: { initData: data } })
      .then((r) => set({ admin: r.admin, blocked: r.blocked }))
      .catch((e) => console.error('Open app error:', e))
  }
}

// Lets the admin panel apply a saved config without a reload.
export const setAppConfig = (config: AppConfig) => set({ config })

export function useAppState() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
    () => SERVER_STATE,
  )
  useEffect(start, [])
  return s
}

export const useAppConfig = () => useAppState().config
