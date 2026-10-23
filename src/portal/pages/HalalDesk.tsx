import { useEffect, useMemo, useState } from 'react'
import { desk, type HalalListingRow, type HalalRequestRow } from '../api'

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurants',
  meat: 'Meat shops',
  perfume: 'Attar & perfume',
  bakery: 'Sweets & bakery',
  grocery: 'Groceries',
  cosmetics: 'Cosmetics & care',
  modest: 'Modest wear',
  books: 'Books & gifts',
  travel: 'Hajj & Umrah',
  janazah: 'Janazah supplies',
}

/** Tag ids must match HALAL_CATEGORIES in the phone app, which filters on them. */
const CATEGORY_TAGS: Record<string, { title: string; tags: Array<[string, string]> }> = {
  meat: {
    title: 'Meat sold',
    tags: [
      ['chicken', 'Chicken'],
      ['mutton', 'Mutton'],
      ['beef', 'Beef'],
      ['fish', 'Fish'],
      ['other', 'Others'],
    ],
  },
}

function tagList(raw: string) {
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function toggleTag(raw: string, tag: string) {
  const list = tagList(raw)
  return (list.includes(tag) ? list.filter((item) => item !== tag) : [...list, tag]).join(', ')
}

const REQUEST_STATUSES = ['new', 'contacted', 'listed', 'declined', 'all']

type Draft = {
  category: string
  name: string
  tagline: string
  description: string
  area: string
  address: string
  city: string
  lat: string
  lng: string
  phone: string
  whatsapp: string
  website: string
  photoUrl: string
  tags: string
  priceLevel: string
  delivers: boolean
  certBody: string
  certNumber: string
  certValidUntil: string
  verified: boolean
  featured: boolean
  featuredUntil: string
  sortBoost: string
  isActive: boolean
}

const EMPTY: Draft = {
  category: 'restaurant',
  name: '',
  tagline: '',
  description: '',
  area: '',
  address: '',
  city: 'Delhi',
  lat: '',
  lng: '',
  phone: '',
  whatsapp: '',
  website: '',
  photoUrl: '',
  tags: '',
  priceLevel: '0',
  delivers: false,
  certBody: '',
  certNumber: '',
  certValidUntil: '',
  verified: false,
  featured: false,
  featuredUntil: '',
  sortBoost: '0',
  isActive: true,
}

function draftFrom(row: HalalListingRow): Draft {
  return {
    category: row.category,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    area: row.area,
    address: row.address,
    city: row.city,
    lat: row.lat == null ? '' : String(row.lat),
    lng: row.lng == null ? '' : String(row.lng),
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    photoUrl: row.photoUrl,
    tags: row.tags.join(', '),
    priceLevel: String(row.priceLevel),
    delivers: row.delivers,
    certBody: row.certBody,
    certNumber: row.certNumber,
    certValidUntil: row.certValidUntil,
    verified: row.verified,
    featured: row.featuredFlag,
    featuredUntil: row.featuredUntil,
    sortBoost: String(row.sortBoost),
    isActive: row.isActive,
  }
}

/** Accepts "28.65, 77.23" pasted into the latitude box, the way Google Maps copies a pin. */
function splitPair(lat: string, lng: string) {
  const pair = lat.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
  if (pair && !lng.trim()) return { lat: pair[1], lng: pair[2] }
  return { lat, lng }
}

function bodyFrom(draft: Draft) {
  const { lat, lng } = splitPair(draft.lat, draft.lng)
  return {
    ...draft,
    lat: lat.trim() === '' ? null : Number(lat),
    lng: lng.trim() === '' ? null : Number(lng),
    priceLevel: Number(draft.priceLevel) || 0,
    sortBoost: Number(draft.sortBoost) || 0,
  }
}

function when(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`
}

export function HalalDesk() {
  const [tab, setTab] = useState<'listings' | 'requests'>('listings')
  const [rows, setRows] = useState<HalalListingRow[]>([])
  const [requests, setRequests] = useState<HalalRequestRow[]>([])
  const [requestStatus, setRequestStatus] = useState('new')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<{ id: string | null; fromRequest?: string } | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadListings = async () => setRows((await desk.halalListings()).listings)
  const loadRequests = async (status = requestStatus) => setRequests((await desk.halalRequests(status)).requests)

  useEffect(() => {
    let live = true
    setLoading(true)
    void (tab === 'listings' ? loadListings() : loadRequests())
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load halal data')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [tab, requestStatus])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (row) =>
        (!categoryFilter || row.category === categoryFilter) &&
        (!q || [row.name, row.area, row.city, row.tagline, row.tags.join(' ')].join(' ').toLowerCase().includes(q)),
    )
  }, [rows, query, categoryFilter])

  const totals = useMemo(
    () => ({
      live: rows.filter((row) => row.isActive).length,
      featured: rows.filter((row) => row.featured).length,
      verified: rows.filter((row) => row.verified).length,
      views: rows.reduce((sum, row) => sum + row.views, 0),
      contacts: rows.reduce((sum, row) => sum + row.contacts, 0),
    }),
    [rows],
  )

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }))

  const startNew = () => {
    setDraft(EMPTY)
    setEditing({ id: null })
    setNotice('')
  }

  const startEdit = (row: HalalListingRow) => {
    setDraft(draftFrom(row))
    setEditing({ id: row.id })
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startFromRequest = (item: HalalRequestRow) => {
    setDraft({
      ...EMPTY,
      category: item.category,
      name: item.businessName,
      city: item.city || EMPTY.city,
      area: item.area,
      phone: item.phone,
      whatsapp: item.phone,
      description: item.note,
    })
    setEditing({ id: null, fromRequest: item.id })
    setTab('listings')
    setNotice('')
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const body = bodyFrom(draft)
      if (editing.id) await desk.updateHalal(editing.id, body)
      else await desk.createHalal(body)
      if (editing.fromRequest) await desk.setHalalRequest(editing.fromRequest, 'listed')
      setEditing(null)
      await loadListings()
      setNotice(editing.id ? 'Listing saved.' : 'Listing added. It shows in the app now.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the listing')
    } finally {
      setSaving(false)
    }
  }

  const quick = async (row: HalalListingRow, body: object, done: string) => {
    setError('')
    setNotice('')
    try {
      await desk.updateHalal(row.id, body)
      await loadListings()
      setNotice(done)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the listing')
    }
  }

  const remove = async (row: HalalListingRow) => {
    if (!window.confirm(`Delete ${row.name}? Turning it off keeps its numbers instead.`)) return
    try {
      await desk.deleteHalal(row.id)
      await loadListings()
      setNotice('Listing deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the listing')
    }
  }

  const moveRequest = async (item: HalalRequestRow, status: string) => {
    setError('')
    try {
      await desk.setHalalRequest(item.id, status)
      await loadRequests()
      setNotice(`Marked ${status}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the request')
    }
  }

  const input = (label: string, key: keyof Draft, props: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={String(draft[key])} onChange={(e) => set(key, e.target.value as never)} {...props} />
    </label>
  )

  const toggle = (label: string, key: 'delivers' | 'verified' | 'featured' | 'isActive') => (
    <label className="switch">
      <input type="checkbox" checked={draft[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}
    </label>
  )

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">Halal</p>
          <h2>Halal directory</h2>
        </div>
        {tab === 'listings' ? (
          <button type="button" className="solid" onClick={() => (editing ? setEditing(null) : startNew())}>
            {editing ? 'Close' : 'New listing'}
          </button>
        ) : null}
      </header>

      <div className="seg">
        <button type="button" className={tab === 'listings' ? 'on' : ''} onClick={() => setTab('listings')}>
          Listings
        </button>
        <button type="button" className={tab === 'requests' ? 'on' : ''} onClick={() => setTab('requests')}>
          Business requests
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok">{notice}</p> : null}

      {tab === 'listings' ? (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{totals.live}</span>
              <span className="stat-label">Live listings</span>
              <span className="stat-note">{rows.length - totals.live} turned off</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totals.featured}</span>
              <span className="stat-label">Featured now</span>
              <span className="stat-note">Paid spots shown first</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totals.verified}</span>
              <span className="stat-label">Verified</span>
              <span className="stat-note">Certificate seen</span>
            </div>
            <div className="stat">
              <span className="stat-value">{totals.views}</span>
              <span className="stat-label">Opens</span>
              <span className="stat-note">{totals.contacts} calls, WhatsApps and directions</span>
            </div>
          </div>

          {editing ? (
            <form
              className="panel form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                void save()
              }}
            >
              <label>
                Category
                <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {input('Name', 'name', { required: true, maxLength: 160 })}
              {input('Tagline', 'tagline', { maxLength: 200, placeholder: 'Mutton nihari since 1960' })}
              {input('Tags', 'tags', { placeholder: 'biryani, late night, family seating' })}
              {CATEGORY_TAGS[draft.category] ? (
                <div className="span-2">
                  <p className="filter-label">{CATEGORY_TAGS[draft.category].title}</p>
                  <div className="type-picks">
                    {CATEGORY_TAGS[draft.category].tags.map(([tag, label]) => {
                      const on = tagList(draft.tags).includes(tag)
                      return (
                        <button key={tag} type="button" className={on ? 'pick on' : 'pick'} onClick={() => set('tags', toggleTag(draft.tags, tag))}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <label className="span-2">
                About
                <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={2000} />
              </label>
              {input('Area', 'area', { maxLength: 120 })}
              {input('City', 'city', { maxLength: 80 })}
              <label className="span-2">
                Address
                <input value={draft.address} onChange={(e) => set('address', e.target.value)} maxLength={300} />
              </label>
              {input('Latitude', 'lat', { placeholder: '28.6506 or paste "28.6506, 77.2334"' })}
              {input('Longitude', 'lng', { placeholder: '77.2334' })}
              {input('Phone', 'phone', { placeholder: '+91 98...' })}
              {input('WhatsApp', 'whatsapp', { placeholder: 'Leave empty to use the phone' })}
              {input('Website', 'website', { placeholder: 'https://' })}
              {input('Photo link', 'photoUrl', { placeholder: 'https:// image link (optional)' })}
              <label>
                Price
                <select value={draft.priceLevel} onChange={(e) => set('priceLevel', e.target.value)}>
                  <option value="0">Not shown</option>
                  <option value="1">₹ budget</option>
                  <option value="2">₹₹ mid</option>
                  <option value="3">₹₹₹ premium</option>
                </select>
              </label>
              {input('Rank boost (-100 to 100)', 'sortBoost', { type: 'number', min: -100, max: 100 })}
              {input('Certificate from', 'certBody', { placeholder: 'Jamiat Ulama-i-Hind Halal Trust' })}
              {input('Certificate number', 'certNumber')}
              {input('Certificate valid until', 'certValidUntil', { type: 'date' })}
              {input('Featured until', 'featuredUntil', { type: 'date' })}
              <div className="span-2 checks row">
                {toggle('Verified (certificate seen)', 'verified')}
                {toggle('Featured (paid)', 'featured')}
                {toggle('Delivers', 'delivers')}
                {toggle('Shown in the app', 'isActive')}
              </div>
              <p className="muted span-2">
                Featured listings sit at the top with a Sponsored label until the end date. Leave the date empty to keep it running. Only mark
                Verified after you have seen a current certificate.
              </p>
              <button type="submit" className="solid" disabled={saving}>
                {saving ? 'Saving…' : editing.id ? 'Save listing' : 'Add listing'}
              </button>
            </form>
          ) : null}

          <div className="actions" style={{ margin: '14px 0' }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, area, tag" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {loading ? <p className="muted">Loading listings…</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Where</th>
                  <th>Verified</th>
                  <th>Featured</th>
                  <th>Reach</th>
                  <th>In app</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="muted">
                        {CATEGORY_LABELS[row.category] || row.category}
                        {row.tagline ? ` · ${row.tagline}` : ''}
                      </div>
                    </td>
                    <td>
                      <div>{[row.area, row.city].filter(Boolean).join(', ') || '—'}</div>
                      <div className="muted">{row.phone || row.whatsapp || 'No phone'}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={row.verified ? 'chip on' : 'chip'}
                        onClick={() => void quick(row, { verified: !row.verified }, row.verified ? 'Verified badge removed.' : 'Marked verified.')}
                      >
                        {row.verified ? 'Verified' : 'Not yet'}
                      </button>
                      {row.certValidUntil ? <div className="muted">to {row.certValidUntil}</div> : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={row.featured ? 'chip on' : 'chip'}
                        onClick={() => void quick(row, { featured: !row.featuredFlag }, row.featuredFlag ? 'Featured spot ended.' : 'Featured spot on.')}
                      >
                        {row.featured ? 'Featured' : row.featuredFlag ? 'Lapsed' : 'Off'}
                      </button>
                      {row.featuredUntil ? <div className="muted">until {row.featuredUntil}</div> : null}
                    </td>
                    <td>
                      <div>{row.views} opens</div>
                      <div className="muted">{row.contacts} contacts</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={row.isActive ? 'chip on' : 'chip'}
                        onClick={() => void quick(row, { isActive: !row.isActive }, row.isActive ? 'Hidden from the app.' : 'Shown in the app.')}
                      >
                        {row.isActive ? 'Shown' : 'Hidden'}
                      </button>
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="linkish" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button type="button" className="linkish" onClick={() => void remove(row)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !visible.length ? <p className="muted">No listings match.</p> : null}
        </>
      ) : (
        <>
          <div className="seg slim">
            {REQUEST_STATUSES.map((status) => (
              <button key={status} type="button" className={requestStatus === status ? 'on' : ''} onClick={() => setRequestStatus(status)}>
                {status}
              </button>
            ))}
          </div>
          {loading ? <p className="muted">Loading requests…</p> : null}
          <div className="stack">
            {!loading && !requests.length ? <p className="muted">Nothing in this queue.</p> : null}
            {requests.map((item) => (
              <article key={item.id} className="panel">
                <div className="row-head">
                  <h3>{item.businessName}</h3>
                  <div className="actions">
                    {item.wantsFeatured ? <span className="pill">Wants featured</span> : null}
                    <span className="pill">{item.status}</span>
                  </div>
                </div>
                <p>
                  {CATEGORY_LABELS[item.category] || item.category}
                  {item.area || item.city ? ` · ${[item.area, item.city].filter(Boolean).join(', ')}` : ''}
                </p>
                <p className="muted">
                  {item.contactName || 'No name'} · <a href={`tel:${item.phone}`}>{item.phone}</a> ·{' '}
                  <a href={waLink(item.phone)} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </p>
                {item.note ? <p>{item.note}</p> : null}
                <p className="muted">
                  Sent {when(item.createdAt)} by {item.submittedByName || 'a member'}
                  {item.submittedByMobile ? ` · ${item.submittedByMobile}` : ''}
                </p>
                <div className="actions">
                  <button type="button" className="solid slim" onClick={() => startFromRequest(item)}>
                    Create listing
                  </button>
                  {item.status !== 'contacted' ? (
                    <button type="button" className="ghost dark slim" onClick={() => void moveRequest(item, 'contacted')}>
                      Mark contacted
                    </button>
                  ) : null}
                  {item.status !== 'declined' ? (
                    <button type="button" className="ghost dark slim" onClick={() => void moveRequest(item, 'declined')}>
                      Decline
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
