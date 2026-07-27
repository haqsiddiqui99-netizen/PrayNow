export interface SupportedCity {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  /** Substrings that match reverse-geocode city/area names */
  aliases: string[]
}

/** Cities with mosque data in the app — expand via API in production */
export const SUPPORTED_CITIES: SupportedCity[] = [
  {
    id: 'kanpur',
    name: 'Kanpur',
    country: 'India',
    lat: 26.4499,
    lng: 80.3319,
    aliases: [
      'kanpur',
      'cawnpore',
      'kanpur nagar',
      'kanpur dehat',
      'kalyanpur',
      'govind nagar',
      'kakadeo',
      'rawatpur',
      'panki',
      'barrah',
    ],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lng: 77.209,
    aliases: [
      'delhi',
      'new delhi',
      'noida',
      'gurgaon',
      'gurugram',
      'ghaziabad',
      'faridabad',
      'dwarka',
      'rohini',
      'saket',
      'chandni chowk',
      'nizamuddin',
    ],
  },
]

let runtimeSupportedCities: SupportedCity[] | null = null

export function setRuntimeSupportedCities(cities: SupportedCity[]) {
  runtimeSupportedCities = cities.length > 0 ? cities : null
}

export function getSupportedCities(): SupportedCity[] {
  return runtimeSupportedCities ?? SUPPORTED_CITIES
}

export function normalizeCityToken(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function resolveSupportedCity(city?: string, region?: string): SupportedCity | null {
  const haystack = normalizeCityToken(`${city ?? ''} ${region ?? ''}`)
  if (!haystack.trim()) return null

  for (const supported of getSupportedCities()) {
    if (supported.aliases.some((alias) => haystack.includes(alias))) {
      return supported
    }
  }
  return null
}

export function mosqueBelongsToCity(mosqueCity: string | undefined, supported: SupportedCity): boolean {
  const normalized = normalizeCityToken(mosqueCity || supported.name)
  return (
    normalized.includes(supported.id) ||
    supported.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  )
}

export function supportedCityNames(): string {
  return getSupportedCities().map((c) => c.name).join(', ')
}
