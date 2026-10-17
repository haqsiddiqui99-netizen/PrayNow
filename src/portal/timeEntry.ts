import type { JumaSession, Mosque, PrayerName } from '../types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

/** Minutes from midnight, or null when the text is not a 12-hour clock time. */
export function minutesOf(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) return null
  let h = hour
  const period = match[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + minute
}

export function clockBroken(value: string) {
  return value.trim() !== '' && minutesOf(value) === null
}

function mobileIssue(label: string, value: string) {
  const raw = value.trim()
  if (!raw) return null
  if (/[a-z]/i.test(raw)) return `${label} should be digits, not letters.`
  const count = raw.replace(/\D/g, '').length
  if (count < 10 || count > 15) return `${label} needs 10 to 15 digits.`
  return null
}

function clockIssue(label: string, value: string) {
  return clockBroken(value) ? `${label} is not a clock time.` : null
}

function pairIssue(label: string, start: string, end: string) {
  const hasStart = start.trim() !== ''
  const hasEnd = end.trim() !== ''
  if (!hasStart && !hasEnd) return null
  if (clockBroken(start) || clockBroken(end) || !hasStart || !hasEnd) {
    return `${label} needs a real start and a real end.`
  }
  return null
}

/** Reasons this record should not be saved. Empty means the form is ready. */
export function recordIssues(
  form: Pick<Mosque, 'name' | 'address' | 'phone' | 'lat' | 'lng' | 'capacity' | 'timings' | 'nightTimings' | 'imamDetails' | 'moazzinDetails' | 'maghribOffsetMinutes'>,
  sessions: JumaSession[],
): string[] {
  const issues: string[] = []
  if (!form.name.trim()) issues.push('Add the mosque name.')
  else if (form.name.trim().length < 3) issues.push('The mosque name is too short.')
  if (!form.address.trim()) issues.push('Add the address.')

  const phone = mobileIssue('Phone', form.phone || '')
  if (phone) issues.push(phone)
  const imamMobile = mobileIssue('Imam mobile', form.imamDetails?.mobile || '')
  if (imamMobile) issues.push(imamMobile)
  const moazzinMobile = mobileIssue('Moazzin mobile', form.moazzinDetails?.mobile || '')
  if (moazzinMobile) issues.push(moazzinMobile)

  if (!Number.isFinite(form.lat) || form.lat < -90 || form.lat > 90) issues.push('Latitude must be between -90 and 90.')
  if (!Number.isFinite(form.lng) || form.lng < -180 || form.lng > 180) issues.push('Longitude must be between -180 and 180.')
  if (form.lat === 0 && form.lng === 0) issues.push('Set the map pin. 0, 0 is not a mosque.')
  if (!Number.isInteger(form.capacity) || form.capacity < 0 || form.capacity > 200000) {
    issues.push('Capacity must be a whole number up to 200000.')
  }

  let previous: { name: string; at: number } | null = null
  for (const prayer of PRAYERS) {
    const azan = form.timings?.[prayer]?.azan || ''
    const jamat = form.timings?.[prayer]?.jamat || ''
    const azanIssue = clockIssue(`${prayer} azan`, azan)
    const jamatIssue = clockIssue(`${prayer} jamat`, jamat)
    if (azanIssue) issues.push(azanIssue)
    if (jamatIssue) issues.push(jamatIssue)
    const azanAt = minutesOf(azan)
    const jamatAt = minutesOf(jamat)
    if (azanAt != null && jamatAt != null && jamatAt < azanAt) issues.push(`${prayer} jamat is before its azan.`)
    if (azanAt != null) {
      if (previous && azanAt <= previous.at) issues.push(`${prayer} azan is not after ${previous.name}.`)
      previous = { name: prayer, at: azanAt }
    }
  }

  sessions.forEach((session, index) => {
    const label = sessions.length > 1 ? `Juma ${index + 1}` : 'Juma'
    const fields: Array<[string, string]> = [
      ['azan', session.azan],
      ['khutbah', session.khutba],
      ['namaz', session.namaz],
    ]
    for (const [name, value] of fields) {
      const issue = clockIssue(`${label} ${name}`, value)
      if (issue) issues.push(issue)
    }
    const azan = minutesOf(session.azan)
    const khutbah = minutesOf(session.khutba)
    const namaz = minutesOf(session.namaz)
    if (azan != null && khutbah != null && khutbah < azan) issues.push(`${label} khutbah is before azan.`)
    if (khutbah != null && namaz != null && namaz < khutbah) issues.push(`${label} namaz is before the khutbah.`)
    if (azan != null && namaz != null && khutbah == null && namaz < azan) issues.push(`${label} namaz is before azan.`)
    for (const at of [azan, khutbah, namaz]) {
      if (at != null && (at < 10 * 60 + 30 || at > 15 * 60 + 30)) {
        issues.push(`${label} should sit between 10:30 AM and 3:30 PM.`)
        break
      }
    }
  })

  const tahajjud = pairIssue('Tahajjud', form.nightTimings?.tahajjud.start || '', form.nightTimings?.tahajjud.end || '')
  if (tahajjud) issues.push(tahajjud)
  const sehri = pairIssue('Sehri', form.nightTimings?.sehri.start || '', form.nightTimings?.sehri.end || '')
  if (sehri) issues.push(sehri)
  const iftar = clockIssue('Iftar', form.nightTimings?.iftar || '')
  if (iftar) issues.push(iftar)
  const offset = form.maghribOffsetMinutes
  if (offset != null && (!Number.isInteger(offset) || offset < 0 || offset > 45)) {
    issues.push('Maghrib minutes after sunset should be a whole number from 0 to 45.')
  }

  return issues
}
