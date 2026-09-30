/**
 * Import every saved mosque JSON under server/data/ into the database.
 * Reads local files only — never calls Google Places or OSM Overpass.
 *
 * Usage (from repo root):
 *   npm run db:migrate
 *   npm run mosques:import-all
 *
 * Or from server/:
 *   node scripts/import-all-local-mosques.mjs
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureDatabaseReady } from '../src/db/ensureReady.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

console.log('\n=== Import saved mosque JSON → database (no OSM / Google API) ===\n')

try {
  const result = await ensureDatabaseReady()
  console.log('\nDone. The API serves mosques from Postgres — no external fetch on each request.\n')
  if (result?.reason === 'hydrated') {
    console.log(`Summary: ${result.created} new, ${result.skipped} already in DB, ${result.total} total active.`)
  } else if (result?.reason) {
    console.log(`Summary: ${result.reason}`)
  }
} catch (err) {
  console.error(err)
  process.exit(1)
}

process.exit(0)
