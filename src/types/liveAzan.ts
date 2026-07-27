import type { PrayerName } from '../types'

export type AzanStreamStatus = 'live' | 'upcoming' | 'offline'

export interface LiveAzanFeed {
  mosqueId: string
  mosqueName: string
  area: string
  distance: number
  prayerName: PrayerName
  prayerDisplay: string
  azanTime: string
  status: AzanStreamStatus
  micEnabled: boolean
  streamUrl: string | null
  /** Agora channel when a real broadcast session is live (else null). */
  channel?: string | null
  sessionId?: string | null
  listeners: number
  minutesUntilAzan: number | null
  startedMinutesAgo: number | null
}

export interface LiveAzanResponse {
  feeds: LiveAzanFeed[]
  liveCount: number
  agoraConfigured?: boolean
  serverTime: string
}
