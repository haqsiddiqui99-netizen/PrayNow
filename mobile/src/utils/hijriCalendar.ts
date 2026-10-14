import { toGregorian, toHijri } from 'hijri-converter'
import type { TranslationKey } from '@/src/i18n/translations'

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
] as const

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
]

export type HijriDate = { year: number; month: number; day: number }

export type IslamicEvent = {
  name: string
  note: string
  month: number
  day: number
}

/** Fixed dates on the Umm al-Qura calendar. Local moon sighting can shift a day. */
export const ISLAMIC_EVENTS: IslamicEvent[] = [
  { month: 1, day: 1, name: 'Islamic New Year', note: '1 Muharram' },
  { month: 1, day: 10, name: 'Ashura', note: 'A day of fasting' },
  { month: 3, day: 12, name: 'Mawlid', note: 'Birth of the Prophet' },
  { month: 7, day: 27, name: "Isra and Mi'raj", note: 'The night journey' },
  { month: 8, day: 15, name: "Mid-Sha'ban", note: "15 Sha'ban" },
  { month: 9, day: 1, name: 'Ramadan begins', note: 'The month of fasting' },
  { month: 9, day: 21, name: 'Odd night', note: 'Laylat al-Qadr is sought on the odd nights' },
  { month: 9, day: 23, name: 'Odd night', note: 'Laylat al-Qadr is sought on the odd nights' },
  { month: 9, day: 25, name: 'Odd night', note: 'Laylat al-Qadr is sought on the odd nights' },
  { month: 9, day: 27, name: 'Odd night', note: 'The 27th, widely observed' },
  { month: 9, day: 29, name: 'Odd night', note: 'Laylat al-Qadr is sought on the odd nights' },
  { month: 10, day: 1, name: 'Eid al-Fitr', note: 'The festival after Ramadan' },
  { month: 12, day: 9, name: 'Day of Arafah', note: 'The day of the standing' },
  { month: 12, day: 10, name: 'Eid al-Adha', note: 'The festival of sacrifice' },
]

export function hijriOf(date: Date): HijriDate {
  const { hy, hm, hd } = toHijri(date.getFullYear(), date.getMonth() + 1, date.getDate())
  return { year: hy, month: hm, day: hd }
}

/** Treats every day as Ramadan so Sehri, Iftar and Taraweeh can be tested year-round. */
export const RAMADAN_PREVIEW = true

/** Day of Ramadan (1-30) for the date, or 0 outside Ramadan. */
export function ramadanDayOf(date: Date): number {
  const hijri = hijriOf(date)
  if (hijri.month === 9 || RAMADAN_PREVIEW) return hijri.day
  return 0
}

export function gregorianOf(hijri: HijriDate): Date {
  const { gy, gm, gd } = toGregorian(hijri.year, hijri.month, hijri.day)
  return new Date(gy, gm - 1, gd)
}

export function monthLength(year: number, month: number): number {
  const gregorian = toGregorian(year, month, 30)
  const back = toHijri(gregorian.gy, gregorian.gm, gregorian.gd)
  return back.hm === month && back.hd === 30 ? 30 : 29
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysUntil(date: Date, from = new Date()): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b - a) / 86400000)
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export type DatedEvent = IslamicEvent & { date: Date; year: number }

export function eventsOn(year: number, month: number, day: number): IslamicEvent[] {
  return ISLAMIC_EVENTS.filter((event) => event.month === month && event.day === day)
}

export function upcomingEvents(from = new Date(), limit = 5): DatedEvent[] {
  const start = startOfDay(from)
  const current = hijriOf(start)
  const found: DatedEvent[] = []
  for (const year of [current.year, current.year + 1]) {
    for (const event of ISLAMIC_EVENTS) {
      const date = gregorianOf({ year, month: event.month, day: event.day })
      if (date >= start) found.push({ ...event, date, year })
    }
  }
  found.sort((a, b) => a.date.getTime() - b.date.getTime())
  return found.slice(0, limit)
}

export function monthWeeks(year: number, month: number): Array<Array<number | null>> {
  const length = monthLength(year, month)
  const lead = gregorianOf({ year, month, day: 1 }).getDay()
  const cells: Array<number | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: Array<Array<number | null>> = []
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7))
  return rows
}

const EVENT_KEYS: Record<string, { name: TranslationKey; note: TranslationKey }> = {
  '1-1': { name: 'event.newYear', note: 'event.newYearNote' },
  '1-10': { name: 'event.ashura', note: 'event.ashuraNote' },
  '3-12': { name: 'event.mawlid', note: 'event.mawlidNote' },
  '7-27': { name: 'event.isra', note: 'event.israNote' },
  '8-15': { name: 'event.shaban', note: 'event.shabanNote' },
  '9-1': { name: 'event.ramadan', note: 'event.ramadanNote' },
  '9-21': { name: 'event.odd', note: 'event.oddNote' },
  '9-23': { name: 'event.odd', note: 'event.oddNote' },
  '9-25': { name: 'event.odd', note: 'event.oddNote' },
  '9-27': { name: 'event.odd27', note: 'event.odd27Note' },
  '9-29': { name: 'event.odd', note: 'event.oddNote' },
  '10-1': { name: 'event.fitr', note: 'event.fitrNote' },
  '12-9': { name: 'event.arafah', note: 'event.arafahNote' },
  '12-10': { name: 'event.adha', note: 'event.adhaNote' },
}

export function eventKeys(month: number, day: number) {
  return EVENT_KEYS[`${month}-${day}`] ?? null
}
