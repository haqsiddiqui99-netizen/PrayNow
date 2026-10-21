import { Router } from 'express'
import { withClient } from '../db/pool.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import {
  HALAL_CATEGORIES,
  HALAL_REQUEST_STATUSES,
  fetchListingById,
  insertListing,
  insertListingRequest,
  listAdminListings,
  listListingRequests,
  listPublicListings,
  listingFieldsFromBody,
  requestFieldsFromBody,
  trackListing,
  updateListing,
} from '../services/halal.js'

const router = Router()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ownerOnly = [authMiddleware, requireRole('admin')]

function fail(res, label, err) {
  console.error(`${label} failed`, err)
  res.status(500).json({ error: `${label} failed` })
}

router.get('/halal/listings', async (_req, res) => {
  try {
    const listings = await withClient((client) => listPublicListings(client))
    res.json({ listings, categories: HALAL_CATEGORIES })
  } catch (err) {
    fail(res, 'Halal listings', err)
  }
})

router.post('/halal/listings/:id/track', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Listing not found' })
  const kind = req.body?.kind === 'contact' ? 'contact' : 'view'
  try {
    await withClient((client) => trackListing(client, req.params.id, kind))
    res.json({ ok: true })
  } catch (err) {
    fail(res, 'Halal tracking', err)
  }
})

router.post('/halal/requests', authMiddleware, async (req, res) => {
  const { error, fields } = requestFieldsFromBody(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const id = await withClient((client) => insertListingRequest(client, req.user.sub, fields))
    res.status(201).json({ ok: true, id })
  } catch (err) {
    fail(res, 'Halal request', err)
  }
})

router.get('/admin/halal/listings', ...ownerOnly, async (_req, res) => {
  try {
    const listings = await withClient((client) => listAdminListings(client))
    res.json({ listings, categories: HALAL_CATEGORIES })
  } catch (err) {
    fail(res, 'Halal listings', err)
  }
})

router.post('/admin/halal/listings', ...ownerOnly, async (req, res) => {
  const { error, fields } = listingFieldsFromBody(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const listing = await withClient(async (client) => {
      const id = await insertListing(client, fields)
      return fetchListingById(client, id, { admin: true })
    })
    res.status(201).json({ listing })
  } catch (err) {
    fail(res, 'Halal listing create', err)
  }
})

router.put('/admin/halal/listings/:id', ...ownerOnly, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Listing not found' })
  const { error, fields } = listingFieldsFromBody(req.body, { partial: true })
  if (error) return res.status(400).json({ error })
  try {
    const listing = await withClient(async (client) => {
      const found = await updateListing(client, req.params.id, fields)
      return found ? fetchListingById(client, req.params.id, { admin: true }) : null
    })
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    res.json({ listing })
  } catch (err) {
    fail(res, 'Halal listing update', err)
  }
})

router.delete('/admin/halal/listings/:id', ...ownerOnly, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Listing not found' })
  try {
    await withClient((client) => client.query(`DELETE FROM halal_listings WHERE id = $1`, [req.params.id]))
    res.json({ ok: true })
  } catch (err) {
    fail(res, 'Halal listing delete', err)
  }
})

router.get('/admin/halal/requests', ...ownerOnly, async (req, res) => {
  const status = String(req.query.status || 'new')
  if (status !== 'all' && !HALAL_REQUEST_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Unknown status' })
  }
  try {
    const requests = await withClient((client) => listListingRequests(client, status))
    res.json({ requests })
  } catch (err) {
    fail(res, 'Halal requests', err)
  }
})

router.patch('/admin/halal/requests/:id', ...ownerOnly, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Request not found' })
  const status = String(req.body?.status || '')
  if (!HALAL_REQUEST_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' })
  try {
    const { rowCount } = await withClient((client) =>
      client.query(`UPDATE halal_listing_requests SET status = $2 WHERE id = $1`, [req.params.id, status]),
    )
    if (!rowCount) return res.status(404).json({ error: 'Request not found' })
    res.json({ ok: true })
  } catch (err) {
    fail(res, 'Halal request update', err)
  }
})

export default router
