import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.API_URL || 'http://127.0.0.1:5000'
const year = Number(process.argv[2]) || 2026
const csvPath = path.join(__dirname, `../data/kanpur-${year}.csv`)

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing ${csvPath} — run: node scripts/build-kanpur-year-csv.mjs ${year}`)
  }

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
        city: 'Kanpur',
        country: 'India',
        lat: 26.4499,
        lng: 80.3319,
      },
    }),
  })

  const csv = fs.readFileSync(csvPath, 'utf8')
  console.log(`Importing ${csvPath} (${csv.split(/\r?\n/).filter(Boolean).length - 1} data rows)…`)

  const importRes = await fetch(`${API}/api/admin/city/days/import-csv`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ city: 'Kanpur', csv }),
  })
  const body = await importRes.json().catch(async () => ({ error: await importRes.text() }))
  if (!importRes.ok) throw new Error(`Import failed: ${JSON.stringify(body)}`)
  console.log('Import OK', body)

  const check = await fetch(`${API}/api/city/settings?city=Kanpur&date=${year}-07-01`)
  const data = await check.json()
  console.log('Verify Jul 1 Fajr:', data.day?.date, data.schedule?.find((s) => s.prayer_name === 'Fajr'))
  console.log('yearDaysLoaded:', data.yearDaysLoaded)
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
