import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CityPrayerDay } from '@/src/services/api'
import type { PrayerName } from '@/src/types'
import { getPrayerDisplayName, parseTime } from '@/src/utils/prayerSchedule'
import { localizeDigits } from '@/src/i18n/digits'
import { localizePlaceName } from '@/src/i18n/placeNames'
import {
  LANGUAGES,
  isLanguageCode,
  translations,
  type LanguageCode,
  type TranslationKey,
} from '@/src/i18n/translations'

export const PRAYER_WIDGET = 'PrayerTimes'

const STORE_KEY = 'praynow.widget.days.v1'
const LANGUAGE_KEY = 'praynow.language'
const MAX_DAYS = 31
const ORDER: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

type WidgetStore = { city: string; days: CityPrayerDay[] }

export type PrayerWidgetModel = {
  rtl: boolean
  /** Shown instead of times when nothing has been saved yet. */
  empty: string | null
  label: string
  refreshLabel: string
  city: string
  nextName: string
  nextTime: string
  countdown: string
  times: { key: string; name: string; time: string; next: boolean }[]
  note: string | null
}

export function ymd(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function loadStore(): Promise<WidgetStore | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as WidgetStore) : null
  } catch {
    return null
  }
}

/** Keeps upcoming days on the device so the widget stays right while the app is closed. */
export async function saveWidgetDays(city: string, days: CityPrayerDay[]) {
  const store = await loadStore()
  const yesterday = ymd(addDays(new Date(), -1))
  const byDate = new Map<string, CityPrayerDay>()
  if (store?.city === city) {
    for (const day of store.days) byDate.set(day.date, day)
  }
  for (const day of days) {
    if (day.schedule.length) byDate.set(day.date, day)
  }
  const kept = [...byDate.values()]
    .filter((day) => day.date >= yesterday)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_DAYS)
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ city, days: kept }))
}

export function widgetDateRange(days: number) {
  const today = new Date()
  return { from: ymd(today), to: ymd(addDays(today, days - 1)) }
}

function translator(language: LanguageCode) {
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
    const template = translations[language][key] ?? translations.en[key]
    const text = vars
      ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
      : template
    return localizeDigits(text, language)
  }
  const clock = (value: string, withPeriod: boolean) => {
    const match = value.trim().match(/^(.*?)\s*(AM|PM)$/i)
    if (!match) return localizeDigits(value, language)
    const digits = localizeDigits(match[1], language)
    if (!withPeriod) return digits
    return `${digits} ${match[2].toUpperCase() === 'PM' ? t('time.pm') : t('time.am')}`
  }
  const duration = (totalMinutes: number) => {
    if (totalMinutes <= 0) return t('duration.now')
    const hrs = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    if (hrs > 0 && mins > 0) return t('duration.hm', { hrs, mins })
    if (hrs > 0) return t('duration.h', { hrs })
    return t('duration.m', { mins })
  }
  const prayer = (name: PrayerName, date: Date) =>
    t(`prayer.${getPrayerDisplayName(name, date).toLowerCase()}` as TranslationKey)
  return { t, clock, duration, prayer }
}

function ordered(day: CityPrayerDay) {
  return ORDER.map((name) => day.schedule.find((slot) => slot.name === name)).filter(
    (slot): slot is CityPrayerDay['schedule'][number] => Boolean(slot?.start),
  )
}

function dateOf(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function buildPrayerWidgetModel(now = new Date()): Promise<PrayerWidgetModel> {
  const [store, storedLanguage] = await Promise.all([loadStore(), AsyncStorage.getItem(LANGUAGE_KEY)])
  const language: LanguageCode = isLanguageCode(storedLanguage) ? storedLanguage : 'en'
  const rtl = LANGUAGES.find((lang) => lang.code === language)?.rtl ?? false
  const { t, clock, duration, prayer } = translator(language)

  const days = store?.days.filter((day) => ordered(day).length === ORDER.length) ?? []
  const blank: PrayerWidgetModel = {
    rtl,
    empty: t('widget.openApp'),
    label: '',
    refreshLabel: t('widget.refresh'),
    city: '',
    nextName: '',
    nextTime: '',
    countdown: '',
    times: [],
    note: null,
  }
  if (!store || !days.length) return blank

  const todayKey = ymd(now)
  const tomorrowKey = ymd(addDays(now, 1))
  const today =
    days.find((day) => day.date === todayKey) ??
    [...days].reverse().find((day) => day.date < todayKey) ??
    days[0]
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  const todaySlots = ordered(today)
  let shown = today
  let shownDate = now
  let nextIndex = todaySlots.findIndex((slot) => parseTime(slot.start) > minutesNow)
  let minutesUntil = nextIndex >= 0 ? parseTime(todaySlots[nextIndex].start) - minutesNow : 0
  const afterIsha = nextIndex < 0
  if (afterIsha) {
    shown = days.find((day) => day.date === tomorrowKey) ?? today
    shownDate = dateOf(tomorrowKey)
    nextIndex = 0
    minutesUntil = parseTime(ordered(shown)[0].start) + 24 * 60 - minutesNow
  }

  const slots = ordered(shown)
  const next = slots[nextIndex]
  return {
    rtl,
    empty: null,
    label: afterIsha ? t('widget.tomorrow') : t('widget.next'),
    refreshLabel: t('widget.refresh'),
    city: localizePlaceName(store.city, language),
    nextName: prayer(next.name, shownDate),
    nextTime: clock(next.start, true),
    countdown: t('widget.in', { time: duration(minutesUntil) }),
    times: slots.map((slot, index) => ({
      key: slot.name,
      name: prayer(slot.name, shownDate),
      time: clock(slot.start, false),
      next: index === nextIndex,
    })),
    note: today.date === todayKey ? null : t('widget.stale'),
  }
}
