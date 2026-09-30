/**
 * Generate Aladhan year calendars for Tier-1 cities (+ Navi Mumbai, Thane).
 * Usage:
 *   node server/scripts/import-tier1-aladhan.mjs [year]
 *   node server/scripts/import-tier1-aladhan.mjs 2026 "Mumbai,Navi Mumbai,Thane"
 */
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const year = Number(process.argv[2]) || new Date().getFullYear()

const TIER1 = [
  'Delhi',
  'Mumbai',
  'Navi Mumbai',
  'Thane',
  'Hyderabad',
  'Kolkata',
  'Bengaluru',
  'Chennai',
  'Lucknow',
  'Kanpur',
  'Patna',
  'Ahmedabad',
]

const COORDS = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  'Navi Mumbai': { lat: 19.033, lng: 73.0297 },
  Thane: { lat: 19.2183, lng: 72.9781 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Kanpur: { lat: 26.4499, lng: 80.3319 },
  Patna: { lat: 25.5941, lng: 85.1376 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
}

const filterArg = process.argv[3]
const cities = filterArg
  ? filterArg.split(',').map((s) => s.trim()).filter(Boolean)
  : TIER1

async function main() {
  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  for (const city of cities) {
    const coords = COORDS[city]
    if (!coords) {
      console.warn(`Skip unknown city: ${city}`)
      continue
    }

    await fetch(`${API}/api/admin/city/settings`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({
        settings: { city, country: 'India', lat: coords.lat, lng: coords.lng },
      }),
    })

    console.log(`Generating ${city} ${year} from Aladhan…`)
    const genRes = await fetch(`${API}/api/admin/city/days/generate-year`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ year, city, source: 'aladhan' }),
    })
    const body = await genRes.json().catch(async () => ({ error: await genRes.text() }))
    if (!genRes.ok) throw new Error(`${city} failed: ${JSON.stringify(body)}`)
    console.log('  OK', body.upserted, 'days', body.lat, body.lng)
  }

  console.log('Done:', cities.join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
