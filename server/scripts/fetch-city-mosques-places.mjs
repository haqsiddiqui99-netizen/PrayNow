/**
 * Fetch mosques for catalog cities via Google Places API (New).
 * Writes server/data/<city>-mosques-places.json (same shape as OSM import files).
 *
 * Requires: GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) with Places API (New) enabled.
 *
 * Usage:
 *   node server/scripts/fetch-city-mosques-places.mjs Kanpur
 *   node server/scripts/fetch-city-mosques-places.mjs --all
 *   node server/scripts/fetch-city-mosques-places.mjs Mumbai --grid
 *
 * Notes:
 * - Uses Text Search ("mosque" / "masjid" in city) + optional Nearby Search grid.
 * - Does NOT invent jamat times / capacity / sect.
 * - Respect Google Places ToS for caching/display in production.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { CITY_CATALOG, cityIdFromName } from '../src/data/cityCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')
dotenv.config({ path: path.join(__dirname, '../.env') })

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
const PLACE_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.shortFormattedAddress',
].join(',')
const TEXT_FIELD_MASK = `${PLACE_FIELDS},nextPageToken`
const NEARBY_FIELD_MASK = PLACE_FIELDS

function parseBbox(bbox) {
  const [south, west, north, east] = String(bbox).split(',').map(Number)
  if (![south, west, north, east].every(Number.isFinite)) {
    throw new Error(`Invalid bbox: ${bbox}`)
  }
  return { south, west, north, east }
}

function resolveCities(argv) {
  if (argv.includes('--all')) return Object.keys(CITY_CATALOG)
  const names = argv.filter((a) => !a.startsWith('--'))
  if (!names.length) throw new Error('Usage: node fetch-city-mosques-places.mjs <City> | --all')
  return names.map((raw) => {
    const hit = Object.keys(CITY_CATALOG).find((k) => k.toLowerCase() === raw.toLowerCase())
    if (!hit) throw new Error(`Unknown city "${raw}"`)
    return hit
  })
}

function roundCoord(n) {
  return Math.round(Number(n) * 1e5) / 1e5
}

function normalizeKey(name, lat, lng) {
  return `${String(name).toLowerCase().replace(/\s+/g, ' ').trim()}|${roundCoord(lat)}|${roundCoord(lng)}`
}

function looksLikeMosque(place) {
  const types = place.types || []
  if (types.includes('mosque')) return true
  const name = String(place.displayName?.text || '').toLowerCase()
  return /masjid|mosque|jama\b|jameh|dargah|eidgah/.test(name)
}

function mapPlace(place, city) {
  const lat = place.location?.latitude
  const lng = place.location?.longitude
  if (lat == null || lng == null) return null
  const name = String(place.displayName?.text || '').trim()
  if (!name) return null
  if (!looksLikeMosque(place)) return null

  const phone = String(place.nationalPhoneNumber || place.internationalPhoneNumber || '').trim()
  const address = String(place.formattedAddress || place.shortFormattedAddress || `${city}, India`).trim()
  const area =
    address
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-3, -1)[0] || city

  const row = {
    legacy_id: place.id ? `places-${place.id.replace(/\//g, '-')}` : `places-${roundCoord(lat)}-${roundCoord(lng)}`,
    name,
    address,
    area,
    city,
    phone,
    lat: Number(lat),
    lng: Number(lng),
    mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
    source: 'google_places',
    placeId: place.id || '',
  }
  if (place.websiteUri) row.website = place.websiteUri
  return row
}

async function placesPost(url, body, fieldMask = TEXT_FIELD_MASK) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Places HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) {
    throw new Error(`Places HTTP ${res.status}: ${JSON.stringify(json.error || json).slice(0, 400)}`)
  }
  return json
}

async function searchTextAll(city, meta) {
  const { south, west, north, east } = parseBbox(meta.bbox)
  const queries = [`mosque in ${city}`, `masjid in ${city}`, `jama masjid ${city}`]
  const collected = []

  for (const textQuery of queries) {
    let pageToken = ''
    for (let page = 0; page < 3; page += 1) {
      const body = {
        textQuery,
        languageCode: 'en',
        regionCode: 'IN',
        pageSize: 20,
        locationRestriction: {
          rectangle: {
            low: { latitude: south, longitude: west },
            high: { latitude: north, longitude: east },
          },
        },
      }
      if (pageToken) body.pageToken = pageToken

      console.log(`  TextSearch "${textQuery}" page ${page + 1}…`)
      const json = await placesPost('https://places.googleapis.com/v1/places:searchText', body)
      collected.push(...(json.places || []))
      pageToken = json.nextPageToken || ''
      if (!pageToken) break
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  return collected
}

function gridCenters(bbox, stepDeg = 0.04) {
  const { south, west, north, east } = parseBbox(bbox)
  const points = []
  for (let lat = south + stepDeg / 2; lat < north; lat += stepDeg) {
    for (let lng = west + stepDeg / 2; lng < east; lng += stepDeg) {
      points.push({ lat, lng })
    }
  }
  return points
}

async function searchNearbyGrid(city, meta) {
  const centers = gridCenters(meta.bbox, 0.045)
  console.log(`  Nearby grid: ${centers.length} cells…`)
  const collected = []
  for (let i = 0; i < centers.length; i += 1) {
    const c = centers[i]
    const body = {
      includedTypes: ['mosque'],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      languageCode: 'en',
      regionCode: 'IN',
      locationRestriction: {
        circle: {
          center: { latitude: c.lat, longitude: c.lng },
          radius: 3500.0,
        },
      },
    }
    try {
      const json = await placesPost(
        'https://places.googleapis.com/v1/places:searchNearby',
        body,
        NEARBY_FIELD_MASK,
      )
      collected.push(...(json.places || []))
      if ((i + 1) % 5 === 0) console.log(`    cell ${i + 1}/${centers.length} (places so far ${collected.length})`)
    } catch (err) {
      console.warn(`    cell ${i + 1} failed:`, err instanceof Error ? err.message : err)
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return collected
}

function dedupe(places, city) {
  const seen = new Set()
  const mosques = []
  for (const place of places) {
    const row = mapPlace(place, city)
    if (!row) continue
    const key = normalizeKey(row.name, row.lat, row.lng)
    if (seen.has(key)) continue
    seen.add(key)
    mosques.push(row)
  }
  mosques.sort((a, b) => a.name.localeCompare(b.name))
  return mosques
}

async function fetchCity(city, { useGrid }) {
  const meta = CITY_CATALOG[city]
  if (!meta?.bbox) throw new Error(`No bbox for ${city}`)
  console.log(`\n=== ${city} (Places) ===`)

  const raw = []
  raw.push(...(await searchTextAll(city, meta)))
  if (useGrid) raw.push(...(await searchNearbyGrid(city, meta)))

  const mosques = dedupe(raw, city)
  const out = path.join(DATA_DIR, `${cityIdFromName(city)}-mosques-places.json`)
  const payload = {
    city,
    fetchedAt: new Date().toISOString(),
    source: 'Google Places API (New)',
    bbox: meta.bbox,
    pinCodes: meta.pinCodes || [],
    count: mosques.length,
    mosques,
  }
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Wrote ${out} (${mosques.length} mosques)`)
  if (mosques[0]) console.log('Sample:', mosques[0].name, mosques[0].address)
  return { city, count: mosques.length, out }
}

async function main() {
  if (!API_KEY) {
    throw new Error(
      'Missing GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY). Enable Places API (New) in Google Cloud and set the key.',
    )
  }

  const argv = process.argv.slice(2)
  const useGrid = argv.includes('--grid') || argv.includes('--all')
  const cities = resolveCities(argv)
  const results = []
  for (const city of cities) {
    try {
      results.push(await fetchCity(city, { useGrid: useGrid || city === 'Kanpur' }))
    } catch (err) {
      console.error(`FAIL ${city}:`, err instanceof Error ? err.message : err)
      results.push({ city, count: 0, error: String(err) })
    }
  }
  console.log('\nSummary:')
  for (const r of results) console.log(`  ${r.city}: ${r.error || r.count}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
