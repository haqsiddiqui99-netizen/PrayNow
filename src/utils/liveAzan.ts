import type { Mosque, PrayerName } from '../types'
import type { AzanStreamStatus, LiveAzanFeed } from '../types/liveAzan'
import { getCurrentPrayerForMosques, getPrayerDisplayName } from './prayerSchedule'

/** Demo azan audio — replace with mosque HLS/WebRTC stream URL in production */
export const DEMO_AZAN_STREAM =
  'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Adhan.ogg/Adhan.ogg.mp3'

const AZAN_LIVE_WINDOW_BEFORE = 1
const AZAN_LIVE_WINDOW_AFTER = 6

function parseTime(time: string): number {
  const [clock, period] = time.split(' ')
  const [hours, minutes] = clock.split(':').map(Number)
  let h = hours
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + minutes
}

function nowMinutes(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function getActivePrayerForAzan(date = new Date()): PrayerName | null {
  const current = getCurrentPrayerForMosques(date)
  return current?.name ?? null
}

export function resolveAzanStatus(
  azanTime: string,
  micEnabled: boolean,
  date = new Date(),
): { status: AzanStreamStatus; minutesUntil: number | null; startedAgo: number | null } {
  if (!micEnabled) return { status: 'offline', minutesUntil: null, startedAgo: null }

  const now = nowMinutes(date)
  const azan = parseTime(azanTime)

  if (now >= azan - AZAN_LIVE_WINDOW_BEFORE && now <= azan + AZAN_LIVE_WINDOW_AFTER) {
    const startedAgo = now >= azan ? now - azan : 0
    return { status: 'live', minutesUntil: null, startedAgo }
  }

  if (now < azan) {
    return { status: 'upcoming', minutesUntil: azan - now, startedAgo: null }
  }

  const untilTomorrow = 24 * 60 - now + azan
  return { status: 'upcoming', minutesUntil: untilTomorrow, startedAgo: null }
}

export function buildLiveFeedFromMosque(
  mosque: Mosque,
  prayerName: PrayerName,
  micEnabled = true,
  streamUrl: string | null = DEMO_AZAN_STREAM,
  date = new Date(),
): LiveAzanFeed {
  const azanTime = mosque.timings[prayerName].azan
  const { status, minutesUntil, startedAgo } = resolveAzanStatus(azanTime, micEnabled, date)

  return {
    mosqueId: mosque.id,
    mosqueName: mosque.name,
    area: mosque.area,
    distance: mosque.distance,
    prayerName,
    prayerDisplay: getPrayerDisplayName(prayerName, date),
    azanTime,
    status,
    micEnabled,
    streamUrl: micEnabled ? (streamUrl || DEMO_AZAN_STREAM) : null,
    listeners: status === 'live' ? Math.floor(12 + mosque.distance * 3) : 0,
    minutesUntilAzan: minutesUntil,
    startedMinutesAgo: startedAgo,
  }
}

export function buildLiveFeedsFromMosques(mosques: Mosque[], date = new Date()): LiveAzanFeed[] {
  const prayer = getActivePrayerForAzan(date)
  if (!prayer) return []

  return mosques
    .map((m) => buildLiveFeedFromMosque(m, prayer))
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, offline: 2 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return (a.minutesUntilAzan ?? 999) - (b.minutesUntilAzan ?? 999)
    })
}

export function formatAzanCountdown(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes <= 0) return 'starting now'
  if (minutes < 60) return `in ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`
}
