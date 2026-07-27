import { getLiveSessions } from './liveAzanSessions.js'
import { getAgoraAppId } from './agora.js'

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const DEMO_STREAM = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8f/Adhan.ogg/Adhan.ogg.mp3'

const AZAN_LIVE_BEFORE = 1
const AZAN_LIVE_AFTER = 6

function parseTime(time) {
  const [clock, period] = time.split(' ')
  const [hours, minutes] = clock.split(':').map(Number)
  let h = hours
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h * 60 + minutes
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes()
}

function isFriday(date = new Date()) {
  return date.getDay() === 5
}

function prayerDisplay(name, date = new Date()) {
  if (name === 'Dhuhr' && isFriday(date)) return 'Juma'
  return name
}

function getCurrentPrayer(schedule, date = new Date()) {
  const now = nowMinutes(date)
  for (const row of schedule) {
    const start = parseTime(row.start_time)
    const end = parseTime(row.end_time)
    const inWindow = start <= end
      ? now >= start && now < end
      : now >= start || now < end
    if (inWindow) return row.prayer_name
  }
  return null
}

function resolveStatus(azanTime, micEnabled, date = new Date()) {
  if (!micEnabled) return { status: 'offline', minutesUntil: null, startedAgo: null }
  const now = nowMinutes(date)
  const azan = parseTime(azanTime)
  if (now >= azan - AZAN_LIVE_BEFORE && now <= azan + AZAN_LIVE_AFTER) {
    return { status: 'live', minutesUntil: null, startedAgo: Math.max(0, now - azan) }
  }
  if (now < azan) return { status: 'upcoming', minutesUntil: azan - now, startedAgo: null }
  return { status: 'upcoming', minutesUntil: 24 * 60 - now + azan, startedAgo: null }
}

export async function buildLiveAzanFeeds(client) {
  const { rows: schedule } = await client.query(
    `SELECT prayer_name, start_time, end_time FROM city_prayer_schedule ORDER BY prayer_name`,
  )
  const prayer = getCurrentPrayer(schedule)

  // Real broadcast sessions started by mosque managers. These override the
  // time-window heuristic: any mosque with an active session is truly "live".
  const liveSessions = await getLiveSessions(client)
  const sessionByMosque = new Map()
  for (const s of liveSessions) {
    sessionByMosque.set(s.mosqueDbId, s)
  }

  if (!prayer && liveSessions.length === 0) {
    return { feeds: [], liveCount: 0, agoraConfigured: Boolean(getAgoraAppId()), serverTime: new Date().toISOString() }
  }

  // Load timing rows for the current prayer (if any) so we can also show
  // upcoming/offline mosques alongside the live ones.
  let timingRows = []
  if (prayer) {
    const { rows } = await client.query(
      `SELECT mosques.legacy_id, mosques.id, mosques.name, mosques.area,
              COALESCE(mosques.mic_enabled, TRUE) AS mic_enabled,
              mosques.stream_url,
              mosque_timings.azan
       FROM mosques
       INNER JOIN mosque_timings ON mosque_timings.mosque_id = mosques.id
         AND mosque_timings.prayer_name = $1
       WHERE mosques.is_active = TRUE
       ORDER BY mosques.name`,
      [prayer],
    )
    timingRows = rows
  }

  const feeds = timingRows.map((m) => {
    const micEnabled = m.mic_enabled !== false
    const session = sessionByMosque.get(m.id)
    const base = resolveStatus(m.azan, micEnabled)
    const isLive = Boolean(session)
    return {
      mosqueId: m.legacy_id || m.id,
      mosqueName: m.name,
      area: m.area,
      distance: 0,
      prayerName: prayer,
      prayerDisplay: prayerDisplay(prayer),
      azanTime: m.azan,
      status: isLive ? 'live' : base.status,
      micEnabled,
      streamUrl: micEnabled ? (m.stream_url || DEMO_STREAM) : null,
      channel: session?.channel ?? null,
      sessionId: session?.sessionId ?? null,
      listeners: session?.listeners ?? 0,
      minutesUntilAzan: isLive ? null : base.minutesUntil,
      startedMinutesAgo: isLive ? 0 : base.startedAgo,
    }
    })

  // Include any live session whose mosque wasn't in the current prayer's timing
  // rows (e.g. between prayer windows) so it still appears as live.
  const includedMosqueDbIds = new Set(timingRows.map((m) => m.id))
  for (const s of liveSessions) {
    if (includedMosqueDbIds.has(s.mosqueDbId)) continue
    feeds.push({
      mosqueId: s.mosqueId,
      mosqueName: s.mosqueName,
      area: s.area,
      distance: 0,
      prayerName: s.prayerName || prayer,
      prayerDisplay: s.prayerName ? prayerDisplay(s.prayerName) : (prayer ? prayerDisplay(prayer) : ''),
      azanTime: '',
      status: 'live',
      micEnabled: true,
      streamUrl: DEMO_STREAM,
      channel: s.channel,
      sessionId: s.sessionId,
      listeners: s.listeners ?? 0,
      minutesUntilAzan: null,
      startedMinutesAgo: 0,
    })
  }

  const order = { live: 0, upcoming: 1, offline: 2 }
  feeds.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return (a.minutesUntilAzan ?? 999) - (b.minutesUntilAzan ?? 999)
  })

  return {
    feeds,
    liveCount: feeds.filter((f) => f.status === 'live').length,
    agoraConfigured: Boolean(getAgoraAppId()),
    serverTime: new Date().toISOString(),
  }
}
