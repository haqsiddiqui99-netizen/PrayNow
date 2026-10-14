import { Platform } from 'react-native'
import type { MosqueSubscription } from '@/src/services/api'
import type { PrayerName } from '@/src/types'
import { ramadanDayOf } from '@/src/utils/hijriCalendar'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const CHANNEL_ID = 'mosque-reminders'
const REMINDER_TYPE = 'mosque_reminder'
/** iOS keeps at most 64 pending notifications; leave room for daily prayer, calendar and event reminders. */
const IOS_BUDGET = 40
const MAX_DAYS = 7
/** Minutes to find a place and settle before jamaat starts. */
export const LEAVE_BUFFER = 5
/** Minutes before the mosque's Taraweeh start. */
export const TARAWEEH_LEAD = 15

export type MosqueReminderText = {
  jamaatTitle: (prayer: string, lead: number) => string
  jamaatBody: (mosque: string, time: string) => string
  azanTitle: (prayer: string) => string
  azanBody: (mosque: string, time: string) => string
  leaveTitle: (prayer: string) => string
  leaveBody: (mosque: string, time: string, travel: number) => string
  taraweehTitle: (lead: number) => string
  taraweehBody: (mosque: string, time: string, night: number) => string
  prayerName: (name: string) => string
  placeName: (name: string) => string
  time: (clock: string) => string
}

export type MosqueSyncResult = 'scheduled' | 'off' | 'denied' | 'unsupported'

type ReminderKind = 'azan' | 'jamaat' | 'leave' | 'taraweeh'

type ReminderEvent = { kind: ReminderKind; at: number; title: string; body: string; prayer: string }

async function notifications() {
  if (Platform.OS === 'web') return null
  try {
    const Notifications = await import('expo-notifications')
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Jamaat reminders',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 200, 250],
      })
    }
    return Notifications
  } catch {
    return null
  }
}

/** Minutes from midnight for "8:15 PM" / "20:15"; null when the slot is blank. */
function minutesOf(clock: string | undefined): number | null {
  const match = String(clock ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let h = Number(match[1])
  const m = Number(match[2])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + m
}

type Slot = { prayer: PrayerName; label: string; azan: string; jamat: string }

function slotFor(sub: MosqueSubscription, prayer: PrayerName, friday: boolean): Slot | null {
  const timings = sub.mosque?.timings
  if (!timings) return null
  const daily = timings[prayer]
  if (prayer === 'Dhuhr' && friday) {
    const juma = getJumaSessions(sub.mosque?.jumaTimings, daily?.azan || '')[0]
    if (juma && (juma.namaz || juma.azan)) {
      return { prayer, label: 'Juma', azan: juma.azan || daily?.azan || '', jamat: juma.namaz || '' }
    }
  }
  if (!daily) return null
  return { prayer, label: prayer, azan: daily.azan, jamat: daily.jamat }
}

function kindsPerPrayer(sub: MosqueSubscription) {
  const r = sub.reminders
  if (!r.prayers.length) return 0
  return Number(r.jamaat) + Number(r.azan) + Number(r.leave && r.travel > 0)
}

function wantsTaraweeh(sub: MosqueSubscription) {
  return Boolean(sub.reminders.taraweeh && sub.mosque?.taraweeh?.enabled && minutesOf(sub.mosque.taraweeh.startTime) !== null)
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Replace every scheduled mosque reminder with a fresh rolling window built from the
 * latest timings. One-shot alarms are used so Juma and day-to-day timing edits stay exact.
 */
export function syncMosqueReminders(
  subscriptions: MosqueSubscription[],
  text: MosqueReminderText,
  { askPermission = false } = {},
): Promise<MosqueSyncResult> {
  const run = queue.then(() => runSync(subscriptions, text, askPermission))
  queue = run.catch(() => {})
  return run
}

function eventsFor(sub: MosqueSubscription, day: Date, dayIndex: number, text: MosqueReminderText): ReminderEvent[] {
  const r = sub.reminders
  const mosqueName = text.placeName(sub.mosque!.name)
  const events: ReminderEvent[] = []
  const friday = day.getDay() === 5
  if (kindsPerPrayer(sub) > 0) {
    for (const prayer of r.prayers) {
      const slot = slotFor(sub, prayer, friday)
      if (!slot) continue
      const prayerLabel = text.prayerName(slot.label)
      const azanMin = minutesOf(slot.azan)
      const jamatMin = minutesOf(slot.jamat)
      if (r.azan && azanMin !== null) {
        events.push({
          kind: 'azan',
          prayer,
          at: azanMin,
          title: text.azanTitle(prayerLabel),
          body: text.azanBody(mosqueName, text.time(slot.azan)),
        })
      }
      if (r.jamaat && jamatMin !== null) {
        events.push({
          kind: 'jamaat',
          prayer,
          at: jamatMin - r.lead,
          title: text.jamaatTitle(prayerLabel, r.lead),
          body: text.jamaatBody(mosqueName, text.time(slot.jamat)),
        })
      }
      if (r.leave && r.travel > 0 && jamatMin !== null) {
        events.push({
          kind: 'leave',
          prayer,
          at: jamatMin - r.travel - LEAVE_BUFFER,
          title: text.leaveTitle(prayerLabel),
          body: text.leaveBody(mosqueName, text.time(slot.jamat), r.travel),
        })
      }
    }
  }

  // Taraweeh is prayed on the eve of each Ramadan day, so the evening counts when tomorrow is in Ramadan.
  const tomorrow = new Date(day)
  tomorrow.setDate(day.getDate() + 1)
  const taraweeh = sub.mosque?.taraweeh
  if (taraweeh && wantsTaraweeh(sub) && ramadanDayOf(tomorrow) > 0) {
    const night = taraweeh.night + dayIndex
    const start = minutesOf(taraweeh.startTime)
    if (start !== null && night <= taraweeh.nights) {
      events.push({
        kind: 'taraweeh',
        prayer: 'Taraweeh',
        at: start - TARAWEEH_LEAD,
        title: text.taraweehTitle(TARAWEEH_LEAD),
        body: text.taraweehBody(mosqueName, text.time(taraweeh.startTime), night),
      })
    }
  }
  return events
}

async function runSync(
  subscriptions: MosqueSubscription[],
  text: MosqueReminderText,
  askPermission: boolean,
): Promise<MosqueSyncResult> {
  const Notifications = await notifications()
  if (!Notifications) return 'unsupported'

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => [])
  for (const item of scheduled) {
    if (item.content.data?.type === REMINDER_TYPE) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {})
    }
  }

  const active = subscriptions.filter((sub) => sub.mosque && (kindsPerPrayer(sub) > 0 || wantsTaraweeh(sub)))
  if (!active.length) return 'off'

  const current = await Notifications.getPermissionsAsync().catch(() => null)
  let granted = Boolean(current?.granted)
  if (!granted && askPermission) {
    granted = Boolean((await Notifications.requestPermissionsAsync().catch(() => null))?.granted)
  }
  if (!granted) return 'denied'

  const perDay = active.reduce(
    (sum, sub) => sum + sub.reminders.prayers.length * kindsPerPrayer(sub) + Number(wantsTaraweeh(sub)),
    0,
  )
  const days =
    Platform.OS === 'ios' ? Math.max(1, Math.min(MAX_DAYS, Math.floor(IOS_BUDGET / Math.max(1, perDay)))) : MAX_DAYS
  const now = Date.now()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 0; d < days; d++) {
    const day = new Date(today)
    day.setDate(today.getDate() + d)
    for (const sub of active) {
      for (const event of eventsFor(sub, day, d, text)) {
        const when = new Date(day)
        when.setMinutes(event.at)
        if (when.getTime() <= now + 30_000) continue
        await Notifications.scheduleNotificationAsync({
          content: {
            title: event.title,
            body: event.body,
            sound: 'default',
            interruptionLevel: 'timeSensitive',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { type: REMINDER_TYPE, mosqueId: sub.mosqueId, prayer: event.prayer, kind: event.kind },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
          },
        }).catch(() => null)
      }
    }
  }
  return 'scheduled'
}
