/**
 * Fetch Delhi mosques from OpenStreetMap (Overpass) → server/data/delhi-mosques-osm.json
 *
 * Usage: node server/scripts/fetch-delhi-mosques-osm.mjs
 *
 * Note: OSM coverage varies; jamat times are NOT available from OSM.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../data/delhi-mosques-osm.json')

/** NCT Delhi-ish bounding box: south,west,north,east */
const BBOX = '28.40,76.84,28.88,77.35'

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const UA = 'PrayNow/1.0 (mosque finder; contact: praynow-local-dev)'

const QUERY = `
[out:json][timeout:180];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](${BBOX});
  way["amenity"="place_of_worship"]["religion"="muslim"](${BBOX});
  relation["amenity"="place_of_worship"]["religion"="muslim"](${BBOX});
  node["building"="mosque"](${BBOX});
  way["building"="mosque"](${BBOX});
  relation["building"="mosque"](${BBOX});
);
out center tags;
`.trim()

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

function pickAddress(tags = {}) {
  if (tags['addr:full']) return String(tags['addr:full']).trim()
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'],
    tags['addr:city'] || 'Delhi',
  ].filter(Boolean)
  if (parts.length) return parts.join(', ')
  if (tags['addr:place']) return `${tags['addr:place']}, Delhi`
  return 'Delhi, India'
}

function pickArea(tags = {}) {
  return (
    tags['addr:suburb'] ||
    tags['addr:neighbourhood'] ||
    tags['addr:district'] ||
    tags['addr:city'] ||
    tags['addr:place'] ||
    'Delhi'
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

async function fetchOverpass() {
  // Corporate proxies often break public TLS; allow override like Aladhan scripts.
  if (process.env.OSM_TLS_INSECURE === 'true' || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  let lastErr
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Querying ${url} …`)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': UA,
        },
        body: `data=${encodeURIComponent(QUERY)}`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      return res.json()
    } catch (e) {
      lastErr = e
      console.warn(`  failed: ${e instanceof Error ? e.message : e}`)
      // Retry once with TLS verify disabled (common on corporate Windows)
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
            body: `data=${encodeURIComponent(QUERY)}`,
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
  if (raw.includes('shia') || raw.includes('shiite') || raw.includes('shi\'a')) return 'Shia'
  if (raw.includes('sunni')) return 'Sunni'
  // Keep OSM denomination text when it's something else (e.g. ahmadiyya) — not invented.
  return tags.denomination || tags['religion:denomination'] || ''
}

function mapElements(elements) {
  const seen = new Set()
  const mosques = []

  for (const el of elements || []) {
    const tags = el.tags || {}
    const name = pickName(tags)
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

    /** Real fields only — no invented capacity / facilities / photos / language. */
    const row = {
      legacy_id: `osm-${el.type}-${el.id}`,
      name: name.trim(),
      address: pickAddress(tags),
      area: String(pickArea(tags)).trim(),
      city: 'Delhi',
      phone,
      lat,
      lng,
      mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
      source: 'openstreetmap',
      osmType: el.type,
      osmId: el.id,
    }
    if (sect) row.sect = sect
    if (website) row.website = website
    mosques.push(row)
  }

  mosques.sort((a, b) => a.name.localeCompare(b.name))
  return mosques
}

async function main() {
  const json = await fetchOverpass()
  const mosques = mapElements(json.elements)
  const payload = {
    city: 'Delhi',
    fetchedAt: new Date().toISOString(),
    source: 'OpenStreetMap Overpass',
    bbox: BBOX,
    count: mosques.length,
    mosques,
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`Wrote ${OUT}`)
  console.log(`Mosques: ${mosques.length}`)
  if (mosques[0]) console.log('Sample:', mosques[0].name, mosques[0].lat, mosques[0].lng, mosques[0].mapsUrl)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
