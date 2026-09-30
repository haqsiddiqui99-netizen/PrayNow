export type Meridiem = 'AM' | 'PM'

export type ClockParts = {
  hour: number // 1–12
  minute: number // 0–59
  period: Meridiem
}

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i

/** Parse display times like "4:55 AM" into 12h parts. */
export function parseClockTime(value: string, fallback: ClockParts = { hour: 12, minute: 0, period: 'AM' }): ClockParts {
  const trimmed = (value || '').trim()
  const m = trimmed.match(TIME_RE)
  if (!m) return fallback
  let hour = Number(m[1])
  const minute = Number(m[2])
  const period = m[3].toUpperCase() as Meridiem
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  if (hour < 1 || hour > 12) hour = ((hour - 1 + 12) % 12) + 1
  return {
    hour,
    minute: Math.min(59, Math.max(0, minute)),
    period,
  }
}

/** Format parts as "4:55 AM" (matches app prayer time strings). */
export function formatClockTime(parts: ClockParts): string {
  const hour = Math.min(12, Math.max(1, parts.hour || 12))
  const minute = Math.min(59, Math.max(0, parts.minute || 0))
  const period = parts.period === 'PM' ? 'PM' : 'AM'
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`
}

/** "4:55 AM" → "4:55", for tight grids where the prayer order already implies the half of day. */
export function stripMeridiem(value: string): string {
  return (value || '').replace(/\s*(AM|PM)\s*$/i, '').trim()
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1)
export const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i)
