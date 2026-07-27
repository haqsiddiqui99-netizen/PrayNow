import type { ArrivalStatus, Mosque, PrayerName } from '../types'
import {
  getMinutesUntilMosqueDeadline,
  getNextPrayerMinutesUntil,
} from './prayerSchedule'

export type TravelMode = 'walking' | 'driving' | 'transit'

const WALK_SPEED_KMH = 5
const TRANSIT_FACTOR = 1.45

export function getTravelMinutes(mosque: Mosque, mode: TravelMode): number {
  switch (mode) {
    case 'walking':
      return Math.round((mosque.distance / WALK_SPEED_KMH) * 60)
    case 'transit':
      return Math.round(mosque.travelMinutes * TRANSIT_FACTOR)
    case 'driving':
    default:
      return mosque.travelMinutes
  }
}

export function getNextPrayerInfo() {
  return getNextPrayerMinutesUntil()
}

export function getArrivalInfoForMosque(
  mosque: Mosque,
  travelMinutes: number,
  prayerName: PrayerName,
  now = new Date(),
) {
  const minutesUntil = getMinutesUntilMosqueDeadline(mosque, prayerName, now)
  return getArrivalInfo(travelMinutes, minutesUntil)
}

export function getArrivalInfo(
  travelMinutes: number,
  minutesUntilPrayer: number,
): { status: ArrivalStatus; message: string; bufferMinutes: number } {
  const buffer = minutesUntilPrayer - travelMinutes

  if (buffer >= 5) {
    return {
      status: 'early',
      message: `You'll arrive ${buffer} min early`,
      bufferMinutes: buffer,
    }
  }
  if (buffer >= 0) {
    return {
      status: 'on-time',
      message: `You'll arrive on time (${buffer} min buffer)`,
      bufferMinutes: buffer,
    }
  }
  return {
    status: 'late',
    message: `You'll be ${Math.abs(buffer)} min late`,
    bufferMinutes: buffer,
  }
}

export function openGoogleMaps(mosque: Mosque, mode: TravelMode) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}&travelmode=${mode}`
  window.open(url, '_blank')
}

export const TRAVEL_MODES: { mode: TravelMode; label: string; icon: string }[] = [
  { mode: 'walking', label: 'Walk', icon: '🚶' },
  { mode: 'driving', label: 'Car', icon: '🚗' },
  { mode: 'transit', label: 'Transit', icon: '🚌' },
]
