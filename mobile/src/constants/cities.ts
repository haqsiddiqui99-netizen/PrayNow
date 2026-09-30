export interface SupportedCity {
  id: string
  name: string
  country: string
  lat: number
  lng: number
  /** Substrings that match reverse-geocode city/area names */
  aliases: string[]
  /** Representative / GPO pin codes shown in the city picker */
  pinCodes: string[]
  /** Longest-first PIN prefixes for 6-digit India PIN lookup */
  pinPrefixes: string[]
}

/**
 * Tier-1 launch cities + Mumbai metro split (Navi Mumbai, Thane).
 * Runtime list from GET /api/cities merges with mosque cities.
 */
export const SUPPORTED_CITIES: SupportedCity[] = [
  {
    id: 'navi-mumbai',
    name: 'Navi Mumbai',
    country: 'India',
    lat: 19.033,
    lng: 73.0297,
    pinCodes: ['400703', '400705', '400706', '400614', '410210'],
    pinPrefixes: ['40070', '40071', '40061', '41021'],
    aliases: [
      'navi mumbai',
      'new mumbai',
      'vashi',
      'nerul',
      'belapur',
      'kharghar',
      'panvel',
      'airoli',
      'ghansoli',
    ],
  },
  {
    id: 'thane',
    name: 'Thane',
    country: 'India',
    lat: 19.2183,
    lng: 72.9781,
    pinCodes: ['400601', '400602', '400604', '400607'],
    pinPrefixes: ['40060', '40061', '40062'],
    aliases: ['thane', 'thane west', 'thane east', 'kalwa', 'mumbra', 'diva'],
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'India',
    lat: 19.076,
    lng: 72.8777,
    pinCodes: ['400001', '400050', '400070', '400076', '400092'],
    pinPrefixes: ['4000', '4001', '4002', '4003', '4004', '4005', '4008', '4009'],
    aliases: [
      'mumbai',
      'bombay',
      'south mumbai',
      'andheri',
      'bandra',
      'kurla',
      'dadar',
      'byculla',
      'worli',
      'powai',
    ],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lng: 77.209,
    pinCodes: ['110001', '110002', '110006', '110013', '110016', '110025', '110048', '110055', '110092'],
    pinPrefixes: ['110'],
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
  {
    id: 'kanpur',
    name: 'Kanpur',
    country: 'India',
    lat: 26.4499,
    lng: 80.3319,
    pinCodes: ['208001', '208002', '208005', '208012', '208014', '208016'],
    pinPrefixes: ['208'],
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
      'anwar ganj',
      'juhi',
      'fahimabad',
    ],
  },
  {
    id: 'lucknow',
    name: 'Lucknow',
    country: 'India',
    lat: 26.8467,
    lng: 80.9462,
    pinCodes: ['226001', '226003', '226010', '226016'],
    pinPrefixes: ['226'],
    aliases: ['lucknow', 'lko', 'hazratganj', 'aminabad'],
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    country: 'India',
    lat: 17.385,
    lng: 78.4867,
    pinCodes: ['500001', '500002', '500004', '500034'],
    pinPrefixes: ['500'],
    aliases: ['hyderabad', 'secunderabad', 'charminar', 'old city hyderabad'],
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    country: 'India',
    lat: 22.5726,
    lng: 88.3639,
    pinCodes: ['700001', '700016', '700017', '700071'],
    pinPrefixes: ['700'],
    aliases: ['kolkata', 'calcutta', 'howrah', 'park circus'],
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    country: 'India',
    lat: 12.9716,
    lng: 77.5946,
    pinCodes: ['560001', '560025', '560034', '560068'],
    pinPrefixes: ['560'],
    aliases: ['bengaluru', 'bangalore', 'whitefield', 'koramangala'],
  },
  {
    id: 'chennai',
    name: 'Chennai',
    country: 'India',
    lat: 13.0827,
    lng: 80.2707,
    pinCodes: ['600001', '600005', '600014', '600028'],
    pinPrefixes: ['600'],
    aliases: ['chennai', 'madras', 'triplicane', 'royapettah'],
  },
  {
    id: 'patna',
    name: 'Patna',
    country: 'India',
    lat: 25.5941,
    lng: 85.1376,
    pinCodes: ['800001', '800007', '800020'],
    pinPrefixes: ['800'],
    aliases: ['patna', 'patna city', 'patna sahib'],
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    country: 'India',
    lat: 23.0225,
    lng: 72.5714,
    pinCodes: ['380001', '380006', '380015', '380054'],
    pinPrefixes: ['380'],
    aliases: ['ahmedabad', 'amdavad', 'ahmadabad', 'sarkhej'],
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

/** Prefer longest alias match so "Navi Mumbai" wins over "Mumbai". */
export function resolveSupportedCity(city?: string, region?: string): SupportedCity | null {
  const haystack = normalizeCityToken(`${city ?? ''} ${region ?? ''}`)
  if (!haystack.trim()) return null

  let best: SupportedCity | null = null
  let bestLen = 0
  for (const supported of getSupportedCities()) {
    for (const alias of supported.aliases) {
      if (haystack.includes(alias) && alias.length > bestLen) {
        best = supported
        bestLen = alias.length
      }
    }
  }
  return best
}

/** Resolve Indian PIN (6 digits or partial) to a supported city. */
export function resolveCityByPincode(rawPin: string): SupportedCity | null {
  const pin = String(rawPin || '').replace(/\D/g, '')
  if (pin.length < 3) return null

  for (const city of getSupportedCities()) {
    if ((city.pinCodes || []).includes(pin)) return city
  }

  let best: SupportedCity | null = null
  let bestLen = 0
  for (const city of getSupportedCities()) {
    for (const prefix of city.pinPrefixes || []) {
      if (pin.startsWith(prefix) && prefix.length > bestLen) {
        best = city
        bestLen = prefix.length
      }
    }
  }
  return best
}

export function mosqueBelongsToCity(mosqueCity: string | undefined, supported: SupportedCity): boolean {
  const normalized = normalizeCityToken(mosqueCity || '')
  if (!normalized) return false
  if (normalized === normalizeCityToken(supported.name) || normalized === supported.id.replace(/-/g, ' ')) {
    return true
  }
  return supported.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
}

export function supportedCityNames(): string {
  return getSupportedCities()
    .map((c) => c.name)
    .join(', ')
}
