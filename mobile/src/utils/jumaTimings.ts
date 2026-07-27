import type { JumaSession, JumaTimings } from '../types'

const emptySession = (): JumaSession => ({ azan: '', khutba: '', namaz: '' })

function mapSession(s: Partial<JumaSession> | null | undefined, fallbackAzan = ''): JumaSession {
  return {
    azan: (s?.azan || fallbackAzan || '').trim(),
    khutba: (s?.khutba || '').trim(),
    namaz: (s?.namaz || '').trim(),
  }
}

/** Normalize legacy {khutba,namaz} or {sessions} into a non-empty session list. */
export function getJumaSessions(juma?: JumaTimings | null, fallbackAzan = ''): JumaSession[] {
  if (!juma) return [mapSession(emptySession(), fallbackAzan)]
  const topAzan = juma.azan || fallbackAzan
  if (Array.isArray(juma.sessions) && juma.sessions.length > 0) {
    return juma.sessions.map((s, i) => mapSession(s, i === 0 ? topAzan : s?.azan || ''))
  }
  return [mapSession({ azan: topAzan, khutba: juma.khutba, namaz: juma.namaz }, topAzan)]
}

/** Build API payload: keep legacy khutba/namaz as first session + full sessions[]. */
export function toJumaTimingsPayload(sessions: JumaSession[]): JumaTimings {
  const cleaned = (sessions.length ? sessions : [emptySession()]).map((s) => mapSession(s))
  return {
    azan: cleaned[0]?.azan || '',
    khutba: cleaned[0]?.khutba || '',
    namaz: cleaned[0]?.namaz || '',
    sessions: cleaned,
  }
}
