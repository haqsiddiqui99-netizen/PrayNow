import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const csvPath = path.join(__dirname, '../data/kanpur-2026-07.csv')

async function main() {
  const loginRes = await fetch(`${API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999', password: 'Admin@12345' }),
  })
  if (!loginRes.ok) {
    const t = await loginRes.text()
    throw new Error(`Login failed: ${loginRes.status} ${t}`)
  }
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Point city defaults at Kanpur
  const settingsRes = await fetch(`${API}/api/admin/city/settings`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      settings: {
        city: 'Kanpur',
        country: 'India',
        lat: 26.4499,
        lng: 80.3319,
        zawal_start: '11:48 AM',
        zawal_end: '12:08 PM',
        sunrise: '5:19 AM',
        fajr_namaz_end: '5:09 AM',
        tahajjud_start: '12:30 AM',
        tahajjud_end: '3:29 AM',
        sehri_start: '2:19 AM',
        sehri_end: '3:49 AM',
      },
      schedule: [
        { prayer_name: 'Fajr', start_time: '3:49 AM', end_time: '5:19 AM' },
        { prayer_name: 'Dhuhr', start_time: '12:13 PM', end_time: '3:39 PM' },
        { prayer_name: 'Asr', start_time: '3:39 PM', end_time: '7:06 PM' },
        { prayer_name: 'Maghrib', start_time: '7:06 PM', end_time: '8:36 PM' },
        { prayer_name: 'Isha', start_time: '8:36 PM', end_time: '3:49 AM' },
      ],
    }),
  })
  if (!settingsRes.ok) throw new Error(`Settings save failed: ${await settingsRes.text()}`)
  console.log('City settings set to Kanpur')

  const csv = fs.readFileSync(csvPath, 'utf8')
  const importRes = await fetch(`${API}/api/admin/city/days/import-csv`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ city: 'Kanpur', csv }),
  })
  const importBody = await importRes.json().catch(async () => ({ error: await importRes.text() }))
  if (!importRes.ok) throw new Error(`Import failed: ${JSON.stringify(importBody)}`)
  console.log('Import OK', importBody)

  const check = await fetch(`${API}/api/city/settings?city=Kanpur&date=2026-07-01`)
  const todayish = await check.json()
  console.log('Verify 2026-07-01 day:', todayish.day?.date, todayish.schedule?.find((s) => s.prayer_name === 'Fajr'))
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
