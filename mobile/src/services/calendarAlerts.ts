import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Translate } from '@/src/context/LanguageContext'
import { ISLAMIC_EVENTS, eventKeys, upcomingEvents, type DatedEvent } from '@/src/utils/hijriCalendar'
import { syncOneShotAlerts, type AlertSyncResult } from '@/src/services/localAlerts'

const KEY = 'praynow.calendarAlerts.v1'
const EVENING_KEY = 'praynow.calendarAlerts.evening.v1'
/** Used until the city's Maghrib time is known. */
const DEFAULT_EVENING = 19 * 60 + 30
/** Minutes after Maghrib starts, so the alert does not compete with the prayer itself. */
const AFTER_MAGHRIB = 20
/** Events observed through the night that follows the evening alert. */
const NIGHT_EVENTS = new Set(['7-27', '8-15', '9-21', '9-23', '9-25', '9-27', '9-29'])

export const eventAlertKey = (event: { month: number; day: number }) => `${event.month}-${event.day}`

export async function loadCalendarAlerts(): Promise<string[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]')
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []
  } catch {
    return []
  }
}

export async function saveCalendarAlerts(keys: string[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(keys)).catch(() => {})
}

/** Minutes from midnight for "6:52 PM" or "18:52". */
function minutesOf(clock: string | undefined): number | null {
  const match = String(clock ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + Number(match[2])
}

/** Remember the alert time from today's Maghrib so syncs elsewhere use the same evening. */
export async function rememberMaghrib(maghribStart: string | undefined) {
  const minutes = minutesOf(maghribStart)
  if (minutes === null) return
  await AsyncStorage.setItem(EVENING_KEY, String(minutes + AFTER_MAGHRIB)).catch(() => {})
}

async function loadEvening(): Promise<number> {
  const raw = Number(await AsyncStorage.getItem(EVENING_KEY).catch(() => null))
  return Number.isFinite(raw) && raw > 12 * 60 && raw < 23 * 60 ? raw : DEFAULT_EVENING
}

export function calendarAlertText(t: Translate) {
  return (event: DatedEvent) => {
    const keys = eventKeys(event.month, event.day)
    const name = keys ? t(keys.name) : event.name
    const note = keys ? t(keys.note) : event.note
    const night = NIGHT_EVENTS.has(eventAlertKey(event))
    return { title: t(night ? 'calAlert.tonight' : 'calAlert.tomorrow', { name }), body: note }
  }
}

/** One alarm the evening before each chosen event, since the Islamic day begins at sunset. */
export async function syncCalendarAlerts(
  keys: string[],
  text: (event: DatedEvent) => { title: string; body: string },
  { askPermission = false } = {},
): Promise<AlertSyncResult> {
  const evening = await loadEvening()
  const now = new Date()
  const alerts = upcomingEvents(now, ISLAMIC_EVENTS.length * 2)
    .filter((event) => keys.includes(eventAlertKey(event)))
    .map((event) => {
      const at = new Date(event.date)
      at.setDate(at.getDate() - 1)
      at.setHours(Math.floor(evening / 60), evening % 60, 0, 0)
      return { id: `${event.year}-${eventAlertKey(event)}`, at, ...text(event) }
    })
  return syncOneShotAlerts('calendar', alerts, { askPermission, limit: 6 })
}
