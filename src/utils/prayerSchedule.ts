import type { PrayerName } from '../types'
import { getCityPrayerConfig, type CityPrayerConfig } from '../config/cityPrayerConfig'
import {
  DEFAULT_NIGHT_TIMINGS,
} from '../data/mockData'

export interface FajrTimings {
  sunrise: string
  namazEnd: string
  tuluAftab: { start: string; end: string; label: string }
  inTuluAftab: boolean
}

export interface ZawalTimings {
  start: string
  end: string
  label: string
  inZawal: boolean
}

export function formatCompactTime(time: string): string {
  return time.replace(/\s+/g, '')
}

export interface LivePrayerInfo {
  current: {
    name: PrayerName
    displayName: string
    start: string
    end: string
  } | null
  next: {
    name: PrayerName
    displayName: string
    start: string
    minutesUntil: number
    countdown: string
  }
  nightTimings: typeof DEFAULT_NIGHT_TIMINGS
  fajrTimings: FajrTimings
  zawalTimings: ZawalTimings
}

export function isFriday(date = new Date()): boolean {
  return date.getDay() === 5
}

export function getPrayerDisplayName(name: PrayerName, date = new Date()): string {
  if (name === 'Dhuhr' && isFriday(date)) return 'Juma'
  return name
}

export type RakatType = 'Sunnat' | 'Farz' | 'Nafil' | 'Witr'

export interface PrayerRakatSegment {
  count: number
  type: RakatType
}

const PRAYER_RAKATS: Record<PrayerName, PrayerRakatSegment[]> = {
  Fajr: [
    { count: 2, type: 'Sunnat' },
    { count: 2, type: 'Farz' },
  ],
  Dhuhr: [
    { count: 4, type: 'Sunnat' },
    { count: 4, type: 'Farz' },
    { count: 2, type: 'Sunnat' },
    { count: 2, type: 'Nafil' },
  ],
  Asr: [
    { count: 4, type: 'Sunnat' },
    { count: 4, type: 'Farz' },
  ],
  Maghrib: [
    { count: 3, type: 'Farz' },
    { count: 2, type: 'Sunnat' },
    { count: 2, type: 'Nafil' },
  ],
  Isha: [
    { count: 4, type: 'Sunnat' },
    { count: 4, type: 'Farz' },
    { count: 2, type: 'Sunnat' },
    { count: 3, type: 'Witr' },
    { count: 2, type: 'Nafil' },
  ],
}

const JUMA_RAKATS: PrayerRakatSegment[] = [
  { count: 4, type: 'Sunnat' },
  { count: 2, type: 'Farz' },
  { count: 4, type: 'Sunnat' },
  { count: 2, type: 'Nafil' },
]

export function getPrayerRakats(name: PrayerName, date = new Date()): PrayerRakatSegment[] {
  if (name === 'Dhuhr' && isFriday(date)) return JUMA_RAKATS
  return PRAYER_RAKATS[name]
}

export function formatPrayerRakats(segments: PrayerRakatSegment[]): string {
  return segments.map(({ count, type }) => `${count} ${type}`).join(', ')
}

export function parseTime(time: string): number {
  const [clock, period] = time.split(' ')
  const [hours, minutes] = clock.split(':').map(Number)
  let h = hours
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + minutes
}

function isInWindow(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin
  return nowMin >= startMin || nowMin < endMin
}

function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'starting now'
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hrs > 0) return `in ${hrs} hour${hrs > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`
  return `in ${mins} min${mins !== 1 ? 's' : ''}`
}

function minutesUntil(fromMin: number, targetMin: number): number {
  if (targetMin > fromMin) return targetMin - fromMin
  return 24 * 60 - fromMin + targetMin
}

function getFajrTimings(nowMin: number, config: CityPrayerConfig = getCityPrayerConfig()): FajrTimings {
  const tuluStart = parseTime(config.tuluAftab.start)
  const tuluEnd = parseTime(config.tuluAftab.end)
  return {
    sunrise: config.sunrise,
    namazEnd: config.fajrNamazEnd,
    tuluAftab: config.tuluAftab,
    inTuluAftab: nowMin >= tuluStart && nowMin < tuluEnd,
  }
}

function getZawalTimings(nowMin: number, config: CityPrayerConfig = getCityPrayerConfig()): ZawalTimings {
  const zawalStart = parseTime(config.zawal.start)
  const zawalEnd = parseTime(config.zawal.end)
  return {
    start: config.zawal.start,
    end: config.zawal.end,
    label: config.zawal.label,
    inZawal: nowMin >= zawalStart && nowMin < zawalEnd,
  }
}

export function getLivePrayerInfo(now = new Date(), config: CityPrayerConfig = getCityPrayerConfig()): LivePrayerInfo {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const fajrTimings = getFajrTimings(nowMin, config)
  const zawalTimings = getZawalTimings(nowMin, config)

  const windows = config.prayerSchedule.map((p) => ({
    name: p.name,
    start: p.start,
    end: p.name === 'Fajr' ? config.fajrNamazEnd : p.end,
    startMin: parseTime(p.start),
    endMin: parseTime(p.name === 'Fajr' ? config.fajrNamazEnd : p.end),
  }))

  let currentWindow = windows.find((w) => isInWindow(nowMin, w.startMin, w.endMin))

  if (!currentWindow && fajrTimings.inTuluAftab) {
    const fajr = windows.find((w) => w.name === 'Fajr')!
    currentWindow = { ...fajr, end: config.fajrNamazEnd }
  }

  const nextWindow = (() => {
    if (fajrTimings.inTuluAftab) {
      return windows.find((w) => w.name === 'Dhuhr')!
    }
    if (currentWindow) {
      const idx = windows.findIndex((w) => w.name === currentWindow!.name)
      return windows[(idx + 1) % windows.length]
    }
    const upcoming = windows.find((w) => w.startMin > nowMin)
    return upcoming ?? windows[0]
  })()

  const minsUntilNext = fajrTimings.inTuluAftab
    ? minutesUntil(nowMin, parseTime(nextWindow.start))
    : currentWindow
      ? minutesUntil(nowMin, nextWindow.startMin)
      : windows.find((w) => w.startMin > nowMin)
        ? minutesUntil(nowMin, windows.find((w) => w.startMin > nowMin)!.startMin)
        : minutesUntil(nowMin, windows[0].startMin)

  return {
    current: currentWindow
      ? {
          name: currentWindow.name,
          displayName: getPrayerDisplayName(currentWindow.name, now),
          start: currentWindow.start,
          end: currentWindow.end,
        }
      : null,
    next: {
      name: nextWindow.name,
      displayName: getPrayerDisplayName(nextWindow.name, now),
      start: nextWindow.start,
      minutesUntil: minsUntilNext,
      countdown: formatCountdown(minsUntilNext),
    },
    nightTimings: config.nightTimings || DEFAULT_NIGHT_TIMINGS,
    fajrTimings,
    zawalTimings,
  }
}

export function getCurrentPrayerForMosques(now = new Date()): {
  name: PrayerName
  displayName: string
  inZawal: boolean
} | null {
  const info = getLivePrayerInfo(now)
  if (info.current) {
    return {
      name: info.current.name,
      displayName: info.current.displayName,
      inZawal: info.zawalTimings.inZawal,
    }
  }
  if (info.fajrTimings.inTuluAftab) {
    return { name: 'Fajr', displayName: 'Fajr', inZawal: false }
  }
  // During Zawal, show upcoming Dhuhr/Juma timings on mosque cards
  if (info.zawalTimings.inZawal) {
    return {
      name: 'Dhuhr',
      displayName: getPrayerDisplayName('Dhuhr', now),
      inZawal: true,
    }
  }
  return null
}

function getPrayerWindowEnd(name: PrayerName): string {
  const config = getCityPrayerConfig()
  const slot = config.prayerSchedule.find((p) => p.name === name)
  if (!slot) return '11:59 PM'
  return name === 'Fajr' ? config.fajrNamazEnd : slot.end
}

export function getMinutesUntilMosqueDeadline(
  mosque: { timings: Record<PrayerName, { jamat: string }> },
  prayerName: PrayerName,
  now = new Date(),
): number {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const jamatMin = parseTime(mosque.timings[prayerName].jamat)
  const endMin = parseTime(getPrayerWindowEnd(prayerName))

  if (nowMin < jamatMin) {
    return jamatMin - nowMin
  }
  if (endMin > nowMin) {
    return endMin - nowMin
  }
  if (endMin < jamatMin) {
    // overnight window (Isha)
    return 24 * 60 - nowMin + endMin
  }
  return 0
}

export function getNextPrayerMinutesUntil(now = new Date()): { name: PrayerName; minutesUntil: number } {
  const info = getLivePrayerInfo(now)
  return { name: info.next.name, minutesUntil: info.next.minutesUntil }
}

export function showFajrExtras(info: LivePrayerInfo): boolean {
  return info.current?.name === 'Fajr' || info.fajrTimings.inTuluAftab || info.next.name === 'Fajr'
}

export type PrayerExtraVariant = 'default' | 'zawal' | 'tulu-aftab'

export interface PrayerStatusExtra {
  id: string
  label: string
  value: string
  variant?: PrayerExtraVariant
  active?: boolean
}

export interface PrayerStatusExtrasGroup {
  heading: string
  items: PrayerStatusExtra[]
  nightTimings: typeof DEFAULT_NIGHT_TIMINGS | null
  alerts: { id: string; message: string }[]
}

/** Tahajjud — voluntary night prayer, shown during the Isha window */
export function showNightExtras(info: LivePrayerInfo): boolean {
  return info.current?.name === 'Isha'
}

export function showFajrPeriodExtras(info: LivePrayerInfo): boolean {
  return info.current?.name === 'Fajr' || info.fajrTimings.inTuluAftab
}

export function showZawalBeforeNext(info: LivePrayerInfo): boolean {
  return info.next.name === 'Dhuhr' && info.current?.name !== 'Dhuhr'
}

/**
 * Builds the footer chips for the home prayer card.
 * Content changes automatically as the current/next prayer shifts:
 * - Isha window  → Tahajjud + Sehri (no section label)
 * - Fajr window  → Sunrise
 * - Before Dhuhr → Zawal (shown under Dhuhr section on the card)
 * - Other times  → no footer (compact card only)
 */
export function getPrayerStatusExtras(info: LivePrayerInfo): PrayerStatusExtrasGroup | null {
  const items: PrayerStatusExtra[] = []
  const alerts: { id: string; message: string }[] = []
  const headings: string[] = []
  let nightTimings: typeof DEFAULT_NIGHT_TIMINGS | null = null

  if (showNightExtras(info)) {
    nightTimings = info.nightTimings
  }

  if (showFajrPeriodExtras(info)) {
    headings.push('Morning Timings')
    items.push({
      id: 'sunrise',
      label: 'Sunrise',
      value: info.fajrTimings.sunrise,
      active: info.fajrTimings.inTuluAftab,
    })
    if (info.fajrTimings.inTuluAftab) {
      alerts.push({
        id: 'sunrise',
        message: '🔴 Praying is prohibited until after sunrise',
      })
    }
  }

  if (items.length === 0 && !nightTimings) return null

  return {
    heading: headings.join(' · '),
    items,
    nightTimings,
    alerts,
  }
}

export function shouldShowZawalUnderCurrent(info: LivePrayerInfo) {
  return info.current?.name === 'Dhuhr'
}

export function shouldShowZawalUnderNext(info: LivePrayerInfo) {
  return info.next.name === 'Dhuhr' && info.current?.name !== 'Dhuhr'
}

/** Sort mosques by Azan then Namaz for the given prayer (earliest first) */
export function sortMosquesByPrayerTime<T extends { timings: Record<PrayerName, { azan: string; jamat: string }>; distance: number }>(
  mosques: T[],
  prayerName: PrayerName,
): T[] {
  return [...mosques].sort((a, b) => {
    const azanDiff = parseTime(a.timings[prayerName].azan) - parseTime(b.timings[prayerName].azan)
    if (azanDiff !== 0) return azanDiff
    const jamatDiff = parseTime(a.timings[prayerName].jamat) - parseTime(b.timings[prayerName].jamat)
    if (jamatDiff !== 0) return jamatDiff
    return a.distance - b.distance
  })
}