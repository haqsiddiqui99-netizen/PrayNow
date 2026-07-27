import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { newDb } from 'pg-mem'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let memoryPool = null

export function isMemoryDatabase() {
  return process.env.DATABASE_URL?.startsWith('memory://') ?? false
}

export function createMemoryPool() {
  if (memoryPool) return memoryPool

  const db = newDb({ autoCreateForeignKeyIndices: true })

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: db.public.getType('uuid'),
    implementation: () => randomUUID(),
  })

  db.public.registerFunction({
    name: 'now',
    returns: db.public.getType('timestamptz'),
    implementation: () => new Date(),
  })

  const sqlPath = path.join(__dirname, '../../db/schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  db.public.none(sql)

  const { Pool } = db.adapters.createPg()
  memoryPool = new Pool()
  return memoryPool
}

export function resetMemoryPool() {
  memoryPool = null
}
