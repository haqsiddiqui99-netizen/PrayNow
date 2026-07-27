// Agora RTC token helper for live azan streaming.
//
// Auth modes:
//  - Full (recommended): set AGORA_APP_ID + AGORA_APP_CERTIFICATE. Tokens are
//    generated per channel/role and required by clients to join.
//  - App-ID only (dev/testing): set AGORA_APP_ID only. buildRtcToken returns null
//    and clients join with just the App ID (Agora project must be in testing mode).
//  - Unconfigured: no AGORA_APP_ID. Sessions still track live state, but no audio
//    can be transmitted; responses carry `configured: false`.

import agoraToken from 'agora-token'

const { RtcTokenBuilder, RtcRole } = agoraToken

const DEFAULT_TTL_SECONDS = 60 * 60 // 1 hour

export function getAgoraAppId() {
  return process.env.AGORA_APP_ID?.trim() || null
}

function getAgoraCertificate() {
  return process.env.AGORA_APP_CERTIFICATE?.trim() || null
}

/** True when at least an App ID is configured (audio can flow). */
export function isAgoraConfigured() {
  return Boolean(getAgoraAppId())
}

/**
 * Build an RTC token for a channel.
 * @param {string} channel   Agora channel name
 * @param {'publisher'|'subscriber'} role
 * @param {number} uid        0 = SDK assigns uid (token valid for any assigned uid)
 * @param {number} ttlSeconds token lifetime
 * @returns {string|null}     null when running in App-ID-only / unconfigured mode
 */
export function buildRtcToken(channel, role = 'subscriber', uid = 0, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const appId = getAgoraAppId()
  const certificate = getAgoraCertificate()
  if (!appId || !certificate) return null

  const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER
  const now = Math.floor(Date.now() / 1000)
  const expire = now + ttlSeconds
  return RtcTokenBuilder.buildTokenWithUid(appId, certificate, channel, uid, rtcRole, expire, expire)
}

/**
 * Build the Agora join payload returned to clients.
 * @param {string} channel
 * @param {'publisher'|'subscriber'} role
 * @param {number} uid
 */
export function buildAgoraCredentials(channel, role, uid = 0, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const appId = getAgoraAppId()
  return {
    configured: Boolean(appId),
    appId,
    channel,
    uid,
    role,
    token: buildRtcToken(channel, role, uid, ttlSeconds),
    expiresIn: ttlSeconds,
  }
}

/** Stable Agora channel name for a mosque. */
export function channelForMosque(mosqueDbId) {
  return `praynow-${mosqueDbId}`
}
