import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/src/context/AuthContext'
import {
  fetchMySubscriptions,
  subscribeMosque,
  unsubscribeMosque,
} from '@/src/services/api'

interface MosqueNotifyContextValue {
  subscribedIds: Set<string>
  loading: boolean
  isSubscribed: (mosqueId: string) => boolean
  toggle: (mosqueId: string) => Promise<'ok' | 'need_login' | 'error'>
  reload: () => Promise<void>
}

const MosqueNotifyContext = createContext<MosqueNotifyContextValue | null>(null)

export function MosqueNotifyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!user) {
      setIds([])
      return
    }
    setLoading(true)
    try {
      setIds(await fetchMySubscriptions())
    } catch {
      setIds([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const subscribedIds = useMemo(() => new Set(ids.map(String)), [ids])

  const isSubscribed = useCallback(
    (mosqueId: string) => subscribedIds.has(String(mosqueId)),
    [subscribedIds],
  )

  const toggle = useCallback(
    async (mosqueId: string) => {
      if (!user) return 'need_login' as const
      const id = String(mosqueId)
      const wasOn = subscribedIds.has(id)
      setIds((prev) => (wasOn ? prev.filter((x) => String(x) !== id) : [...prev, id]))
      try {
        if (wasOn) await unsubscribeMosque(id)
        else await subscribeMosque(id)
        return 'ok' as const
      } catch {
        setIds((prev) => (wasOn ? [...prev, id] : prev.filter((x) => String(x) !== id)))
        return 'error' as const
      }
    },
    [user, subscribedIds],
  )

  const value = useMemo(
    () => ({ subscribedIds, loading, isSubscribed, toggle, reload }),
    [subscribedIds, loading, isSubscribed, toggle, reload],
  )

  return <MosqueNotifyContext.Provider value={value}>{children}</MosqueNotifyContext.Provider>
}

export function useMosqueNotify() {
  const ctx = useContext(MosqueNotifyContext)
  if (!ctx) throw new Error('useMosqueNotify must be used within MosqueNotifyProvider')
  return ctx
}
