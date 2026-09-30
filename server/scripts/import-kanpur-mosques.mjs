/**
 * Create Kanpur mosques via the running API (real location fields only).
 * Usage: node server/scripts/import-kanpur-mosques.mjs
 */
const API = process.env.API_URL || 'http://127.0.0.1:5000'

const MOSQUES = [
  {
    name: 'Masjid Ghausia',
    address: 'Sakera Estate, Anwar Ganj, Kanpur',
    area: 'Anwar Ganj',
    city: 'Kanpur',
    lat: 26.4567,
    lng: 80.3327,
  },
  {
    name: 'Masjid Bhannana Purva',
    address: 'Chaman Ganj, Kanpur',
    area: 'Chaman Ganj',
    city: 'Kanpur',
    lat: 26.4515,
    lng: 80.336,
  },
  {
    name: 'Nasheman Masjid',
    address: 'Juhi, Kanpur',
    area: 'Juhi',
    city: 'Kanpur',
    lat: 26.4412,
    lng: 80.3185,
  },
  {
    name: 'Fahimabad Masjid',
    address: 'Fahimabad, Kanpur',
    area: 'Fahimabad',
    city: 'Kanpur',
    lat: 26.4653,
    lng: 80.3371,
  },
  {
    name: 'Jama Masjid',
    address: 'Param Purwa, Kanpur',
    area: 'Param Purwa',
    city: 'Kanpur',
    lat: 26.4385,
    lng: 80.3205,
  },
]

async function main() {
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
      settings: { city: 'Kanpur', country: 'India', lat: 26.4499, lng: 80.3319 },
    }),
  })

  const existing = await fetch(`${API}/api/manager/mosques`, { headers: auth })
  const list = existing.ok ? await existing.json() : []
  const keys = new Set(
    (Array.isArray(list) ? list : []).map(
      (m) => `${String(m.name).toLowerCase()}|${String(m.city || m.area || '').toLowerCase()}`,
    ),
  )

  let created = 0
  for (const m of MOSQUES) {
    const key = `${m.name.toLowerCase()}|${String(m.city || m.area).toLowerCase()}`
    if (keys.has(key) || keys.has(`${m.name.toLowerCase()}|${String(m.area).toLowerCase()}`)) {
      console.log('Skip (exists):', m.name, m.area)
      continue
    }
    const body = {
      ...m,
      phone: '',
      sect: '',
      capacity: 0,
      sermonLanguage: '',
      facilities: [],
      events: [],
      photos: [],
      jumaTimings: { khutba: '', namaz: '' },
    }
    const res = await fetch(`${API}/api/admin/mosques`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Create ${m.name} failed: ${await res.text()}`)
    const saved = await res.json()
    console.log('Created:', saved.name, saved.area, saved.city || m.city)
    created += 1
  }

  const after = await fetch(`${API}/api/mosques`)
  const all = after.ok ? await after.json() : []
  const kanpur = (Array.isArray(all) ? all : []).filter((m) => String(m.city || '').toLowerCase() === 'kanpur')
  console.log(`Done. Created ${created}. Kanpur mosques now: ${kanpur.length}`)
  kanpur.forEach((m) => console.log(' -', m.name, '/', m.area))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
