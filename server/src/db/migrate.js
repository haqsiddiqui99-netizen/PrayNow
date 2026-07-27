import { runMigration, formatDbError } from './pool.js'

runMigration().catch((err) => {
  console.error('Migration failed:', formatDbError(err))
  process.exit(1)
})
