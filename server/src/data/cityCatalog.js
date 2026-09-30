/**
 * Tier-1 + Mumbai metro cities for Aladhan / city picker / pin lookup.
 * Mosques may exist in any city; unknown cities still appear with AVG(lat/lng) from DB.
 *
 * pinCodes — representative / GPO pins for search UI
 * pinPrefixes — longest-first match for 6-digit India PIN lookup
 * bbox — south,west,north,east for OSM Overpass
 */
export const CITY_CATALOG = {
  'Navi Mumbai': {
    lat: 19.033,
    lng: 73.0297,
    pinCodes: ['400703', '400705', '400706', '400614', '410210'],
    pinPrefixes: ['40070', '40071', '40061', '41021'],
    bbox: '18.95,72.95,19.18,73.15',
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
  Thane: {
    lat: 19.2183,
    lng: 72.9781,
    pinCodes: ['400601', '400602', '400604', '400607'],
    pinPrefixes: ['40060', '40061', '40062'],
    bbox: '19.15,72.90,19.30,73.10',
    aliases: ['thane', 'thane west', 'thane east', 'kalwa', 'mumbra', 'diva'],
  },
  Mumbai: {
    lat: 19.076,
    lng: 72.8777,
    pinCodes: ['400001', '400050', '400070', '400076', '400092'],
    pinPrefixes: ['4000', '4001', '4002', '4003', '4004', '4005', '4008', '4009'],
    bbox: '18.89,72.77,19.27,72.98',
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
  Delhi: {
    lat: 28.6139,
    lng: 77.209,
    pinCodes: ['110001', '110002', '110006', '110013', '110016', '110025', '110048', '110055', '110092'],
    pinPrefixes: ['110'],
    bbox: '28.40,76.84,28.88,77.35',
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
  Kanpur: {
    lat: 26.4499,
    lng: 80.3319,
    pinCodes: ['208001', '208002', '208005', '208012', '208014', '208016'],
    pinPrefixes: ['208'],
    // Wider than core city — OSM tags are sparse in Kanpur
    bbox: '26.28,80.12,26.62,80.52',
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
  Lucknow: {
    lat: 26.8467,
    lng: 80.9462,
    pinCodes: ['226001', '226003', '226010', '226016'],
    pinPrefixes: ['226'],
    bbox: '26.75,80.85,26.95,81.05',
    aliases: ['lucknow', 'lko', 'hazratganj', 'aminabad'],
  },
  Hyderabad: {
    lat: 17.385,
    lng: 78.4867,
    pinCodes: ['500001', '500002', '500004', '500034'],
    pinPrefixes: ['500'],
    bbox: '17.25,78.30,17.55,78.60',
    aliases: ['hyderabad', 'secunderabad', 'charminar', 'old city hyderabad'],
  },
  Kolkata: {
    lat: 22.5726,
    lng: 88.3639,
    pinCodes: ['700001', '700016', '700017', '700071'],
    pinPrefixes: ['700'],
    bbox: '22.45,88.25,22.70,88.45',
    aliases: ['kolkata', 'calcutta', 'howrah', 'park circus'],
  },
  Bengaluru: {
    lat: 12.9716,
    lng: 77.5946,
    pinCodes: ['560001', '560025', '560034', '560068'],
    pinPrefixes: ['560'],
    bbox: '12.85,77.45,13.10,77.75',
    aliases: ['bengaluru', 'bangalore', 'whitefield', 'koramangala'],
  },
  Chennai: {
    lat: 13.0827,
    lng: 80.2707,
    pinCodes: ['600001', '600005', '600014', '600028'],
    pinPrefixes: ['600'],
    bbox: '12.95,80.15,13.20,80.35',
    aliases: ['chennai', 'madras', 'triplicane', 'royapettah'],
  },
  Patna: {
    lat: 25.5941,
    lng: 85.1376,
    pinCodes: ['800001', '800007', '800020'],
    pinPrefixes: ['800'],
    bbox: '25.55,85.05,25.70,85.25',
    aliases: ['patna', 'patna city', 'patna sahib'],
  },
  Ahmedabad: {
    lat: 23.0225,
    lng: 72.5714,
    pinCodes: ['380001', '380006', '380015', '380054'],
    pinPrefixes: ['380'],
    bbox: '22.95,72.45,23.15,72.70',
    aliases: ['ahmedabad', 'amdavad', 'ahmadabad', 'sarkhej'],
  },
}

/** Ordered list of catalog city names (Tier 1 + Navi Mumbai + Thane). */
export function listCatalogCities() {
  return Object.keys(CITY_CATALOG).map((name) => ({
    name,
    ...CITY_CATALOG[name],
    id: cityIdFromName(name),
  }))
}

export function catalogEntry(cityName) {
  if (!cityName) return null
  const raw = String(cityName).trim()
  const exact = Object.keys(CITY_CATALOG).find((k) => k.toLowerCase() === raw.toLowerCase())
  if (exact) return { name: exact, ...CITY_CATALOG[exact] }

  const haystack = raw.toLowerCase()
  let best = null
  let bestLen = 0
  for (const [name, meta] of Object.entries(CITY_CATALOG)) {
    for (const alias of meta.aliases || []) {
      if (haystack.includes(alias) && alias.length > bestLen) {
        best = { name, ...meta }
        bestLen = alias.length
      }
    }
  }
  return best
}

/** Resolve an Indian 6-digit PIN to a catalog city (exact pin, then longest prefix). */
export function catalogCityByPincode(rawPin) {
  const pin = String(rawPin || '').replace(/\D/g, '')
  if (pin.length < 3) return null

  for (const [name, meta] of Object.entries(CITY_CATALOG)) {
    if ((meta.pinCodes || []).includes(pin)) {
      return { name, ...meta, id: cityIdFromName(name), matchedPin: pin }
    }
  }

  let best = null
  let bestLen = 0
  for (const [name, meta] of Object.entries(CITY_CATALOG)) {
    for (const prefix of meta.pinPrefixes || []) {
      if (pin.startsWith(prefix) && prefix.length > bestLen) {
        best = { name, ...meta, id: cityIdFromName(name), matchedPin: pin }
        bestLen = prefix.length
      }
    }
  }
  return best
}

export function cityIdFromName(name) {
  return String(name || 'unknown')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
}
