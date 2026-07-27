import type { ArrivalStatus, Mosque, PrayerName, TravelMode } from '@/src/types'
import { getMinutesUntilMosqueDeadline } from '@/src/utils/prayerSchedule'

export function getTravelMinutes(mosque: Mosque, mode: TravelMode): number {
  switch (mode) {
    case 'walking':
      return Math.round((mosque.distance / 5) * 60)
    case 'transit':
      return Math.round(mosque.travelMinutes * 1.45)
    default:
      return mosque.travelMinutes
  }
}

export function getArrivalInfo(travelMinutes: number, minutesUntilPrayer: number) {
  const buffer = minutesUntilPrayer - travelMinutes
  if (buffer >= 5) {
    return { status: 'early' as ArrivalStatus, message: `You'll arrive ${buffer} min early`, bufferMinutes: buffer }
  }
  if (buffer >= 0) {
    return { status: 'on-time' as ArrivalStatus, message: `On time (${buffer} min buffer)`, bufferMinutes: buffer }
  }
  return { status: 'late' as ArrivalStatus, message: `${Math.abs(buffer)} min late`, bufferMinutes: buffer }
}

export function getArrivalInfoForMosque(mosque: Mosque, travelMinutes: number, prayerName: PrayerName, now = new Date()) {
  return getArrivalInfo(travelMinutes, getMinutesUntilMosqueDeadline(mosque, prayerName, now))
}

export const TRAVEL_MODES: { mode: TravelMode; label: string; icon: string }[] = [
  { mode: 'walking', label: 'Walk', icon: '🚶' },
  { mode: 'driving', label: 'Car', icon: '🚗' },
  { mode: 'transit', label: 'Transit', icon: '🚌' },
]
