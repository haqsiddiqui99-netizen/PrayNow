// Smoke check after hosting.
// Usage (PowerShell):  $env:API_URL="https://YOUR_API"; node server/scripts/smoke-live.mjs

const API = process.env.API_URL || 'http://127.0.0.1:5000'

async function main() {
  const health = await fetch(`${API}/api/health`)
  if (!health.ok) throw new Error(`Health failed: ${health.status}`)
  const h = await health.json()
  console.log('health:', h)

  const cities = await fetch(`${API}/api/cities`)
  const cityList = await cities.json()
  console.log('cities:', cityList.map((c) => `${c.name} (${c.mosqueCount})`).join(', ') || '(none)')

  const mosques = await fetch(`${API}/api/mosques`)
  const list = await mosques.json()
  console.log('mosques:', Array.isArray(list) ? list.length : list)

  if (h.database === 'memory') {
    console.warn('WARNING: still on memory DB — set DATABASE_URL to Postgres for go-live')
  }
  if (h.database === 'postgres' && h.production) {
    console.log('OK: production Postgres API looks ready')
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
