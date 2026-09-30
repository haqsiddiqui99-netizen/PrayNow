/**
 * Import mosque JSON (OSM and/or Google Places) for catalog cities into the running API.
 * Real fields only — no dummy capacity / sect / facilities / jamat.
 *
 * Usage:
 *   node server/scripts/import-city-mosques-osm.mjs Kanpur
 *   node server/scripts/import-city-mosques-osm.mjs --all
 *   node server/scripts/import-city-mosques-osm.mjs Kanpur --source=places
 *   node server/scripts/import-city-mosques-osm.mjs --all --limit=30
 *
 * Sources (default: all available files for the city):
 *   --source=places | osm | all
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CITY_CATALOG, cityIdFromName } from '../src/data/cityCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')
const API = process.env.API_URL || 'http://127.0.0.1:5000'

function parseLimit(argv) {
  const arg = argv.find((a) => a.startsWith('--limit='))
  if (!arg) return null
  const n = Number(arg.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function resolveCities(argv) {
  if (argv.includes('--all')) return Object.keys(CITY_CATALOG)
  const names = argv.filter((a) => !a.startsWith('--'))
  if (!names.length) throw new Error('Usage: node import-city-mosques-osm.mjs <City> | --all')
  return names.map((raw) => {
    const hit = Object.keys(CITY_CATALOG).find((k) => k.toLowerCase() === raw.toLowerCase())
    if (!hit) throw new Error(`Unknown city "${raw}"`)
    return hit
  })
}

function dataFiles(city, source = 'all') {
  const id = cityIdFromName(city)
  const candidates = []
  if (source === 'all' || source === 'places') {
    candidates.push(path.join(DATA_DIR, `${id}-mosques-places.json`))
  }
  if (source === 'all' || source === 'osm') {
    candidates.push(path.join(DATA_DIR, `${id}-mosques-osm.json`))
    if (city === 'Delhi') candidates.push(path.join(DATA_DIR, 'delhi-mosques-osm.json'))
  }
  return [...new Set(candidates)].filter((f) => fs.existsSync(f))
}

function loadMosquesFromFiles(files) {
  const seen = new Set()
  const mosques = []
  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const m of Array.isArray(payload.mosques) ? payload.mosques : []) {
      const key = `${String(m.name).toLowerCase()}|${Number(m.lat).toFixed(4)}|${Number(m.lng).toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      mosques.push(m)
    }
  }
  return mosques
}

async function importCity(city, auth, limit, source = 'all') {
  const files = dataFiles(city, source)
  if (!files.length) {
    console.warn(
      `Skip ${city}: no data files (run fetch-city-mosques-places.mjs / fetch-city-mosques-osm.mjs ${city})`,
    )
    return { city, created: 0, skipped: 0, failed: 0, missing: true }
  }

  const meta = CITY_CATALOG[city]
  let mosques = loadMosquesFromFiles(files)
  console.log(`${city}: loading ${mosques.length} from ${files.map((f) => path.basename(f)).join(', ')}`)
  if (limit) mosques = mosques.slice(0, limit)

  await fetch(`${API}/api/admin/city/settings`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      settings: { city, country: 'India', lat: meta.lat, lng: meta.lng },
    }),
  })

  const existing = await fetch(`${API}/api/manager/mosques`, { headers: auth })
  const list = existing.ok ? await existing.json() : []
  const keys = new Set(
    (Array.isArray(list) ? list : []).map(
      (m) => `${String(m.name).toLowerCase()}|${Number(m.lat).toFixed(4)}|${Number(m.lng).toFixed(4)}`,
    ),
  )

  let created = 0
  let skipped = 0
  let failed = 0

  for (const m of mosques) {
    const key = `${String(m.name).toLowerCase()}|${Number(m.lat).toFixed(4)}|${Number(m.lng).toFixed(4)}`
    if (keys.has(key)) {
      skipped += 1
      continue
    }

    const address = m.pinCode && !String(m.address).includes(m.pinCode)
      ? `${m.address} ${m.pinCode}`
      : m.address || `${city}, India`

    const body = {
      name: m.name,
      address,
      area: m.area || city,
      city,
      phone: m.phone || '',
      lat: m.lat,
      lng: m.lng,
      sect: m.sect || '',
      capacity: 0,
      sermonLanguage: '',
      facilities: [],
      events: [],
      photos: [],
      jumaTimings: { khutba: '', namaz: '' },
    }

    let res
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        res = await fetch(`${API}/api/admin/mosques`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify(body),
        })
        break
      } catch (err) {
        if (attempt === 3) throw err
        await new Promise((r) => setTimeout(r, 800 * attempt))
      }
    }
    if (!res?.ok) {
      failed += 1
      if (res) console.warn('Fail:', m.name, await res.text())
      continue
    }
    keys.add(key)
    created += 1
    if (created % 25 === 0) console.log(`  ${city}: created ${created}…`)
    await new Promise((r) => setTimeout(r, 15))
  }

  console.log(`${city}: created=${created} skipped=${skipped} failed=${failed}`)
  return { city, created, skipped, failed }
}

async function main() {
  const argv = process.argv.slice(2)
  const cities = resolveCities(argv)
  const limit = parseLimit(argv)
  const sourceArg = argv.find((a) => a.startsWith('--source='))
  const source = sourceArg ? sourceArg.split('=')[1] : 'all'
  if (!['all', 'places', 'osm'].includes(source)) {
    throw new Error('--source must be places | osm | all')
  }

  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const results = []
  for (const city of cities) {
    results.push(await importCity(city, auth, limit, source))
  }

  const after = await fetch(`${API}/api/mosques`)
  const all = after.ok ? await after.json() : []
  const byCity = {}
  for (const m of Array.isArray(all) ? all : []) {
    const c = m.city || 'Unknown'
    byCity[c] = (byCity[c] || 0) + 1
  }
  console.log('\nMosques by city:')
  for (const [c, n] of Object.entries(byCity).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${c}: ${n}`)
  }
  console.log('TOTAL', Array.isArray(all) ? all.length : 0)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
