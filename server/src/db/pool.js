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

/** Runs fn on a pooled client. The API shares this pool, so it stays open afterwards. */
export async function withClient(fn) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO ${schema}, public`)
    return await fn(client)
  } finally {
    client.release()
  }
}

/** One-off scripts call this so Node can exit. */
export async function closePool() {
  if (!sharedPool || isMemoryDatabase()) return
  const pool = sharedPool
  sharedPool = null
  await pool.end()
}

// CREATE TYPE has no IF NOT EXISTS, and pg-mem cannot run a DO block, so skip it once it exists.
const CREATE_USER_ROLE_RE = /^CREATE TYPE user_role AS ENUM[^;]*;/m

export async function runMigration() {
  if (isMemoryDatabase()) {
    createMemoryPool()
    console.log('Migration complete — in-memory database (schema:', schema + ')')
    return
  }

  const sqlPath = path.join(__dirname, '../../db/schema.sql')
  let sql = fs.readFileSync(sqlPath, 'utf8')
  try {
    await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE t.typname = 'user_role' AND n.nspname = $1`,
        [schema],
      )
      if (rows.length) sql = sql.replace(CREATE_USER_ROLE_RE, '')
      await client.query(sql)
      console.log('Migration complete — schema:', schema)
    })
  } finally {
    await closePool()
  }
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
