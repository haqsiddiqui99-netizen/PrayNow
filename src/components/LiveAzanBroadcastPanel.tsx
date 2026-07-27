import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { AzanBroadcaster, isAgoraSupported } from '../services/agoraClient'
import './LiveAzanBroadcastPanel.css'

interface Props {
  mosqueId: string
  mosqueName: string
  prayerName?: string
}

/**
 * Mosque-admin control to broadcast azan live from the browser microphone.
 * Start → captures mic + publishes to the mosque's Agora channel and marks the
 * session live on the server. Stop → ends the session (manual stop only).
 */
export function LiveAzanBroadcastPanel({ mosqueId, mosqueName, prayerName }: Props) {
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const broadcasterRef = useRef<AzanBroadcaster | null>(null)
  const supported = isAgoraSupported()

  // Live elapsed timer.
  useEffect(() => {
    if (!live) return
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [live])

  // Safety: stop broadcasting if the panel unmounts.
  useEffect(() => {
    return () => {
      void broadcasterRef.current?.stop()
    }
  }, [])

  const startAzan = async () => {
    setBusy(true)
    setError('')
    try {
      const { agora } = await api.admin.startAzan(mosqueId, prayerName)
      if (!agora.configured) {
        throw new Error('Live audio is not configured on the server. Add AGORA_APP_ID in server/.env.')
      }
      const broadcaster = new AzanBroadcaster()
      await broadcaster.start(agora)
      broadcasterRef.current = broadcaster
      setElapsed(0)
      setLive(true)
    } catch (e) {
      // Roll back the server session if publishing failed.
      await api.admin.stopAzan(mosqueId).catch(() => {})
      setError(e instanceof Error ? e.message : 'Could not start azan')
    } finally {
      setBusy(false)
    }
  }

  const stopAzan = async () => {
    setBusy(true)
    try {
      await broadcasterRef.current?.stop()
      broadcasterRef.current = null
      await api.admin.stopAzan(mosqueId)
      setLive(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop azan')
    } finally {
      setBusy(false)
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className={`azan-broadcast${live ? ' azan-broadcast--live' : ''}`}>
      <div className="azan-broadcast-head">
        <span className={`azan-broadcast-dot${live ? ' on' : ''}`} />
        <div>
          <strong>Live Azan Broadcast</strong>
          <p>{live ? `On air · ${mm}:${ss}` : `Broadcast azan from ${mosqueName}`}</p>
        </div>
      </div>

      {!supported && (
        <p className="azan-broadcast-warn">
          This browser does not support live audio. Use a recent Chrome/Edge/Safari over HTTPS (or localhost).
        </p>
      )}

      {error && <p className="azan-broadcast-error">{error}</p>}

      {!live ? (
        <button
          type="button"
          className="azan-broadcast-btn azan-broadcast-btn--start"
          onClick={() => void startAzan()}
          disabled={busy || !supported}
        >
          {busy ? 'Starting…' : '🎙️ Start Azan'}
        </button>
      ) : (
        <button
          type="button"
          className="azan-broadcast-btn azan-broadcast-btn--stop"
          onClick={() => void stopAzan()}
          disabled={busy}
        >
          {busy ? 'Stopping…' : '⏹ Stop Azan'}
        </button>
      )}

      <p className="azan-broadcast-hint">
        Listeners hear your microphone in real time. Broadcast stays live until you tap Stop.
      </p>
    </div>
  )
}
