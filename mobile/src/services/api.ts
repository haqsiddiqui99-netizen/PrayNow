import { getApiBaseUrl } from '@/src/config/api'
import type { ApiCitySettingsResponse } from '@/src/config/cityPrayerConfig'
import { MOCK_MOSQUES } from '@/src/data/mockData'
import type { Mosque, MosqueTimings, NightTimings, PrayerName } from '@/src/types'
import { getStoredToken, type AppUser } from '@/src/services/authStorage'

export type { AppUser }

const FETCH_TIMEOUT_MS = 12000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Server timed out. Check that the API is running at ${getApiBaseUrl()}`)
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach server at ${getApiBaseUrl()}. Start the API (cd server && npm start) and use the same Wi-Fi on your phone.`,
      )
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getStoredToken()
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function parseError(res: Response, fallback: string) {
  const err = (await res.json().catch(() => ({ error: fallback }))) as { error?: string }
  throw new Error(err.error || fallback)
}

export async function login(mobile: string, password: string): Promise<{ token: string; user: AppUser }> {
  // Prefer last 10 digits so +91 / leading country code still matches seed mobiles
  const digits = mobile.replace(/\D/g, '')
  const cleanMobile = digits.length > 10 ? digits.slice(-10) : digits
  const cleanPassword = password.trim()
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: cleanMobile, password: cleanPassword }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Login failed' }))) as { error?: string }
    const base = err.error || 'Login failed'
    if (res.status === 401) {
      throw new Error(`${base} (API: ${getApiBaseUrl()})`)
    }
    throw new Error(base)
  }
  return (await res.json()) as { token: string; user: AppUser }
}

export async function register(
  name: string,
  mobile: string,
  password: string,
): Promise<{ token: string; user: AppUser }> {
  const cleanMobile = mobile.replace(/\D/g, '')
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), mobile: cleanMobile, password }),
  })
  if (!res.ok) await parseError(res, 'Registration failed')
  return (await res.json()) as { token: string; user: AppUser }
}

export async function fetchSupportedCities(): Promise<
  Array<{
    id: string
    name: string
    country: string
    mosqueCount: number
    lat?: number | null
    lng?: number | null
    aliases?: string[]
  }>
> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/cities`)
    if (!res.ok) throw new Error('Failed')
    return (await res.json()) as Array<{
      id: string
      name: string
      country: string
      mosqueCount: number
      lat?: number | null
      lng?: number | null
      aliases?: string[]
    }>
  } catch {
    return [{ id: 'kanpur', name: 'Kanpur', country: 'India', mosqueCount: 0, lat: 26.4499, lng: 80.3319 }]
  }
}

export async function fetchCitySettings(): Promise<ApiCitySettingsResponse> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/city/settings`)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as ApiCitySettingsResponse
}

export async function fetchMosques(): Promise<Mosque[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/mosques`)
    if (!res.ok) throw new Error(`API ${res.status}`)
    return (await res.json()) as Mosque[]
  } catch {
    return MOCK_MOSQUES
  }
}

export interface LiveAzanSession {
  sessionId: string
  mosqueId: string
  mosqueName: string
  area: string
  prayerName: string | null
  channel: string
  listeners: number
  startedAt: string
}

/** Mosques currently broadcasting azan live. Returns [] when offline/unavailable. */
export async function fetchLiveAzanSessions(): Promise<LiveAzanSession[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/live-azan/sessions`)
    if (!res.ok) return []
    const data = (await res.json()) as { sessions?: LiveAzanSession[] }
    return data.sessions ?? []
  } catch {
    return []
  }
}

export async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/health`)
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}

// --- Authenticated manager / admin APIs (mobile) ---

export async function fetchManagerMosques(): Promise<Mosque[]> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/manager/mosques`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load your mosques')
  return (await res.json()) as Mosque[]
}

export async function updateManagerMosqueTimings(
  mosqueId: string,
  body: {
    timings?: MosqueTimings
    nightTimings?: NightTimings
    jumaTimings?: {
      azan?: string
      khutba: string
      namaz: string
      sessions?: { azan?: string; khutba: string; namaz: string }[]
    }
  },
): Promise<Mosque> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/manager/mosques/${mosqueId}/timings`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res, 'Failed to save timings')
  return (await res.json()) as Mosque
}

export async function startMosqueAzan(mosqueId: string, prayerName?: PrayerName) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/manager/mosques/${mosqueId}/azan/start`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ prayerName }),
  })
  if (!res.ok) await parseError(res, 'Failed to start azan')
  return (await res.json()) as {
    session: { id: string; channel: string; status: string }
    agora: { configured: boolean; appId: string | null; channel: string; token: string | null }
  }
}

export async function stopMosqueAzan(mosqueId: string, recordingUrl?: string) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/manager/mosques/${mosqueId}/azan/stop`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ recordingUrl }),
  })
  if (!res.ok) await parseError(res, 'Failed to stop azan')
  return (await res.json()) as { ended: boolean; session: unknown }
}

export interface AdminUserRow {
  id: string
  email: string
  full_name: string
  mobile?: string | null
  role: string
  is_active: boolean
  assignments: Array<{ mosque_id: string; mosque_name: string }>
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/users`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load users')
  return (await res.json()) as AdminUserRow[]
}

export async function createMosqueManager(body: {
  fullName: string
  mobile: string
  password: string
  mosqueIds: string[]
}): Promise<{ id: string; email: string; full_name: string; mobile?: string; role: string }> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/users`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      fullName: body.fullName,
      mobile: body.mobile,
      password: body.password,
      role: 'mosque_manager',
      mosqueIds: body.mosqueIds,
    }),
  })
  if (!res.ok) await parseError(res, 'Failed to create mosque admin')
  return (await res.json()) as { id: string; email: string; full_name: string; mobile?: string; role: string }
}

export async function assignMosqueToUser(mosqueId: string, userId: string) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/mosques/${mosqueId}/assign`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) await parseError(res, 'Failed to assign mosque')
  return (await res.json()) as { ok: boolean }
}

export async function createAdminMosque(body: Record<string, unknown>): Promise<Mosque> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/mosques`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res, 'Failed to create mosque')
  return (await res.json()) as Mosque
}

export async function updateAdminMosque(mosqueId: string, body: Record<string, unknown>): Promise<Mosque> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/mosques/${mosqueId}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res, 'Failed to update mosque')
  return (await res.json()) as Mosque
}

export async function fetchAdminCitySettings() {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/city/settings`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load city settings')
  return (await res.json()) as {
    settings: Record<string, string | number> | null
    schedule: Array<{ prayer_name: string; start_time: string; end_time: string }>
  }
}

export async function updateAdminCitySettings(body: object) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/city/settings`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res, 'Failed to save city settings')
  return (await res.json()) as { ok: boolean }
}

export async function fetchAdminCityDays(year = new Date().getFullYear()) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/city/days?year=${year}`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load city days')
  return (await res.json()) as {
    city: string
    year: number
    count: number
    yearDaysLoaded: number
    csvHeader: string
    days: Array<{ date: string }>
  }
}

export async function importAdminCityDaysCsv(csv: string, city?: string) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/city/days/import-csv`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ csv, city }),
  })
  if (!res.ok) await parseError(res, 'CSV import failed')
  return (await res.json()) as { ok: boolean; upserted: number; yearDaysLoaded: number; city: string }
}

export async function generateAdminCityYear(year = new Date().getFullYear(), city?: string) {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/admin/city/days/generate-year`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ year, city }),
  })
  if (!res.ok) await parseError(res, 'Failed to generate year')
  return (await res.json()) as { ok: boolean; upserted: number; city: string; year: number }
}

// --- User mosque notifications ---

export async function fetchMySubscriptions(): Promise<string[]> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/subscriptions`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load subscriptions')
  const data = (await res.json()) as { mosqueIds?: string[] }
  return data.mosqueIds ?? []
}

export async function subscribeMosque(mosqueId: string): Promise<void> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/subscriptions/${mosqueId}`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) await parseError(res, 'Failed to enable notifications')
}

export async function unsubscribeMosque(mosqueId: string): Promise<void> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/subscriptions/${mosqueId}`, {
    method: 'DELETE',
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to disable notifications')
}

export async function registerPushToken(token: string, platform = 'unknown'): Promise<void> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/push-token`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ token, platform }),
  })
  if (!res.ok) await parseError(res, 'Failed to register push token')
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

export async function fetchMyNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/notifications`, {
    headers: await authHeaders(false),
  })
  if (!res.ok) await parseError(res, 'Failed to load notifications')
  return (await res.json()) as { notifications: AppNotification[]; unreadCount: number }
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/notifications/${id}/read`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) await parseError(res, 'Failed to mark read')
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/me/notifications/read-all`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!res.ok) await parseError(res, 'Failed to mark all read')
}

export async function postMosqueAnnouncement(
  mosqueId: string,
  body: { title: string; body: string },
): Promise<{ ok: boolean; notified: number }> {
  const res = await fetchWithTimeout(`${getApiBaseUrl()}/api/manager/mosques/${mosqueId}/announcements`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res, 'Failed to post announcement')
  return (await res.json()) as { ok: boolean; notified: number }
}

