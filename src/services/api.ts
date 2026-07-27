const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface AppUser {
  id: string
  email: string
  name: string
  role: string
}

function getAdminToken() {
  return localStorage.getItem('praynow_admin_token')
}

export function getAppToken() {
  return localStorage.getItem('praynow_user_token')
}

export function setAppToken(token: string | null) {
  if (token) localStorage.setItem('praynow_user_token', token)
  else localStorage.removeItem('praynow_user_token')
}

export function getAppUser(): AppUser | null {
  const raw = localStorage.getItem('praynow_user')
  return raw ? JSON.parse(raw) : null
}

export function setAppUser(user: AppUser | null) {
  if (user) localStorage.setItem('praynow_user', JSON.stringify(user))
  else localStorage.removeItem('praynow_user')
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem('praynow_admin_token', token)
  else localStorage.removeItem('praynow_admin_token')
}

export function getAdminUser(): { email: string; role: string; name: string } | null {
  const raw = localStorage.getItem('praynow_admin_user')
  return raw ? JSON.parse(raw) : null
}

export function setAdminUser(user: object | null) {
  if (user) localStorage.setItem('praynow_admin_user', JSON.stringify(user))
  else localStorage.removeItem('praynow_admin_user')
}

export interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  assignments: Array<{ mosque_id: string; mosque_name: string }>
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getAdminToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach API server. Start it with: npm run server:dev')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

/** Authenticated as end-user (app token), not admin portal token. */
async function requestUser<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getAppToken() || getAdminToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach API server. Start it with: npm run server:dev')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json() as Promise<T>
}

export type AppNotification = {
  id: string
  type: 'timings' | 'announcement'
  title: string
  body: string
  mosqueId: string | null
  mosqueName: string
  read: boolean
  createdAt: string
}

export const api = {
  getCitySettings: () =>
    request<{
      settings: Record<string, string | number> | null
      schedule: Array<{ prayer_name: string; start_time: string; end_time: string }>
      day?: {
        date: string
        nightTimings?: { tahajjud: { start: string; end: string }; sehri: { start: string; end: string } }
      } | null
      date?: string
      yearDaysLoaded?: number
    }>('/api/city/settings'),
  health: () => request<{ ok: boolean }>('/api/health'),
  getMosques: () => request<import('../types').Mosque[]>('/api/mosques'),
  getCities: () =>
    request<
      Array<{
        id: string
        name: string
        country: string
        mosqueCount: number
        lat?: number | null
        lng?: number | null
        aliases?: string[]
      }>
    >('/api/cities'),
  getLiveAzan: () => request<import('../types/liveAzan').LiveAzanResponse>('/api/live-azan'),
  login: (email: string, password: string) =>
    request<{ token: string; user: AppUser }>(
      '/api/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  admin: {
    getMosques: () => request<import('../types').Mosque[]>('/api/manager/mosques'),
    createMosque: (body: object) =>
      request('/api/admin/mosques', { method: 'POST', body: JSON.stringify(body) }),
    updateMosque: (id: string, body: object) =>
      request(`/api/admin/mosques/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    updateTimings: (id: string, body: object) =>
      request(`/api/admin/mosques/${id}/timings`, { method: 'PUT', body: JSON.stringify(body) }),
    managerUpdateTimings: (id: string, body: object) =>
      request(`/api/manager/mosques/${id}/timings`, { method: 'PUT', body: JSON.stringify(body) }),
    getUsers: () => request<UserRow[]>('/api/admin/users'),
    createUser: (body: object) =>
      request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    assignMosque: (mosqueId: string, userId: string) =>
      request(`/api/admin/mosques/${mosqueId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    getCitySettings: () =>
      request<{ settings: Record<string, string | number> | null; schedule: Array<{ prayer_name: string; start_time: string; end_time: string }> }>(
        '/api/admin/city/settings',
      ),
    updateCitySettings: (body: object) =>
      request('/api/admin/city/settings', { method: 'PUT', body: JSON.stringify(body) }),
    getCityDays: (year = new Date().getFullYear()) =>
      request<{
        city: string
        year: number
        count: number
        yearDaysLoaded: number
        csvHeader: string
        days: Array<{ date: string }>
      }>(`/api/admin/city/days?year=${year}`),
    importCityDaysCsv: (csv: string, city?: string) =>
      request<{ ok: boolean; upserted: number; yearDaysLoaded: number; city: string }>(
        '/api/admin/city/days/import-csv',
        { method: 'POST', body: JSON.stringify({ csv, city }) },
      ),
    generateCityYear: (year = new Date().getFullYear(), city?: string) =>
      request<{ ok: boolean; upserted: number; city: string; year: number }>(
        '/api/admin/city/days/generate-year',
        { method: 'POST', body: JSON.stringify({ year, city }) },
      ),
    startAzan: (mosqueId: string, prayerName?: string) =>
      request<{ session: { id: string; channel: string; status: string }; agora: import('./agoraClient').AgoraCredentials }>(
        `/api/manager/mosques/${mosqueId}/azan/start`,
        { method: 'POST', body: JSON.stringify({ prayerName }) },
      ),
    stopAzan: (mosqueId: string, recordingUrl?: string) =>
      request<{ ended: boolean; session: { id: string; status: string; recording_url: string | null } | null }>(
        `/api/manager/mosques/${mosqueId}/azan/stop`,
        { method: 'POST', body: JSON.stringify({ recordingUrl }) },
      ),
    refreshAzanToken: (mosqueId: string) =>
      request<{ agora: import('./agoraClient').AgoraCredentials }>(
        `/api/manager/mosques/${mosqueId}/azan/broadcast-token`,
      ),
    postAnnouncement: (mosqueId: string, body: { title: string; body: string }) =>
      request<{ ok: boolean; notified: number }>(
        `/api/manager/mosques/${mosqueId}/announcements`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },
  me: {
    getSubscriptions: () =>
      requestUser<{ mosqueIds: string[] }>('/api/me/subscriptions'),
    subscribe: (mosqueId: string) =>
      requestUser<{ ok: boolean }>(`/api/me/subscriptions/${mosqueId}`, { method: 'POST' }),
    unsubscribe: (mosqueId: string) =>
      requestUser<{ ok: boolean }>(`/api/me/subscriptions/${mosqueId}`, { method: 'DELETE' }),
    getNotifications: () =>
      requestUser<{ notifications: AppNotification[]; unreadCount: number }>('/api/me/notifications'),
    markRead: (id: string) =>
      requestUser<{ ok: boolean }>(`/api/me/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () =>
      requestUser<{ ok: boolean }>('/api/me/notifications/read-all', { method: 'POST' }),
  },
  listenToken: (mosqueId: string) =>
    request<{ sessionId: string; channel: string; agora: import('./agoraClient').AgoraCredentials }>(
      `/api/mosques/${mosqueId}/azan/listen`,
    ),
}

export async function isApiAvailable(): Promise<boolean> {
  try {
    const h = await api.health()
    return h.ok
  } catch {
    return false
  }
}
