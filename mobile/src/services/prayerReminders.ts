import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const STORAGE_KEY = 'praynow.prayerReminders.v1'
/** Android channels are immutable once created, so lock-screen visibility needs a new id. */
const CHANNEL_ID = 'prayer-alerts'
const LEGACY_CHANNEL_ID = 'prayer-reminders'

export type ReminderItem = {
  /** Stable id, e.g. `fajr` or `extra:ishraq`. */
  key: string
  name: string
  /** Minutes from midnight; values past 1440 roll over to the next day. */
  start: number
  end: number
  kind: 'prayer' | 'optional' | 'avoid' | 'sehri' | 'iftar'
}

type Stored = Record<string, string | null>

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported'

async function readStore(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {}
  } catch {
    return {}
  }
}

async function writeStore(store: Stored) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store)).catch(() => {})
}

const SEHRI_LEAD_KEY = 'praynow.sehriLead.v1'
export const DEFAULT_SEHRI_LEAD = 30

/** Minutes before sehri ends that the sehri alert rings. */
export async function loadSehriLead(): Promise<number> {
  const raw = Number(await AsyncStorage.getItem(SEHRI_LEAD_KEY).catch(() => null))
  return Number.isFinite(raw) && raw >= 1 && raw <= 180 ? Math.round(raw) : DEFAULT_SEHRI_LEAD
}

export async function saveSehriLead(minutes: number) {
  await AsyncStorage.setItem(SEHRI_LEAD_KEY, String(minutes)).catch(() => {})
}

export async function loadReminderKeys(): Promise<string[]> {
  return Object.keys(await readStore())
}

async function notifications() {
  if (Platform.OS === 'web') return null
  try {
    const Notifications = await import('expo-notifications')
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Prayer reminders',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
      })
      await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID).catch(() => {})
    }
    return Notifications
  } catch {
    return null
  }
}

function clock(min: number) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export type ReminderMessage = (item: ReminderItem) => { title: string; body: string }

function englishMessage(item: ReminderItem) {
  if (item.kind === 'sehri') {
    return { title: `Sehri ends at ${clock(item.end)}`, body: `${Math.round(item.end - item.start)} minutes left for sehri.` }
  }
  if (item.kind === 'iftar') {
    return { title: 'Iftar time', body: `Time to break your fast · ${clock(item.start)}` }
  }
  if (item.kind === 'avoid') {
    return {
      title: `${item.name} has started`,
      body: `Avoid prayer until ${clock(item.end)}.`,
    }
  }
  if (item.kind === 'optional') {
    return {
      title: `${item.name} time`,
      body: `${item.name} is open now, until ${clock(item.end)}.`,
    }
  }
  return { title: `${item.name} time`, body: `It's time for ${item.name} · ${clock(item.start)}` }
}

async function schedule(
  Notifications: NonNullable<Awaited<ReturnType<typeof notifications>>>,
  item: ReminderItem,
  message: ReminderMessage,
): Promise<string> {
  const m = ((Math.round(item.start) % 1440) + 1440) % 1440
  return Notifications.scheduleNotificationAsync({
    content: {
      ...message(item),
      sound: 'default',
      interruptionLevel: 'timeSensitive',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'prayer_reminder', key: item.key },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(m / 60),
      minute: m % 60,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  })
}

/** Turn one reminder on or off. The choice is saved even where notifications can't be scheduled. */
export async function setReminder(
  item: ReminderItem,
  on: boolean,
  message: ReminderMessage = englishMessage,
): Promise<ReminderResult> {
  const store = await readStore()
  const Notifications = await notifications()
  const previous = store[item.key]
  if (Notifications && previous) await Notifications.cancelScheduledNotificationAsync(previous).catch(() => {})

  if (!on) {
    delete store[item.key]
    await writeStore(store)
    return 'off'
  }
  if (!Notifications) {
    store[item.key] = null
    await writeStore(store)
    return 'unsupported'
  }
  try {
    const current = await Notifications.getPermissionsAsync()
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted
    if (!granted) return 'denied'
    store[item.key] = await schedule(Notifications, item, message)
    await writeStore(store)
    return 'scheduled'
  } catch {
    store[item.key] = null
    await writeStore(store)
    return 'unsupported'
  }
}

/**
 * Prayer times drift a minute or two every few days, so re-schedule saved reminders
 * with today's times whenever the home screen loads.
 */
export async function syncReminders(items: ReminderItem[], message: ReminderMessage = englishMessage) {
  const store = await readStore()
  const keys = Object.keys(store)
  if (!keys.length) return
  const Notifications = await notifications()
  if (!Notifications) return
  const perm = await Notifications.getPermissionsAsync().catch(() => null)
  if (!perm?.granted) return
  for (const key of keys) {
    const item = items.find((entry) => entry.key === key)
    const previous = store[key]
    if (previous) await Notifications.cancelScheduledNotificationAsync(previous).catch(() => {})
    // Seasonal items (Sehri / Iftar) drop out after Ramadan: keep the choice, stop the alarm.
    store[key] = item ? await schedule(Notifications, item, message).catch(() => null) : null
  }
  await writeStore(store)
}
