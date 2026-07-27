import { useEffect, useState } from 'react'
import {
  getLiveSession,
  isMosqueLive,
  subscribeLiveSessions,
} from '@/src/store/liveAzanSessions'
import type { LiveAzanSession } from '@/src/services/api'

/** True while the given mosque is broadcasting azan live (backed by polling store). */
export function useMosqueLive(mosqueId: string): boolean {
  const [live, setLive] = useState(() => isMosqueLive(mosqueId))
  useEffect(() => {
    const update = () => setLive(isMosqueLive(mosqueId))
    update()
    return subscribeLiveSessions(update)
  }, [mosqueId])
  return live
}

/** The live session for a mosque, or null. */
export function useLiveSession(mosqueId: string): LiveAzanSession | null {
  const [session, setSession] = useState(() => getLiveSession(mosqueId))
  useEffect(() => {
    const update = () => setSession(getLiveSession(mosqueId))
    update()
    return subscribeLiveSessions(update)
  }, [mosqueId])
  return session
}
