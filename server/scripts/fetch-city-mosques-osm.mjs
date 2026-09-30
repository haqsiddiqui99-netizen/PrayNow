/**
 * Fetch mosques for one or more catalog cities from OpenStreetMap → server/data/<city>-mosques-osm.json
 *
 * Usage:
 *   node server/scripts/fetch-city-mosques-osm.mjs Kanpur
 *   node server/scripts/fetch-city-mosques-osm.mjs --all
 *   node server/scripts/fetch-city-mosques-osm.mjs Mumbai Lucknow
 *
 * Note: OSM coverage varies; jamat times are NOT available from OSM.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CITY_CATALOG, cityIdFromName } from '../src/data/cityCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const UA = 'PrayNow/1.0 (mosque finder; contact: praynow-local-dev)'

function pickName(tags = {}) {
  return (
    tags['name:en'] ||
    tags.name ||
    tags['name:hi'] ||
    tags['name:ur'] ||
    tags.alt_name ||
    null
  )
}

function pickAddress(tags = {}, city) {
  if (tags['addr:full']) return String(tags['addr:full']).trim()
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'],
    tags['addr:city'] || city,
  ].filter(Boolean)
  if (parts.length) return parts.join(', ')
  if (tags['addr:place']) return `${tags['addr:place']}, ${city}`
  return `${city}, India`
}

function pickArea(tags = {}, city) {
  return (
    tags['addr:suburb'] ||
    tags['addr:neighbourhood'] ||
    tags['addr:district'] ||
    tags['addr:city'] ||
    tags['addr:place'] ||
    city
  )
}

function coordsOf(el) {
  if (el.type === 'node' && el.lat != null && el.lon != null) {
    return { lat: el.lat, lng: el.lon }
  }
  if (el.center?.lat != null && el.center?.lon != null) {
    return { lat: el.center.lat, lng: el.center.lon }
  }
  return null
}

function roundCoord(n) {
  return Math.round(Number(n) * 1e4) / 1e4
}

function normalizeKey(name, lat, lng) {
  return `${String(name).toLowerCase().replace(/\s+/g, ' ').trim()}|${roundCoord(lat)}|${roundCoord(lng)}`
}

function pickPhone(tags = {}) {
  return (
    tags.phone ||
    tags['contact:phone'] ||
    tags['contact:mobile'] ||
    tags.mobile ||
    tags['phone:mobile'] ||
    ''
  )
}

function pickSect(tags = {}) {
  const raw = String(tags.denomination || tags['religion:denomination'] || '').toLowerCase()
  if (!raw) return ''
  if (raw.includes('shia') || raw.includes('shiite') || raw.includes("shi'a")) return 'Shia'
  if (raw.includes('sunni')) return 'Sunni'
  return tags.denomination || tags['religion:denomination'] || ''
}

function buildQuery(bbox) {
  // Broad query: religion=muslim, building=mosque, and name matches masjid/mosque/jama
  // (helps cities like Kanpur where OSM tagging is incomplete).
  return `
[out:json][timeout:240];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](${bbox});
  way["amenity"="place_of_worship"]["religion"="muslim"](${bbox});
  relation["amenity"="place_of_worship"]["religion"="muslim"](${bbox});
  node["building"="mosque"](${bbox});
  way["building"="mosque"](${bbox});
  relation["building"="mosque"](${bbox});
  node["amenity"="place_of_worship"]["name"~"[Mm]asjid|[Mm]osque|[Jj]ama|[Jj]ameh",i](${bbox});
  way["amenity"="place_of_worship"]["name"~"[Mm]asjid|[Mm]osque|[Jj]ama|[Jj]ameh",i](${bbox});
  relation["amenity"="place_of_worship"]["name"~"[Mm]asjid|[Mm]osque|[Jj]ama|[Jj]ameh",i](${bbox});
  node["name"~"[Mm]asjid|[Mm]osque"]["amenity"!="restaurant"]["shop"!~"."](${bbox});
  way["name"~"[Mm]asjid|[Mm]osque"]["amenity"!="restaurant"]["shop"!~"."](${bbox});
);
out center tags;
`.trim()
}

async function fetchOverpass(bbox) {
  if (process.env.OSM_TLS_INSECURE === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  const query = buildQuery(bbox)
  let lastErr
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  Querying ${url} …`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      return res.json()
    } catch (e) {
      lastErr = e
      console.warn(`  failed: ${e instanceof Error ? e.message : e}`)
      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        console.warn('  retrying with NODE_TLS_REJECT_UNAUTHORIZED=0 …')
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
              'User-Agent': UA,
            },
            body: `data=${encodeURIComponent(query)}`,
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
          return res.json()
        } catch (e2) {
          lastErr = e2
          console.warn(`  retry failed: ${e2 instanceof Error ? e2.message : e2}`)
        }
      }
    }
  }
  throw lastErr || new Error('All Overpass endpoints failed')
}

function looksLikeMosque(tags = {}) {
  if (tags.religion === 'muslim' || tags.building === 'mosque') return true
  const name = String(pickName(tags) || '').toLowerCase()
  if (/masjid|mosque|jama\b|jameh|dargah/.test(name)) return true
  return false
}

function mapElements(elements, city) {
  const seen = new Set()
  const mosques = []

  for (const el of elements || []) {
    const tags = el.tags || {}
    if (!looksLikeMosque(tags)) continue
    // Skip clear non-mosque worship sites pulled by name regex
    const religion = String(tags.religion || '').toLowerCase()
    if (religion && religion !== 'muslim' && tags.building !== 'mosque') continue

    let name = pickName(tags)
    if (!name && tags.building === 'mosque') name = 'Mosque'
    if (!name) continue
    const coords = coordsOf(el)
    if (!coords) continue

    const key = normalizeKey(name, coords.lat, coords.lng)
    if (seen.has(key)) continue
    seen.add(key)

    const lat = Number(coords.lat)
    const lng = Number(coords.lng)
    const phone = String(pickPhone(tags) || '').trim()
    const sect = String(pickSect(tags) || '').trim()
    const website = String(tags.website || tags['contact:website'] || '').trim()
    const postcode = String(tags['addr:postcode'] || tags.postal_code || '').trim()

    const row = {
      legacy_id: `osm-${el.type}-${el.id}`,
      name: name.trim(),
      address: pickAddress(tags, city),
      area: String(pickArea(tags, city)).trim(),
      city,
      phone,
      lat,
      lng,
      mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
      source: 'openstreetmap',
      osmType: el.type,
      osmId: el.id,
    }
    if (sect && /^(sunni|shia)/i.test(sect)) row.sect = sect
    if (website) row.website = website
    if (postcode) row.pinCode = postcode
    mosques.push(row)
  }

  mosques.sort((a, b) => a.name.localeCompare(b.name))
  return mosques
}

function resolveCities(argv) {
  if (argv.includes('--all')) return Object.keys(CITY_CATALOG)
  const names = argv.filter((a) => !a.startsWith('--'))
  if (!names.length) {
    throw new Error('Usage: node fetch-city-mosques-osm.mjs <City> | --all')
  }
  return names.map((raw) => {
    const hit = Object.keys(CITY_CATALOG).find((k) => k.toLowerCase() === raw.toLowerCase())
    if (!hit) throw new Error(`Unknown city "${raw}". Known: ${Object.keys(CITY_CATALOG).join(', ')}`)
    return hit
  })
}

async function fetchCity(city) {
  const meta = CITY_CATALOG[city]
  if (!meta?.bbox) throw new Error(`No bbox for ${city}`)
  console.log(`\n=== ${city} (bbox ${meta.bbox}) ===`)
  const json = await fetchOverpass(meta.bbox)
  const mosques = mapElements(json.elements, city)
  const out = path.join(DATA_DIR, `${cityIdFromName(city)}-mosques-osm.json`)
  const payload = {
    city,
    fetchedAt: new Date().toISOString(),
    source: 'OpenStreetMap Overpass',
    bbox: meta.bbox,
    pinCodes: meta.pinCodes || [],
    count: mosques.length,
    mosques,
  }
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Wrote ${out} (${mosques.length} mosques)`)
  return { city, count: mosques.length, out }
}

async function main() {
  const cities = resolveCities(process.argv.slice(2))
  const results = []
  for (const city of cities) {
    try {
      results.push(await fetchCity(city))
      await new Promise((r) => setTimeout(r, 1500))
    } catch (err) {
      console.error(`FAIL ${city}:`, err instanceof Error ? err.message : err)
      results.push({ city, count: 0, error: String(err) })
    }
  }
  console.log('\nSummary:')
  for (const r of results) {
    console.log(`  ${r.city}: ${r.error ? `ERROR ${r.error}` : r.count}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
