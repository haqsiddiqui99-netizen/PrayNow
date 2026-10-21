const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'praynow_portal_token'
const USER_KEY = 'praynow_portal_user'

export type PortalUser = {
  id: string
  email: string
  name: string
  mobile: string
  role: string
}

export type AccountRow = {
  id: string
  email: string
  full_name: string
  mobile: string | null
  role: string
  is_active: boolean
  created_at: string
  assignments: Array<{ mosque_id: string; mosque_name: string }>
}

export type MosqueRequestRow = {
  id: string
  name: string
  address: string
  area: string
  city: string
  lat: number | null
  lng: number | null
  ownerName: string
  ownerMobile: string
  ownerEmail: string
  notes: string
  facilities?: string[]
  timings?: Record<string, { azan?: string; jamat?: string }> | null
  nightTimings?: { sehriEnd?: string; iftar?: string } | null
  maghribOffsetMinutes?: number | null
  status: string
  reviewNote: string
  submittedByName: string
  submittedByMobile: string
  createdAt: string
  photoUrls: string[]
}

export type CorrectionRow = {
  id: string
  mosqueId: string
  mosqueName: string
  topic: string
  prayer: string | null
  suggestion: string
  note: string
  status: string
  reporterName: string
  createdAt: string
}

export type HalalListingRow = {
  id: string
  category: string
  name: string
  tagline: string
  description: string
  area: string
  address: string
  city: string
  lat: number | null
  lng: number | null
  phone: string
  whatsapp: string
  website: string
  photoUrl: string
  tags: string[]
  priceLevel: number
  delivers: boolean
  certBody: string
  certNumber: string
  certValidUntil: string
  verified: boolean
  /** True only while the paid spot is running. */
  featured: boolean
  featuredFlag: boolean
  featuredUntil: string
  sortBoost: number
  isActive: boolean
  views: number
  contacts: number
  createdAt: string
  updatedAt: string
}

export type HalalRequestRow = {
  id: string
  businessName: string
  category: string
  city: string
  area: string
  contactName: string
  phone: string
  note: string
  wantsFeatured: boolean
  status: string
  submittedByName: string
  submittedByMobile: string
  createdAt: string
}

export function getPortalUser(): PortalUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PortalUser
  } catch {
    return null
  }
}

export function clearPortalSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request<T>(path: string, options: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers.Authorization = `Bearer ${token}`
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the API. Start it with npm run server:dev')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function signIn(email: string, password: string): Promise<PortalUser> {
  const data = await request<{ token: string; user: PortalUser }>(
    '/api/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  )
  if (data.user.role !== 'admin') {
    throw new Error('This desk is only for the app owner.')
  }
  localStorage.setItem(TOKEN_KEY, data.token)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  return data.user
}

export const desk = {
  users: () => request<AccountRow[]>('/api/admin/users'),
  createUser: (body: {
    fullName: string
    mobile: string
    password: string
    email?: string
    role: 'admin' | 'mosque_manager'
    mosqueIds: string[]
  }) => request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { isActive?: boolean; password?: string }) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  assignMosque: (mosqueId: string, userId: string) =>
    request(`/api/admin/mosques/${mosqueId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  mosques: () => request<import('../types').Mosque[]>('/api/manager/mosques'),
  createMosque: (body: object) => request('/api/admin/mosques', { method: 'POST', body: JSON.stringify(body) }),
  updateMosque: (id: string, body: object) =>
    request(`/api/admin/mosques/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  requests: (status: string) =>
    request<{ requests: MosqueRequestRow[] }>(`/api/admin/mosque-requests?status=${encodeURIComponent(status)}`),
  approveRequest: (id: string, reviewNote: string) =>
    request(`/api/admin/mosque-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote }),
    }),
  rejectRequest: (id: string, reviewNote: string) =>
    request(`/api/admin/mosque-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote }),
    }),
  corrections: (status: string) =>
    request<{ corrections: CorrectionRow[] }>(
      `/api/admin/corrections?status=${encodeURIComponent(status)}&scope=all`,
    ),
  resolveCorrection: (id: string, status: 'fixed' | 'dismissed') =>
    request(`/api/manager/corrections/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  citySettings: () =>
    request<{
      settings: Record<string, string | number> | null
      schedule: Array<{ prayer_name: string; start_time: string; end_time: string }>
    }>('/api/admin/city/settings'),
  sunTimes: (lat: number, lng: number, date: string) =>
    request<import('./nightTimes').SunTimes>(
      `/api/admin/sun-times?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&date=${encodeURIComponent(date)}`,
    ),
  saveCity: (body: object) => request('/api/admin/city/settings', { method: 'PUT', body: JSON.stringify(body) }),
  cityDays: (year: number) =>
    request<{ yearDaysLoaded: number }>(`/api/admin/city/days?year=${year}`),
  generateYear: (year: number, city: string, source: 'aladhan' | 'defaults') =>
    request<{ upserted: number; city: string; year: number; source?: string; method?: number; lat?: number; lng?: number }>(
      '/api/admin/city/days/generate-year',
      { method: 'POST', body: JSON.stringify({ year, city, source }) },
    ),
  halalListings: () => request<{ listings: HalalListingRow[]; categories: string[] }>('/api/admin/halal/listings'),
  createHalal: (body: object) =>
    request<{ listing: HalalListingRow }>('/api/admin/halal/listings', { method: 'POST', body: JSON.stringify(body) }),
  updateHalal: (id: string, body: object) =>
    request<{ listing: HalalListingRow }>(`/api/admin/halal/listings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteHalal: (id: string) => request(`/api/admin/halal/listings/${id}`, { method: 'DELETE' }),
  halalRequests: (status: string) =>
    request<{ requests: HalalRequestRow[] }>(`/api/admin/halal/requests?status=${encodeURIComponent(status)}`),
  setHalalRequest: (id: string, status: string) =>
    request(`/api/admin/halal/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  importCsv: (csv: string, city: string) =>
    request<{ upserted: number; yearDaysLoaded: number; city: string }>(
      '/api/admin/city/days/import-csv',
      { method: 'POST', body: JSON.stringify({ csv, city }) },
    ),
}
