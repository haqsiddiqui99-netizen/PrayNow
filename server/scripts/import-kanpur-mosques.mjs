/**
 * Create the first 5 Kanpur mosques via the running API.
 * Usage: node scripts/import-kanpur-mosques.mjs
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

function addMin(timeStr, delta) {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return timeStr
  let h = Number(m[1])
  let min = Number(m[2])
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  let total = h * 60 + min + delta
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  h = Math.floor(total / 60)
  min = total % 60
  const p = h >= 12 ? 'PM' : 'AM'
  let hour = h % 12
  if (hour === 0) hour = 12
  return `${hour}:${String(min).padStart(2, '0')} ${p}`
}

function timingsFromDay(day) {
  const by = Object.fromEntries((day?.schedule || []).map((r) => [r.prayer_name, r]))
  const slot = (name, jamatOffset = 15) => {
    const start = by[name]?.start_time || '12:00 PM'
    const end = by[name]?.end_time || start
    return { start, azan: start, jamat: addMin(start, jamatOffset), end }
  }
  return {
    Fajr: slot('Fajr', 15),
    Dhuhr: slot('Dhuhr', 15),
    Asr: slot('Asr', 15),
    Maghrib: slot('Maghrib', 5),
    Isha: slot('Isha', 15),
  }
}

async function main() {
  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`)
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Ensure city is Kanpur
  await fetch(`${API}/api/admin/city/settings`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      settings: { city: 'Kanpur', country: 'India', lat: 26.4499, lng: 80.3319 },
    }),
  })

  const today = new Date()
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const cityRes = await fetch(`${API}/api/city/settings?city=Kanpur&date=${ymd}`)
  const cityData = await cityRes.json()
  const timings = timingsFromDay(cityData.day || cityData)
  const nightTimings = cityData.day?.nightTimings || {
    tahajjud: { start: '12:30 AM', end: '3:40 AM' },
    sehri: { start: '2:30 AM', end: timings.Fajr.start },
  }

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
      sect: 'Sunni',
      capacity: 500,
      sermonLanguage: 'Urdu',
      facilities: ['Wudu Area'],
      events: [],
      photos: ['🕌'],
      jumaTimings: { khutba: timings.Dhuhr.azan, namaz: timings.Dhuhr.jamat },
      timings,
      nightTimings,
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
