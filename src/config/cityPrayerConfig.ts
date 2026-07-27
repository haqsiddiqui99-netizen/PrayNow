import type { PrayerName } from '../types'
import {
  DEFAULT_NIGHT_TIMINGS,
  FAJR_NAMAZ_END,
  LOCATION,
  PRAYER_SCHEDULE,
  SUNRISE,
  TULU_AFTAB,
  ZAWAL,
} from '../data/mockData'

export type CityPrayerConfig = {
  city: string
  country: string
  lat: number
  lng: number
  prayerSchedule: ReadonlyArray<{ name: PrayerName; start: string; end: string }>
  sunrise: string
  fajrNamazEnd: string
  zawal: { start: string; end: string; label: string }
  tuluAftab: { start: string; end: string; label: string }
  nightTimings: typeof DEFAULT_NIGHT_TIMINGS
  date?: string
  yearDaysLoaded?: number
}

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
  nightTimings: DEFAULT_NIGHT_TIMINGS,
}

let activeConfig: CityPrayerConfig = DEFAULT_CITY_PRAYER_CONFIG

export function getCityPrayerConfig() {
  return activeConfig
}

export function setCityPrayerConfig(config: CityPrayerConfig) {
  activeConfig = config
}

export function mapApiCitySettings(data: {
  settings: Record<string, string | number> | null
  schedule: Array<{ prayer_name: string; start_time: string; end_time: string }>
  day?: {
    date: string
    nightTimings?: { tahajjud: { start: string; end: string }; sehri: { start: string; end: string } }
  } | null
  date?: string
  yearDaysLoaded?: number
}): CityPrayerConfig {
  const settings = data.settings ?? {}
  const byPrayer = new Map(data.schedule.map((row) => [row.prayer_name, row]))
  const order: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  const prayerSchedule = order.map((name) => {
    const row = byPrayer.get(name)
    const fallback = DEFAULT_CITY_PRAYER_CONFIG.prayerSchedule.find((p) => p.name === name)!
    return {
      name,
      start: row?.start_time || fallback.start,
      end: row?.end_time || fallback.end,
    }
  })
  const fajrNamazEnd = String(settings.fajr_namaz_end || DEFAULT_CITY_PRAYER_CONFIG.fajrNamazEnd)
  const sunrise = String(settings.sunrise || DEFAULT_CITY_PRAYER_CONFIG.sunrise)
  return {
    city: String(settings.city || DEFAULT_CITY_PRAYER_CONFIG.city),
    country: String(settings.country || DEFAULT_CITY_PRAYER_CONFIG.country),
    lat: Number(settings.lat ?? DEFAULT_CITY_PRAYER_CONFIG.lat),
    lng: Number(settings.lng ?? DEFAULT_CITY_PRAYER_CONFIG.lng),
    prayerSchedule,
    sunrise,
    fajrNamazEnd,
    zawal: {
      start: String(settings.zawal_start || DEFAULT_CITY_PRAYER_CONFIG.zawal.start),
      end: String(settings.zawal_end || DEFAULT_CITY_PRAYER_CONFIG.zawal.end),
      label: 'Zawal',
    },
    tuluAftab: { start: fajrNamazEnd, end: sunrise, label: 'Tulu Aftab' },
    nightTimings: {
      tahajjud: {
        start: String(
          data.day?.nightTimings?.tahajjud?.start ||
            settings.tahajjud_start ||
            DEFAULT_CITY_PRAYER_CONFIG.nightTimings.tahajjud.start,
        ),
        end: String(
          data.day?.nightTimings?.tahajjud?.end ||
            settings.tahajjud_end ||
            DEFAULT_CITY_PRAYER_CONFIG.nightTimings.tahajjud.end,
        ),
      },
      sehri: {
        start: String(
          data.day?.nightTimings?.sehri?.start ||
            settings.sehri_start ||
            DEFAULT_CITY_PRAYER_CONFIG.nightTimings.sehri.start,
        ),
        end: String(
          data.day?.nightTimings?.sehri?.end ||
            settings.sehri_end ||
            DEFAULT_CITY_PRAYER_CONFIG.nightTimings.sehri.end,
        ),
      },
    },
    date: data.date || data.day?.date,
    yearDaysLoaded: data.yearDaysLoaded,
  }
}
