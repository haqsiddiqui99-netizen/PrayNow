import type { NightTimings } from '../types'
import { minutesOf } from './timeEntry'

export type SunTimes = {
  date: string
  /** Where the clocks came from: the Aladhan service, or worked out on the server. */
  source?: 'aladhan' | 'calculated'
  sunrise: string
  fajr: string
  /** Maghrib today, which is when the night begins. */
  maghrib: string
  /** Fajr on the next morning, which is when the night ends. */
  fajrTomorrow: string
}

const DAY = 24 * 60
const SEHRI_LEAD_MINUTES = 90

/** Minutes from midnight back to a 12-hour clock, for example 83 becomes "1:23 AM". */
export function clockOf(minutes: number) {
  const total = ((Math.round(minutes) % DAY) + DAY) % DAY
  const hour24 = Math.floor(total / 60)
  const minute = total % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}

/**
 * Works out the night clocks from Maghrib today and Fajr tomorrow.
 *
 * The night runs from Maghrib to the next Fajr and is split into thirds.
 * Tahajjud starts at midnight (Maghrib plus half the night) and ends at Fajr.
 * The last third of the night starts at Maghrib plus two thirds of the night.
 * Sehri ends at Fajr and starts 90 minutes earlier. Iftar is Maghrib.
 *
 * Example: Maghrib 8:00 PM and Fajr 5:30 AM give a 9h 30m night, so midnight is 12:45 AM and the last third starts 2:20 AM.
 */
export type DerivedNight = Required<NightTimings> & {
  /** Where the last third of the night begins. Shown beside Tahajjud, not saved on its own. */
  lastThird: string
}

export function deriveNight(sun: Pick<SunTimes, 'maghrib' | 'fajrTomorrow'>): DerivedNight | null {
  const maghrib = minutesOf(sun.maghrib)
  const fajr = minutesOf(sun.fajrTomorrow)
  if (maghrib == null || fajr == null) return null
  const night = (fajr + DAY - maghrib) % DAY
  if (night === 0) return null
  return {
    // Tahajjud opens at midnight (half the night). The best part, the last third, is shown as its own row.
    tahajjud: { start: clockOf(maghrib + night / 2), end: clockOf(fajr) },
    lastThird: clockOf(maghrib + (night * 2) / 3),
    sehri: { start: clockOf(fajr - SEHRI_LEAD_MINUTES), end: clockOf(fajr) },
    iftar: clockOf(maghrib),
  }
}

/** Keeps every clock the owner typed and fills only the empty ones from the derived night. */
export function withDerivedNight(current: NightTimings | undefined, derived: DerivedNight | null): NightTimings {
  const base: NightTimings = {
    tahajjud: { start: current?.tahajjud?.start || '', end: current?.tahajjud?.end || '' },
    sehri: { start: current?.sehri?.start || '', end: current?.sehri?.end || '' },
    iftar: current?.iftar || '',
  }
  if (!derived) return base
  return {
    tahajjud: {
      start: base.tahajjud.start || derived.tahajjud.start,
      end: base.tahajjud.end || derived.tahajjud.end,
    },
    sehri: {
      start: base.sehri.start || derived.sehri.start,
      end: base.sehri.end || derived.sehri.end,
    },
    iftar: base.iftar || derived.iftar,
  }
}
