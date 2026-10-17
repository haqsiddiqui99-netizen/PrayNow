import { useEffect, useState } from 'react'
import { fetchActiveJanaza, type MosqueJanaza } from '@/src/services/api'

const MAX_AGE_MS = 2 * 60 * 1000

let cache: { at: number; list: MosqueJanaza[] } = { at: 0, list: [] }
let inflight: Promise<void> | null = null
const listeners = new Set<(list: MosqueJanaza[]) => void>()

/** Reloads the shared list of upcoming janaza prayers; `force` skips the short cache. */
export function refreshJanaza(force = false): Promise<void> {
  if (!force && Date.now() - cache.at < MAX_AGE_MS) return Promise.resolve()
  if (inflight) return inflight
  inflight = fetchActiveJanaza()
    .then((list) => {
      cache = { at: Date.now(), list }
      listeners.forEach((fn) => fn(list))
    })
    .catch(() => {})
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Upcoming janaza prayers, for one mosque when `mosqueId` is given. */
export function useJanaza(mosqueId?: string): MosqueJanaza[] {
  const [list, setList] = useState(cache.list)
  useEffect(() => {
    listeners.add(setList)
    void refreshJanaza()
    return () => {
      listeners.delete(setList)
    }
  }, [])
  return mosqueId ? list.filter((j) => j.mosqueId === mosqueId) : list
}
