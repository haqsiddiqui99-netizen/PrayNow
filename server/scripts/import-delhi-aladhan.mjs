/**
 * Generate Delhi city_prayer_days for a year via Aladhan (through the running API).
 * Usage: node server/scripts/import-delhi-aladhan.mjs [year]
 */
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const year = Number(process.argv[2]) || new Date().getFullYear()

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
      settings: {
        city: 'Delhi',
        country: 'India',
        lat: 28.6139,
        lng: 77.209,
      },
    }),
  })

  console.log(`Generating Delhi ${year} from Aladhan via ${API} …`)
  const genRes = await fetch(`${API}/api/admin/city/days/generate-year`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ year, city: 'Delhi', source: 'aladhan' }),
  })
  const body = await genRes.json().catch(async () => ({ error: await genRes.text() }))
  if (!genRes.ok) throw new Error(`Generate failed: ${JSON.stringify(body)}`)
  console.log('OK', body)

  const today = new Date()
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const check = await fetch(`${API}/api/city/settings?city=Delhi&date=${ymd}`)
  const data = await check.json()
  console.log(
    'Today Fajr:',
    data.day?.date,
    data.schedule?.find((s) => s.prayer_name === 'Fajr'),
  )
  console.log('yearDaysLoaded:', data.yearDaysLoaded)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
