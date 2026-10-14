import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_SQL = path.join(__dirname, '../../db/schema.sql')
const SCHEMA = 'praynow'
const SAVE_DELAY_MS = 1500
const WRITE_RE = /\b(insert|update|delete)\b/i

export function snapshotEnabled() {
  return process.env.MEMORY_SNAPSHOT !== 'false'
}

export function snapshotPath() {
  return path.resolve(
    process.env.MEMORY_SNAPSHOT_FILE || path.join(__dirname, '../../data/local-db-snapshot.json'),
  )
}

/** Tables in schema.sql order (parents before children) with their column types. */
function schemaTables() {
  const sql = fs.readFileSync(SCHEMA_SQL, 'utf8')
  const tables = new Map()
  for (const [, name, body] of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)) {
    const columns = new Map()
    for (const line of body.split('\n')) {
      const match = line.match(/^\s*([a-z_][a-z0-9_]*)\s+(\w+(?:\[\])?)/)
      if (match) columns.set(match[1], match[2].toUpperCase())
    }
    tables.set(name, columns)
  }
  for (const [, table, column, type] of sql.matchAll(
    /ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+) (\w+(?:\[\])?)/g,
  )) {
    const columns = tables.get(table)
    if (columns && !columns.has(column)) columns.set(column, type.toUpperCase())
  }
  return tables
}

function ymd(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function encodeValue(value, type) {
  if (value == null) return null
  if (type === 'BYTEA') return { $b64: Buffer.from(value).toString('base64') }
  if (value instanceof Date) return type === 'DATE' ? ymd(value) : value.toISOString()
  return value
}

function decodeValue(value, type) {
  if (value == null) return null
  if (type === 'BYTEA') return Buffer.from(value.$b64 ?? '', 'base64')
  if (type === 'JSONB' || type === 'JSON') return JSON.stringify(value)
  return value
}

function dumpTables(db, tables) {
  const schema = db.getSchema(SCHEMA)
  const out = {}
  for (const [name, columns] of tables) {
    out[name] = schema.many(`SELECT * FROM ${name}`).map((row) => {
      const encoded = {}
      for (const [column, value] of Object.entries(row)) {
        encoded[column] = encodeValue(value, columns.get(column))
      }
      return encoded
    })
  }
  return out
}

/**
 * Saves the in-memory DB to disk shortly after each write (and on exit), so a
 * restart keeps users, follows, reminders and events instead of reseeding.
 */
export function trackMemoryWrites(db, pool) {
  if (!snapshotEnabled()) return
  const tables = schemaTables()
  const file = snapshotPath()
  let timer = null
  let dirty = false
  let paused = false

  const save = () => {
    clearTimeout(timer)
    timer = null
    if (!dirty) return
    dirty = false
    try {
      const data = { version: 1, savedAt: new Date().toISOString(), tables: dumpTables(db, tables) }
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(data))
      fs.renameSync(tmp, file)
    } catch (err) {
      console.error('Could not save local DB snapshot:', err.message)
    }
  }

  const markDirty = () => {
    if (paused) return
    dirty = true
    if (!timer) timer = setTimeout(save, SAVE_DELAY_MS)
  }

  const wrap = (target) => {
    if (target.__snapshotWrapped) return target
    const query = target.query.bind(target)
    target.query = (...args) => {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text
      if (text && WRITE_RE.test(text)) markDirty()
      return query(...args)
    }
    target.__snapshotWrapped = true
    return target
  }

  wrap(pool)
  const connect = pool.connect.bind(pool)
  pool.connect = async (...args) => wrap(await connect(...args))

  pool.__snapshot = {
    pause: () => { paused = true },
    resume: () => { paused = false },
    flush: () => { dirty = true; save() },
  }

  process.on('exit', save)
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      save()
      process.exit(0)
    })
  }
}

/** Loads the saved snapshot into an empty in-memory DB. Returns true when data was restored. */
export async function restoreMemorySnapshot(db, pool, client) {
  if (!snapshotEnabled()) return false
  const file = snapshotPath()
  if (!fs.existsSync(file)) return false

  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.warn(`Local DB snapshot unreadable (${err.message}) — starting fresh.`)
    return false
  }

  const tables = schemaTables()
  const backup = db.backup()
  pool.__snapshot?.pause()
  try {
    let total = 0
    for (const [name, columns] of tables) {
      for (const row of data.tables?.[name] ?? []) {
        const keys = Object.keys(row).filter((column) => columns.has(column))
        if (!keys.length) continue
        const params = keys.map((_, i) => `$${i + 1}`).join(',')
        await client.query(
          `INSERT INTO ${name} (${keys.join(',')}) VALUES (${params})`,
          keys.map((column) => decodeValue(row[column], columns.get(column))),
        )
        total += 1
      }
    }
    console.log(`Restored local DB snapshot (${total} rows, saved ${data.savedAt}) from ${path.basename(file)}`)
    return true
  } catch (err) {
    backup.restore()
    console.warn(`Local DB snapshot could not be restored (${err.message}) — starting fresh.`)
    return false
  } finally {
    pool.__snapshot?.resume()
  }
}
