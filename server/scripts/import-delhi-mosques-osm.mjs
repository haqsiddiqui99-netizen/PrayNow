/**
 * Import Delhi OSM mosques into the running API.
 * Real fields only: name, address, area, lat/lng, phone (if OSM had it), sect (if tagged).
 * Does NOT invent capacity, facilities, photos, sermon language, or jamat timings.
 *
 * Usage:
 *   node server/scripts/fetch-delhi-mosques-osm.mjs
 *   node server/scripts/import-delhi-mosques-osm.mjs
 *   node server/scripts/import-delhi-mosques-osm.mjs --limit=50
 *   node server/scripts/import-delhi-mosques-osm.mjs --with-aladhan   (optional city year)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const DATA = path.join(__dirname, '../data/delhi-mosques-osm.json')

function parseLimit(argv) {
  const arg = argv.find((a) => a.startsWith('--limit='))
  if (!arg) return null
  const n = Number(arg.split('=')[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

async function main() {
  if (!fs.existsSync(DATA)) {
    throw new Error(`Missing ${DATA} — run: node server/scripts/fetch-delhi-mosques-osm.mjs`)
  }

  const payload = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  let mosques = Array.isArray(payload.mosques) ? payload.mosques : []
  const limit = parseLimit(process.argv.slice(2))
  if (limit) mosques = mosques.slice(0, limit)

  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  await fetch(`${API}/api/admin/city/settings`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      settings: { city: 'Delhi', country: 'India', lat: 28.6139, lng: 77.209 },
    }),
  })

  if (process.argv.includes('--with-aladhan')) {
    console.log('Generating Delhi year from Aladhan…')
    const genRes = await fetch(`${API}/api/admin/city/days/generate-year`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        year: new Date().getFullYear(),
        city: 'Delhi',
        source: 'aladhan',
      }),
    })
    if (!genRes.ok) console.warn('Aladhan generate failed:', await genRes.text())
    else console.log('Aladhan OK', await genRes.json())
  }

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

    const body = {
      name: m.name,
      address: m.address || 'Delhi, India',
      area: m.area || 'Delhi',
      city: 'Delhi',
      phone: m.phone || '',
      lat: m.lat,
      lng: m.lng,
      sect: m.sect || '',
      capacity: 0, // unknown — DB column is NOT NULL; UI shows "—" for 0
      sermonLanguage: '',
      facilities: [],
      events: [],
      photos: [],
      jumaTimings: { khutba: '', namaz: '' },
      // No timings / nightTimings — leave empty until mosque admin sets them
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
        console.warn(`Retry ${attempt} for ${m.name}:`, err instanceof Error ? err.message : err)
        await new Promise((r) => setTimeout(r, 800 * attempt))
      }
    }
    if (!res) {
      failed += 1
      continue
    }
    if (!res.ok) {
      failed += 1
      console.warn('Fail:', m.name, await res.text())
      continue
    }
    keys.add(key)
    created += 1
    if (created % 25 === 0) console.log(`Created ${created}…`)
    await new Promise((r) => setTimeout(r, 20))
  }

  const after = await fetch(`${API}/api/mosques`)
  const all = after.ok ? await after.json() : []
  const delhi = (Array.isArray(all) ? all : []).filter((m) => String(m.city || '').toLowerCase() === 'delhi')
  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}. Delhi mosques now: ${delhi.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
