/**
 * Known city metadata used to enrich GET /api/cities (aliases + fallback coords).
 * Mosques may exist in any city; unknown cities still appear with AVG(lat/lng).
 */
export const CITY_CATALOG = {
  Kanpur: {
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
      'anwar ganj',
      'juhi',
      'fahimabad',
    ],
  },
  Delhi: {
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
  Lucknow: {
    lat: 26.8467,
    lng: 80.9462,
    aliases: ['lucknow', 'lko'],
  },
  Mumbai: {
    lat: 19.076,
    lng: 72.8777,
    aliases: ['mumbai', 'bombay', 'thane', 'navi mumbai'],
  },
  Hyderabad: {
    lat: 17.385,
    lng: 78.4867,
    aliases: ['hyderabad', 'secunderabad'],
  },
  Bengaluru: {
    lat: 12.9716,
    lng: 77.5946,
    aliases: ['bengaluru', 'bangalore'],
  },
  Kolkata: {
    lat: 22.5726,
    lng: 88.3639,
    aliases: ['kolkata', 'calcutta'],
  },
  Chennai: {
    lat: 13.0827,
    lng: 80.2707,
    aliases: ['chennai', 'madras'],
  },
}

export function catalogEntry(cityName) {
  if (!cityName) return null
  const key = Object.keys(CITY_CATALOG).find((k) => k.toLowerCase() === String(cityName).toLowerCase())
  return key ? { name: key, ...CITY_CATALOG[key] } : null
}

export function cityIdFromName(name) {
  return String(name || 'unknown')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
}
