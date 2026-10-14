import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState, Platform } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import {
  fetchMySubscriptions,
  saveMosqueReminders,
  subscribeMosque,
  unsubscribeMosque,
  type MosqueReminderPrefs,
  type MosqueSubscription,
} from '@/src/services/api'
import {
  syncMosqueReminders,
  type MosqueReminderText,
  type MosqueSyncResult,
} from '@/src/services/mosqueReminders'

const CACHE_KEY = 'praynow.mosqueSubscriptions.v1'

export const DEFAULT_REMINDERS: MosqueReminderPrefs = {
  jamaat: false,
  lead: 10,
  azan: false,
  leave: false,
  travel: 0,
  taraweeh: false,
  prayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
}

/** Any reminder that needs the device to schedule alarms. */
export function hasActiveReminders(prefs: MosqueReminderPrefs) {
  return ((prefs.jamaat || prefs.azan || prefs.leave) && prefs.prayers.length > 0) || Boolean(prefs.taraweeh)
}

type SaveResult = 'ok' | 'need_login' | 'error'

interface MosqueNotifyContextValue {
  subscribedIds: Set<string>
  loading: boolean
  isSubscribed: (mosqueId: string) => boolean
  toggle: (mosqueId: string) => Promise<SaveResult>
  reload: () => Promise<void>
  /** Saved reminder choices for a mosque, or the defaults when none are set. */
  remindersFor: (mosqueId: string) => MosqueReminderPrefs
  /**
   * Apply the reminder sheet: follow / unfollow plus jamaat and azan reminders.
   * `scheduling` reports what the device did with the alarms.
   */
  saveSettings: (
    mosqueId: string,
    follow: boolean,
    prefs: MosqueReminderPrefs,
  ) => Promise<{ result: SaveResult; scheduling?: MosqueSyncResult }>
}

const MosqueNotifyContext = createContext<MosqueNotifyContextValue | null>(null)

function emptySubscription(mosqueId: string): MosqueSubscription {
  return { mosqueId, reminders: { ...DEFAULT_REMINDERS }, mosque: null }
}

export function MosqueNotifyProvider({ children }: { children: ReactNode }) {
  const { user, isReady: authReady } = useAuth()
  const { t, prayerName, placeName, formatClock } = useLanguage()
  const [subs, setSubs] = useState<MosqueSubscription[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const subsRef = useRef(subs)
  subsRef.current = subs

  const text = useMemo<MosqueReminderText>(() => {
    return {
      jamaatTitle: (prayer, lead) =>
        lead > 0 ? t('reminder.jamaatTitle', { prayer, lead }) : t('reminder.jamaatNowTitle', { prayer }),
      jamaatBody: (mosque, at) => t('reminder.jamaatBody', { mosque, time: at }),
      azanTitle: (prayer) => t('reminder.azanTitle', { prayer }),
      azanBody: (mosque, at) => t('reminder.azanBody', { mosque, time: at }),
      leaveTitle: (prayer) => t('reminder.leaveTitle', { prayer }),
      leaveBody: (mosque, at, travel) => t('reminder.leaveBody', { mosque, time: at, travel }),
      taraweehTitle: (lead) => t('reminder.taraweehTitle', { lead }),
      taraweehBody: (mosque, at, night) => t('reminder.taraweehBody', { mosque, time: at, night }),
      prayerName,
      placeName: (name) => placeName(name),
      time: formatClock,
    }
  }, [t, prayerName, placeName, formatClock])

  const store = useCallback((next: MosqueSubscription[]) => {
    setSubs(next)
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {})
  }, [])

  const reload = useCallback(async () => {
    if (!authReady) return
    if (!user) {
      store([])
      setReady(true)
      return
    }
    setLoading(true)
    try {
      store(await fetchMySubscriptions())
    } catch {
      // Offline: keep the last known list so scheduled reminders survive.
      if (!subsRef.current.length) {
        const raw = await AsyncStorage.getItem(CACHE_KEY).catch(() => null)
        try {
          const cached = raw ? (JSON.parse(raw) as MosqueSubscription[]) : []
          if (Array.isArray(cached)) setSubs(cached)
        } catch {}
      }
    } finally {
      setLoading(false)
      setReady(true)
    }
  }, [authReady, user, store])

  useEffect(() => {
    void reload()
  }, [reload])

  // Fresh timings on every return to the app, and when a mosque pushes a timing change.
  useEffect(() => {
    if (!user) return
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload()
    })
    let removePush: (() => void) | null = null
    let removed = false
    if (Platform.OS !== 'web') {
      void import('expo-notifications')
        .then((Notifications) => {
          if (removed) return
          const sub = Notifications.addNotificationReceivedListener((notification) => {
            if (notification.request.content.data?.type === 'timings') void reload()
          })
          removePush = () => sub.remove()
        })
        .catch(() => {})
    }
    return () => {
      removed = true
      appSub.remove()
      removePush?.()
    }
  }, [user, reload])

  useEffect(() => {
    if (!ready) return
    void syncMosqueReminders(subs, text).catch(() => {})
  }, [ready, subs, text])

  const subscribedIds = useMemo(() => new Set(subs.map((s) => String(s.mosqueId))), [subs])

  const isSubscribed = useCallback(
    (mosqueId: string) => subscribedIds.has(String(mosqueId)),
    [subscribedIds],
  )

  const remindersFor = useCallback(
    (mosqueId: string) =>
      subs.find((s) => String(s.mosqueId) === String(mosqueId))?.reminders ?? DEFAULT_REMINDERS,
    [subs],
  )

  const toggle = useCallback(
    async (mosqueId: string) => {
      if (!user) return 'need_login' as const
      const id = String(mosqueId)
      const before = subsRef.current
      const wasOn = before.some((s) => String(s.mosqueId) === id)
      store(wasOn ? before.filter((s) => String(s.mosqueId) !== id) : [...before, emptySubscription(id)])
      try {
        if (wasOn) await unsubscribeMosque(id)
        else await subscribeMosque(id)
        return 'ok' as const
      } catch {
        store(before)
        return 'error' as const
      }
    },
    [user, store],
  )

  const saveSettings = useCallback<MosqueNotifyContextValue['saveSettings']>(
    async (mosqueId, follow, prefs) => {
      if (!user) return { result: 'need_login' }
      const id = String(mosqueId)
      const others = subsRef.current.filter((s) => String(s.mosqueId) !== id)
      const wantsReminders = hasActiveReminders(prefs)
      try {
        if (!follow && !wantsReminders) {
          if (others.length !== subsRef.current.length) await unsubscribeMosque(id)
          store(others)
          return { result: 'ok', scheduling: await syncMosqueReminders(others, text) }
        }
        const saved = await saveMosqueReminders(id, prefs)
        const next = [...others, saved]
        store(next)
        const scheduling = await syncMosqueReminders(next, text, { askPermission: wantsReminders })
        return { result: 'ok', scheduling }
      } catch {
        return { result: 'error' }
      }
    },
    [user, store, text],
  )

  const value = useMemo(
    () => ({ subscribedIds, loading, isSubscribed, toggle, reload, remindersFor, saveSettings }),
    [subscribedIds, loading, isSubscribed, toggle, reload, remindersFor, saveSettings],
  )

  return <MosqueNotifyContext.Provider value={value}>{children}</MosqueNotifyContext.Provider>
}

export function useMosqueNotify() {
  const ctx = useContext(MosqueNotifyContext)
  if (!ctx) throw new Error('useMosqueNotify must be used within MosqueNotifyProvider')
  return ctx
}
