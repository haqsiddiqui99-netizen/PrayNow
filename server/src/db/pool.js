import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'
import { createMemoryPool, isMemoryDatabase } from './memory.js'

export { isMemoryDatabase }

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema = process.env.PGSCHEMA || 'praynow'

let sharedPool = null

export function getPool() {
  if (sharedPool) return sharedPool

  if (isMemoryDatabase()) {
    sharedPool = createMemoryPool()
    return sharedPool
  }

  sharedPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  })
  sharedPool.on('connect', (client) => {
    client.query(`SET search_path TO ${schema}, public`).catch(() => {})
  })
  return sharedPool
}

export async function withClient(fn) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${schema}, public`)
    return await fn(client)
  } finally {
    client.release()
    if (!isMemoryDatabase()) {
      await pool.end()
      sharedPool = null
    }
  }
}

export async function runMigration() {
  if (isMemoryDatabase()) {
    createMemoryPool()
    console.log('Migration complete — in-memory database (schema:', schema + ')')
    return
  }

  const sqlPath = path.join(__dirname, '../../db/schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await withClient(async (client) => {
    await client.query(sql)
    console.log('Migration complete — schema:', schema)
  })
}

export function formatDbError(err) {
  if (err?.code === 'ECONNREFUSED') {
    return [
      'Cannot connect to PostgreSQL on localhost:5432.',
      'Either start PostgreSQL and set DATABASE_URL in server/.env,',
      'or use in-memory dev mode: DATABASE_URL=memory://local',
    ].join('\n')
  }
  if (err?.message) return err.message
  if (err?.code) return err.code
  return String(err)
}
