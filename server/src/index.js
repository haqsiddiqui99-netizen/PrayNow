import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import publicRoutes from './routes/public.js'
import adminRoutes from './routes/admin.js'
import meRoutes from './routes/me.js'
import halalRoutes from './routes/halal.js'
import { ensureDatabaseReady } from './db/ensureReady.js'
import { isMemoryDatabase } from './db/pool.js'

dotenv.config()

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_ORIGIN || ''
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

const allowedOrigins = parseAllowedOrigins()

const app = express()
const port = Number(process.env.PORT || 5000)

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

const limitJson = { standardHeaders: true, legacyHeaders: false }
const authLimiter = rateLimit({
  ...limitJson,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})
const chatLimiter = rateLimit({
  ...limitJson,
  windowMs: 60 * 1000,
  limit: 12,
  message: { error: 'Too many chat requests. Please wait a moment.' },
})
const deleteLimiter = rateLimit({
  ...limitJson,
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skip: (req) => req.method !== 'DELETE' || (req.path !== '/' && req.path !== ''),
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})
const halalLimiter = rateLimit({
  ...limitJson,
  windowMs: 60 * 1000,
  limit: 60,
  skip: (req) => req.method !== 'POST',
  message: { error: 'Too many requests. Please wait a moment.' },
})

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true)
    }
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use('/api/login', authLimiter)
app.use('/api/register', authLimiter)
app.use('/api/chat', chatLimiter)
app.use('/api/me', deleteLimiter)
app.use('/api/halal', halalLimiter)

app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'praynow-api',
    database: isMemoryDatabase() ? 'memory' : 'postgres',
    production: !isMemoryDatabase() && process.env.NODE_ENV === 'production',
  })
})

app.use('/api', publicRoutes)
app.use('/api', adminRoutes)
app.use('/api', meRoutes)
app.use('/api', halalRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

await ensureDatabaseReady()

const host = process.env.HOST || '0.0.0.0'
const server = app.listen(port, host, () => {
  const mode = isMemoryDatabase() ? ' (in-memory DB)' : ''
  console.log(`PrayNow API running on http://localhost:${port}${mode}`)
  if (host === '0.0.0.0') {
    console.log(`  LAN: use http://<your-pc-ip>:${port} from phone (same Wi-Fi)`)
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the other process or change PORT in server/.env`)
    process.exit(1)
  }
  if (err.code === 'EACCES') {
    console.error(
      `Port ${port} is blocked (EACCES). Windows may reserve this port — try PORT=5000 or 8080 in server/.env`,
    )
    process.exit(1)
  }
  throw err
})