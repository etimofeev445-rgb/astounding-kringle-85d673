import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminAction, AdminResult } from '../../server/admin/actions'
import { adminApi, type AdminError } from '../../server/admin/api'
import { initData } from '../../lib/telegram'

// Client side of the admin API. Every call sends the signed initData; the server decides.

const MESSAGES: Record<AdminError, string> = {
  forbidden: 'Доступ заборонено',
  expired: 'Сесія застаріла — закрийте й знову відкрийте застосунок',
  invalid: 'Некоректні дані',
  server: 'Помилка сервера. Спробуйте ще раз',
}

export class AdminCallError extends Error {
  constructor(
    readonly code: AdminError | 'network',
    message: string,
  ) {
    super(message)
  }
}

// AdminApp registers this to swap the whole panel for "access denied" when the server says so.
let onAuthLost: ((code: 'forbidden' | 'expired') => void) | null = null
export const setAuthLostHandler = (f: typeof onAuthLost) => {
  onAuthLost = f
}

export async function adminCall<A extends AdminAction>(action: A, payload: unknown = {}): Promise<AdminResult<A>> {
  let res: Awaited<ReturnType<typeof adminApi>>
  try {
    res = await adminApi({ data: { initData: initData(), action, payload } })
  } catch (e) {
    console.error(`Admin ${action} error:`, e)
    throw new AdminCallError('network', 'Немає зʼєднання з сервером')
  }
  if (!res.ok) {
    if (res.error === 'forbidden' || res.error === 'expired') onAuthLost?.(res.error)
    throw new AdminCallError(res.error, res.message ?? MESSAGES[res.error])
  }
  return res.data as AdminResult<A>
}

// Loads `action` and reloads whenever `key` (a serialisable payload) changes.
export function useAdminQuery<A extends AdminAction>(action: A, payload: unknown = {}) {
  const key = JSON.stringify(payload)
  const [data, setData] = useState<AdminResult<A>>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const load = useCallback(() => {
    const n = ++seq.current
    setLoading(true)
    setError('')
    adminCall(action, JSON.parse(key))
      .then((d) => n === seq.current && setData(d))
      .catch((e: Error) => n === seq.current && setError(e.message))
      .finally(() => n === seq.current && setLoading(false))
  }, [action, key])
  useEffect(load, [load])
  return { data, setData, error, loading, reload: load }
}
