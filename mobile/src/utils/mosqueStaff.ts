import type { Mosque, PersonContact } from '@/src/types'

function hasName(person: PersonContact | null | undefined) {
  return Boolean(person?.name?.trim())
}

function normalizePerson(raw: Partial<PersonContact> | null | undefined): PersonContact | null {
  if (!raw?.name?.trim()) return null
  return {
    name: raw.name.trim(),
    mobile: raw.mobile?.trim() || '',
    photo: raw.photo?.trim() || '',
  }
}

function dedupeStaff(list: PersonContact[]) {
  const seen = new Set<string>()
  const out: PersonContact[] = []
  for (const person of list) {
    const key = `${person.name.toLowerCase()}|${person.mobile}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(person)
  }
  return out
}

function withMosquePhoneFallback(mobile: string, mosque: Mosque, index: number) {
  if (mobile?.trim()) return mobile.trim()
  return index === 0 ? mosque.phone?.trim() || '' : ''
}

/** Imam list — prefers `imams[]`, falls back to legacy single imam fields. */
export function getMosqueImams(mosque: Mosque): PersonContact[] {
  const fromList = (mosque.imams ?? [])
    .map((person) => normalizePerson(person))
    .filter((person): person is PersonContact => person !== null)
    .map((person, index) => ({
      ...person,
      mobile: withMosquePhoneFallback(person.mobile, mosque, index),
    }))

  if (fromList.length > 0) return dedupeStaff(fromList)

  const legacy: PersonContact[] = []
  const imamName = mosque.imam?.trim() || mosque.imamDetails?.name?.trim() || ''
  if (imamName) {
    legacy.push({
      name: imamName,
      mobile: withMosquePhoneFallback(mosque.imamDetails?.mobile || '', mosque, 0),
      photo: mosque.imamDetails?.photo?.trim() || '',
    })
  }
  return dedupeStaff(legacy)
}

/** Mo'azzin list — prefers `moazzins[]`, falls back to legacy single moazzin fields. */
export function getMosqueMoazzins(mosque: Mosque): PersonContact[] {
  const fromList = (mosque.moazzins ?? [])
    .map((person) => normalizePerson(person))
    .filter((person): person is PersonContact => person !== null)

  if (fromList.length > 0) return dedupeStaff(fromList)

  if (hasName(mosque.moazzinDetails)) return [mosque.moazzinDetails]
  return []
}
