import type { PrayerName } from '@/src/types'
import { getCityPrayerConfig, type CityPrayerConfig } from '@/src/config/cityPrayerConfig'
import { DEFAULT_NIGHT_TIMINGS } from '@/src/data/mockData'

export interface LivePrayerInfo {
  current: {
    name: PrayerName
    displayName: string
    start: string
    end: string
    minutesRemaining: number
    remaining: string
  } | null
  next: { name: PrayerName; displayName: string; start: string; end: string; minutesUntil: number; countdown: string }
  inTuluAftab: boolean
  inZawal: boolean
}

export function isFriday(date = new Date()) {
  return date.getDay() === 5
}

export function getPrayerDisplayName(name: PrayerName, date = new Date()) {
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

export function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours24 = Math.floor(normalized / 60)
  const mins = normalized % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  let h = hours24 % 12
  if (h === 0) h = 12
  return `${h}:${String(mins).padStart(2, '0')} ${period}`
}

export function addMinutesToTime(time: string, deltaMinutes: number): string {
  return formatMinutesAsTime(parseTime(time) + deltaMinutes)
}

function isInWindow(nowMin: number, startMin: number, endMin: number) {
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin
  return nowMin >= startMin || nowMin < endMin
}

function formatCountdown(totalMinutes: number) {
  if (totalMinutes <= 0) return 'starting now'
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hrs > 0) return `${hrs} hrs ${mins} min`
  return `${mins} min`
}

function minutesUntil(fromMin: number, targetMin: number) {
  if (targetMin > fromMin) return targetMin - fromMin
  return 24 * 60 - fromMin + targetMin
}

function minutesUntilEnd(nowMin: number, startMin: number, endMin: number) {
  if (startMin <= endMin) return endMin - nowMin
  if (nowMin >= startMin) return 24 * 60 - nowMin + endMin
  return endMin - nowMin
}

export function formatRemaining(totalMinutes: number) {
  if (totalMinutes <= 0) return 'Remaining : ending now'
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hrs > 0 && mins > 0) return `Remaining : ${hrs}hr ${mins} min`
  if (hrs > 0) return `Remaining : ${hrs}hr`
  return `Remaining : ${mins} min`
}

/** Whole minutes from `now` until the next occurrence of a clock time. */
export function getMinutesUntilTime(time: string, now = new Date()): number {
  return minutesUntil(now.getHours() * 60 + now.getMinutes(), parseTime(time))
}

/** Share (0–1) of the current prayer window that has already elapsed. */
export function getPrayerWindowProgress(
  current: { start: string; end: string },
  now = new Date(),
): number {
  const startMin = parseTime(current.start)
  const endMin = parseTime(current.end)
  const total = startMin <= endMin ? endMin - startMin : 24 * 60 - startMin + endMin
  if (total <= 0) return 0
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const elapsed = total - minutesUntilEnd(nowMin, startMin, endMin)
  return Math.min(1, Math.max(0, elapsed / total))
}

export function getCurrentPrayerRemainingMinutes(
  current: { start: string; end: string },
  now = new Date(),
): number {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = parseTime(current.start)
  const endMin = parseTime(current.end)
  return minutesUntilEnd(nowMin, startMin, endMin)
}

/**
 * Seconds left in the current window, for countdowns that tick every second.
 * Window boundaries land on whole minutes, so the part of the current minute
 * that has already elapsed is taken back off.
 */
export function getCurrentPrayerRemainingSeconds(
  current: { start: string; end: string },
  now = new Date(),
): number {
  const wholeMinutes = getCurrentPrayerRemainingMinutes(current, now)
  return Math.max(0, wholeMinutes * 60 - now.getSeconds())
}

export function getLivePrayerInfo(now = new Date(), config: CityPrayerConfig = getCityPrayerConfig()): LivePrayerInfo {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const tuluStart = parseTime(config.tuluAftab.start)
  const tuluEnd = parseTime(config.tuluAftab.end)
  const inTuluAftab = nowMin >= tuluStart && nowMin < tuluEnd
  const inZawal = nowMin >= parseTime(config.zawal.start) && nowMin < parseTime(config.zawal.end)

  const windows = config.prayerSchedule.map((p) => ({
    name: p.name,
    start: p.start,
    end: p.name === 'Fajr' ? config.fajrNamazEnd : p.end,
    startMin: parseTime(p.start),
    endMin: parseTime(p.name === 'Fajr' ? config.fajrNamazEnd : p.end),
  }))

  let current = windows.find((w) => isInWindow(nowMin, w.startMin, w.endMin)) ?? null
  if (!current && inTuluAftab) current = windows.find((w) => w.name === 'Fajr') ?? null

  const next = (() => {
    if (inTuluAftab) return windows.find((w) => w.name === 'Dhuhr')!
    if (current) {
      const idx = windows.findIndex((w) => w.name === current!.name)
      return windows[(idx + 1) % windows.length]
    }
    return windows.find((w) => w.startMin > nowMin) ?? windows[0]
  })()

  const minsUntilNext = inTuluAftab
    ? minutesUntil(nowMin, parseTime(next.start))
    : current
      ? minutesUntil(nowMin, next.startMin)
      : minutesUntil(nowMin, (windows.find((w) => w.startMin > nowMin) ?? windows[0]).startMin)

  const currentRemainingMins = current
    ? minutesUntilEnd(nowMin, current.startMin, current.endMin)
    : 0

  return {
    current: current
      ? {
          name: current.name,
          displayName: getPrayerDisplayName(current.name, now),
          start: current.start,
          end: current.end,
          minutesRemaining: currentRemainingMins,
          remaining: formatRemaining(currentRemainingMins),
        }
      : null,
    next: {
      name: next.name,
      displayName: getPrayerDisplayName(next.name, now),
      start: next.start,
      end: next.end,
      minutesUntil: minsUntilNext,
      countdown: formatCountdown(minsUntilNext),
    },
    inTuluAftab,
    inZawal,
  }
}

export function getCurrentPrayerForMosques(now = new Date(), config: CityPrayerConfig = getCityPrayerConfig()) {
  const info = getLivePrayerInfo(now, config)
  if (info.current) {
    return { name: info.current.name, displayName: info.current.displayName, inZawal: info.inZawal }
  }
  if (info.inTuluAftab) return { name: 'Fajr' as PrayerName, displayName: 'Fajr', inZawal: false }
  if (info.inZawal) {
    return { name: 'Dhuhr' as PrayerName, displayName: getPrayerDisplayName('Dhuhr', now), inZawal: true }
  }
  return null
}

/**
 * True once a mosque's Azan time for the given prayer has started (Azan called / done)
 * and the prayer window is still active. Handles windows that wrap past midnight (Isha).
 */
export function hasMosqueAzanStarted(
  mosque: { timings: Record<PrayerName, { azan: string; jamat: string }>; jumaTimings?: { khutba: string } },
  prayerName: PrayerName,
  now = new Date(),
  config: CityPrayerConfig = getCityPrayerConfig(),
) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isJuma = prayerName === 'Dhuhr' && isFriday(now)
  const azanStr = isJuma && mosque.jumaTimings?.khutba ? mosque.jumaTimings.khutba : mosque.timings[prayerName].azan
  const azanMin = parseTime(azanStr)
  const endStr =
    prayerName === 'Fajr'
      ? config.fajrNamazEnd
      : config.prayerSchedule.find((p) => p.name === prayerName)!.end
  const endMin = parseTime(endStr)
  return isInWindow(nowMin, azanMin, endMin)
}

/**
 * True only while the Azan is "live" — from the mosque's Azan time up to its
 * Jamat (Namaz) time. Outside this window the Live badge should be grey.
 * Handles windows that wrap past midnight.
 */
export function isMosqueAzanLive(
  mosque: { timings: Record<PrayerName, { azan: string; jamat: string }>; jumaTimings?: { khutba: string; namaz: string } },
  prayerName: PrayerName,
  now = new Date(),
) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isJuma = prayerName === 'Dhuhr' && isFriday(now)
  const slot = mosque.timings[prayerName]
  const azanStr = isJuma && mosque.jumaTimings?.khutba ? mosque.jumaTimings.khutba : slot.azan
  const jamatStr = isJuma && mosque.jumaTimings?.namaz ? mosque.jumaTimings.namaz : slot.jamat
  const azanMin = parseTime(azanStr)
  const jamatMin = parseTime(jamatStr)
  return isInWindow(nowMin, azanMin, jamatMin)
}

export function getMinutesUntilMosqueDeadline(
  mosque: { timings: Record<PrayerName, { jamat: string }> },
  prayerName: PrayerName,
  now = new Date(),
  config: CityPrayerConfig = getCityPrayerConfig(),
) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const jamatMin = parseTime(mosque.timings[prayerName].jamat)
  const endStr =
    prayerName === 'Fajr'
      ? config.fajrNamazEnd
      : config.prayerSchedule.find((p) => p.name === prayerName)!.end
  const endMin = parseTime(endStr)
  if (nowMin < jamatMin) return jamatMin - nowMin
  if (endMin > nowMin) return endMin - nowMin
  if (endMin < jamatMin) return 24 * 60 - nowMin + endMin
  return 0
}

export type PrayerStatusExtras = {
  items: { id: string; label: string; value: string; noPrayer?: boolean }[]
  nightTimings: typeof DEFAULT_NIGHT_TIMINGS | null
}

export function getPrayerStatusExtras(
  now = new Date(),
  config: CityPrayerConfig = getCityPrayerConfig(),
): PrayerStatusExtras | null {
  const info = getLivePrayerInfo(now, config)
  const items: PrayerStatusExtras['items'] = []
  let nightTimings: typeof DEFAULT_NIGHT_TIMINGS | null = null

  if (info.current?.name === 'Isha') {
    nightTimings = config.nightTimings || DEFAULT_NIGHT_TIMINGS
  }
  if (info.current?.name === 'Fajr' || info.inTuluAftab) {
    items.push({
      id: 'sunrise',
      label: 'Sunrise',
      value: config.sunrise,
      noPrayer: info.inTuluAftab,
    })
  }
  if (items.length === 0 && !nightTimings) return null
  return { items, nightTimings }
}

export function shouldShowZawalUnderCurrent(info: LivePrayerInfo) {
  return info.current?.name === 'Dhuhr'
}

export function shouldShowZawalUnderNext(info: LivePrayerInfo) {
  return info.next.name === 'Dhuhr' && info.current?.name !== 'Dhuhr'
}

export function shouldShowMorningNaflUnderCurrent(info: LivePrayerInfo) {
  return shouldShowZawalUnderNext(info)
}
