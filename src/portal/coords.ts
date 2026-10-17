export type LatLng = { lat: number; lng: number }

const NUMBER = '(-?\\d+(?:\\.\\d+)?)'

function round6(value: number) {
  return Math.round(value * 1e6) / 1e6
}

function inRange(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat: round6(lat), lng: round6(lng) }
}

function decoded(text: string) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Finds a latitude and longitude in pasted text. Understands "23.0088, 72.5757" (what Google Maps copies
 * on right-click) and Google Maps links, where the place pin (!3d..!4d) wins over the view centre (@..).
 */
export function parseCoordinates(text: string): LatLng | null {
  const raw = decoded(text.trim())
  if (!raw) return null
  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
    new RegExp(`@${NUMBER},${NUMBER}`),
    new RegExp(`[?&](?:q|ll|query|center|destination)=${NUMBER}\\s*,\\s*${NUMBER}`, 'i'),
    new RegExp(`^${NUMBER}\\s*[,;\\s]\\s*${NUMBER}$`),
  ]
  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (!match) continue
    const found = inRange(Number(match[1]), Number(match[2]))
    if (found) return found
  }
  return null
}

export function mapsLink({ lat, lng }: LatLng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
