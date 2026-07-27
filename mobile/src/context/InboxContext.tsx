import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/src/services/api'
import { registerForPushNotificationsAsync } from '@/src/services/pushNotifications'

interface InboxContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  reload: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMyNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      /* keep previous */
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
    if (user) void registerForPushNotificationsAsync()
  }, [user, reload])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) void reload()
    })
    return () => sub.remove()
  }, [user, reload])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await markNotificationRead(id)
    } catch {
      void reload()
    }
  }, [reload])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch {
      void reload()
    }
  }, [reload])

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, reload, markRead, markAllRead }),
    [notifications, unreadCount, loading, reload, markRead, markAllRead],
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used within InboxProvider')
  return ctx
}
