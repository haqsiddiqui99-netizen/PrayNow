import type { PrayerName } from '@/src/types'
import {
  FAJR_NAMAZ_END,
  LOCATION,
  PRAYER_SCHEDULE,
  SUNRISE,
  TULU_AFTAB,
  ZAWAL,
  DEFAULT_NIGHT_TIMINGS,
} from '@/src/data/mockData'

export type NaflTiming = { start: string; end: string; label: string }

function parseClockTime(time: string): number {
  const [clock, period] = time.split(' ')
  const [hours, minutes] = clock.split(':').map(Number)
  let h = hours
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + minutes
}

function formatClockTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours24 = Math.floor(normalized / 60)
  const mins = normalized % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  let h = hours24 % 12
  if (h === 0) h = 12
  return `${h}:${String(mins).padStart(2, '0')} ${period}`
}

function addMinutesToClockTime(time: string, deltaMinutes: number): string {
  return formatClockTime(parseClockTime(time) + deltaMinutes)
}

export function deriveMorningNaflTimings(sunrise: string, zawalStart: string) {
  const ishraqStart = addMinutesToClockTime(sunrise, 15)
  const ishraqEnd = addMinutesToClockTime(sunrise, 105)
  const chashtStart = ishraqEnd
  const chashtEnd = addMinutesToClockTime(zawalStart, -20)
  return {
    ishraq: { start: ishraqStart, end: ishraqEnd, label: 'Ishraq' as const },
    chasht: { start: chashtStart, end: chashtEnd, label: 'Chasht' as const },
  }
}

export interface CityPrayerConfig {
  city: string
  country: string
  lat: number
  lng: number
  prayerSchedule: ReadonlyArray<{ name: PrayerName; start: string; end: string }>
  sunrise: string
  fajrNamazEnd: string
  zawal: { start: string; end: string; label: string }
  tuluAftab: { start: string; end: string; label: string }
  ishraq: NaflTiming
  chasht: NaflTiming
  nightTimings: { tahajjud: { start: string; end: string }; sehri: { start: string; end: string } }
  date?: string
  yearDaysLoaded?: number
}

export interface ApiCitySettingsResponse {
  settings: {
    city?: string
    country?: string
    lat?: number
    lng?: number
    zawal_start?: string
    zawal_end?: string
    sunrise?: string
    fajr_namaz_end?: string
    tahajjud_start?: string
    tahajjud_end?: string
    sehri_start?: string
    sehri_end?: string
  } | null
  schedule: Array<{
    prayer_name: string
    start_time: string
    end_time: string
  }>
  day?: {
    date: string
    nightTimings?: { tahajjud: { start: string; end: string }; sehri: { start: string; end: string } }
  } | null
  date?: string
  yearDaysLoaded?: number
}

const PRAYER_ORDER: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const defaultMorningNafl = deriveMorningNaflTimings(SUNRISE, ZAWAL.start)

export const DEFAULT_CITY_PRAYER_CONFIG: CityPrayerConfig = {
  city: LOCATION.city,
  country: LOCATION.country,
  lat: LOCATION.lat,
  lng: LOCATION.lng,
  prayerSchedule: PRAYER_SCHEDULE,
  sunrise: SUNRISE,
  fajrNamazEnd: FAJR_NAMAZ_END,
  zawal: ZAWAL,
  tuluAftab: TULU_AFTAB,
  ishraq: defaultMorningNafl.ishraq,
  chasht: defaultMorningNafl.chasht,
  nightTimings: DEFAULT_NIGHT_TIMINGS,
}

let activeConfig: CityPrayerConfig = DEFAULT_CITY_PRAYER_CONFIG

export function getCityPrayerConfig(): CityPrayerConfig {
  return activeConfig
}

export function setCityPrayerConfig(config: CityPrayerConfig) {
  activeConfig = config
}

export function mapApiCitySettings(data: ApiCitySettingsResponse): CityPrayerConfig {
  const settings = data.settings ?? {}
  const byPrayer = new Map(data.schedule.map((row) => [row.prayer_name, row]))

  const prayerSchedule = PRAYER_ORDER.map((name) => {
    const row = byPrayer.get(name)
    const fallback = DEFAULT_CITY_PRAYER_CONFIG.prayerSchedule.find((p) => p.name === name)!
    return {
      name,
      start: row?.start_time || fallback.start,
      end: row?.end_time || fallback.end,
    }
  })

  const fajrNamazEnd = settings.fajr_namaz_end || DEFAULT_CITY_PRAYER_CONFIG.fajrNamazEnd
  const sunrise = settings.sunrise || DEFAULT_CITY_PRAYER_CONFIG.sunrise
  const zawalStart = settings.zawal_start || DEFAULT_CITY_PRAYER_CONFIG.zawal.start
  const zawalEnd = settings.zawal_end || DEFAULT_CITY_PRAYER_CONFIG.zawal.end

  const nightTimings = {
    tahajjud: {
      start:
        data.day?.nightTimings?.tahajjud?.start ||
        settings.tahajjud_start ||
        DEFAULT_CITY_PRAYER_CONFIG.nightTimings.tahajjud.start,
      end:
        data.day?.nightTimings?.tahajjud?.end ||
        settings.tahajjud_end ||
        DEFAULT_CITY_PRAYER_CONFIG.nightTimings.tahajjud.end,
    },
    sehri: {
      start:
        data.day?.nightTimings?.sehri?.start ||
        settings.sehri_start ||
        DEFAULT_CITY_PRAYER_CONFIG.nightTimings.sehri.start,
      end:
        data.day?.nightTimings?.sehri?.end ||
        settings.sehri_end ||
        DEFAULT_CITY_PRAYER_CONFIG.nightTimings.sehri.end,
    },
  }

  const morningNafl = deriveMorningNaflTimings(sunrise, zawalStart)

  return {
    city: settings.city || DEFAULT_CITY_PRAYER_CONFIG.city,
    country: settings.country || DEFAULT_CITY_PRAYER_CONFIG.country,
    lat: settings.lat ?? DEFAULT_CITY_PRAYER_CONFIG.lat,
    lng: settings.lng ?? DEFAULT_CITY_PRAYER_CONFIG.lng,
    prayerSchedule,
    sunrise,
    fajrNamazEnd,
    zawal: { start: zawalStart, end: zawalEnd, label: 'Zawal' },
    tuluAftab: { start: fajrNamazEnd, end: sunrise, label: 'Tulu Aftab' },
    ishraq: morningNafl.ishraq,
    chasht: morningNafl.chasht,
    nightTimings,
    date: data.date || data.day?.date,
    yearDaysLoaded: data.yearDaysLoaded,
  }
}
