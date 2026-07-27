import { getPool, isMemoryDatabase } from './pool.js'
import { runSeed } from './seed.js'

export async function ensureDatabaseReady() {
  if (!isMemoryDatabase()) return

  const pool = getPool()
  const client = await pool.connect()
  try {
    const schema = process.env.PGSCHEMA || 'praynow'
    await client.query(`SET search_path TO ${schema}, public`)
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM users`)
    if (rows[0]?.count === 0) {
      console.log('In-memory database empty — seeding demo data…')
      await runSeed()
    }
  } finally {
    client.release()
  }
}
