import { getPool, isMemoryDatabase } from './pool.js'
import { ensureFirstAdmin, runSeed } from './seed.js'
import { hydrateLocalMosquesFromFiles } from './hydrateLocalMosques.js'
import { getMemoryDb } from './memory.js'
import { restoreMemorySnapshot } from './memorySnapshot.js'

export async function ensureDatabaseReady() {
  const pool = getPool()
  const client = await pool.connect()
  try {
    const schema = process.env.PGSCHEMA || 'praynow'
    await client.query(`SET search_path TO ${schema}, public`)

    if (isMemoryDatabase()) {
      await restoreMemorySnapshot(getMemoryDb(), pool, client)
      const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM users`)
      if (rows[0]?.count === 0) {
        console.log('In-memory database empty — seeding demo data…')
        await runSeed()
      }
    } else {
      await ensureFirstAdmin(client)
    }
  } finally {
    client.release()
  }

  // Merge server/data/*-mosques-*.json (saved Places/OSM fetch) — free, no external API.
  return hydrateLocalMosquesFromFiles()
}
