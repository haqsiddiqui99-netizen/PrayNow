import { useEffect, useRef, useState } from 'react'
import { LiveAzanVisualizer } from '../components/LiveAzanVisualizer'
import { useLiveAzan } from '../hooks/useLiveAzan'
import type { LiveAzanFeed } from '../types/liveAzan'
import { formatAzanCountdown } from '../utils/liveAzan'
import { api } from '../services/api'
import { AzanListener } from '../services/agoraClient'
import './LiveAzanPage.css'

function statusLabel(feed: LiveAzanFeed): string {
  if (feed.status === 'live') {
    return feed.startedMinutesAgo
      ? `Live · started ${feed.startedMinutesAgo}m ago`
      : 'Live now'
  }
  if (feed.status === 'upcoming') return formatAzanCountdown(feed.minutesUntilAzan)
  return 'Mic offline'
}

export function LiveAzanPage() {
  const { feeds, liveCount, loading } = useLiveAzan()
  const [selected, setSelected] = useState<LiveAzanFeed | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.85)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listenerRef = useRef<AzanListener | null>(null)

  const liveFeeds = feeds.filter((f) => f.status === 'live')
  const upcomingFeeds = feeds.filter((f) => f.status === 'upcoming')
  const active = selected ?? liveFeeds[0] ?? feeds[0] ?? null

  useEffect(() => {
    if (!selected && liveFeeds[0]) setSelected(liveFeeds[0])
  }, [liveFeeds, selected])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  // Playback: use the real Agora broadcast channel when live; otherwise fall
  // back to the recorded/demo stream URL via <audio>.
  useEffect(() => {
    let cancelled = false
    const audio = audioRef.current

    async function stopAll() {
      audio?.pause()
      await listenerRef.current?.stop()
      listenerRef.current = null
    }

    async function run() {
      if (!active || active.status !== 'live' || !playing) {
        await stopAll()
        return
      }

      if (active.channel) {
        // Real live broadcast → join the Agora channel as audience.
        try {
          const { agora } = await api.listenToken(active.mosqueId)
          if (cancelled) return
          await stopAll()
          const listener = new AzanListener()
          await listener.start(agora)
          if (cancelled) {
            await listener.stop()
            return
          }
          listenerRef.current = listener
        } catch {
          if (!cancelled) setPlaying(false)
        }
        return
      }

      // No live channel → play the fallback stream/recording.
      if (audio && active.streamUrl) {
        await listenerRef.current?.stop()
        listenerRef.current = null
        audio.src = active.streamUrl
        void audio.play().catch(() => setPlaying(false))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [active, playing])

  // Cleanup the Agora listener when leaving the page.
  useEffect(() => {
    return () => {
      void listenerRef.current?.stop()
    }
  }, [])

  const togglePlay = () => {
    if (!active?.streamUrl) return
    setPlaying((p) => !p)
  }

  const selectFeed = (feed: LiveAzanFeed) => {
    setSelected(feed)
    if (feed.status === 'live' && feed.streamUrl) setPlaying(true)
    else setPlaying(false)
  }

  return (
    <div className="live-azan-page fade-in">
      <div className="live-azan-header">
        <h2>Live Azan</h2>
        <p>Mosque mic streams · hear azan as it happens</p>
      </div>

      {loading ? (
        <p className="live-azan-loading">Connecting to mosque feeds…</p>
      ) : (
        <>
          <div className={`live-azan-hero card${active?.status === 'live' ? ' live-azan-hero--on-air' : ''}`}>
            {active ? (
              <>
                <div className="live-azan-hero-top">
                  {active.status === 'live' ? (
                    <span className="live-azan-badge">
                      <span className="live-azan-dot" />
                      LIVE
                    </span>
                  ) : (
                    <span className="live-azan-badge live-azan-badge--muted">
                      {active.status === 'upcoming' ? 'UPCOMING' : 'OFFLINE'}
                    </span>
                  )}
                  {active.status === 'live' && (
                    <span className="live-azan-listeners">{active.listeners} listening</span>
                  )}
                </div>

                <div className="live-azan-hero-mosque">{active.mosqueName}</div>
                <div className="live-azan-hero-meta">
                  {active.prayerDisplay} Azan · {active.azanTime} · {active.area}
                </div>

                <LiveAzanVisualizer active={playing && active.status === 'live'} />

                <div className="live-azan-controls">
                  <button
                    type="button"
                    className={`live-azan-play${playing ? ' live-azan-play--active' : ''}`}
                    onClick={togglePlay}
                    disabled={!active.streamUrl || active.status !== 'live'}
                    aria-label={playing ? 'Pause azan' : 'Play live azan'}
                  >
                    {playing ? '⏸' : '▶'}
                  </button>
                  <label className="live-azan-volume">
                    <span>🔊</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                    />
                  </label>
                </div>

                {active.status !== 'live' && (
                  <p className="live-azan-hint">
                    {active.status === 'upcoming'
                      ? `${active.mosqueName} azan ${formatAzanCountdown(active.minutesUntilAzan)}`
                      : 'This mosque mic is not wired yet'}
                  </p>
                )}
              </>
            ) : (
              <p className="live-azan-empty-hero">No prayer window active right now</p>
            )}
          </div>

          {liveCount > 0 && (
            <section className="live-azan-section">
              <h3 className="live-azan-section-title">
                <span className="live-azan-dot" /> On air now ({liveCount})
              </h3>
              <div className="live-azan-list">
                {liveFeeds.map((feed) => (
                  <button
                    key={feed.mosqueId}
                    type="button"
                    className={`live-azan-card card${active?.mosqueId === feed.mosqueId ? ' live-azan-card--selected' : ''}`}
                    onClick={() => selectFeed(feed)}
                  >
                    <div className="live-azan-card-main">
                      <strong>{feed.mosqueName}</strong>
                      <span>{feed.prayerDisplay} · {feed.azanTime}</span>
                    </div>
                    <span className="live-azan-card-status live">{statusLabel(feed)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {upcomingFeeds.length > 0 && (
            <section className="live-azan-section">
              <h3 className="live-azan-section-title">Upcoming azan</h3>
              <div className="live-azan-list">
                {upcomingFeeds.map((feed) => (
                  <button
                    key={feed.mosqueId}
                    type="button"
                    className={`live-azan-card card${active?.mosqueId === feed.mosqueId ? ' live-azan-card--selected' : ''}`}
                    onClick={() => selectFeed(feed)}
                  >
                    <div className="live-azan-card-main">
                      <strong>{feed.mosqueName}</strong>
                      <span>{feed.area} · {feed.azanTime}</span>
                    </div>
                    <span className="live-azan-card-status">{statusLabel(feed)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="live-azan-footnote card">
            <span className="live-azan-footnote-icon">🎙️</span>
            <p>
              Wired mosques broadcast azan from their microphone when azan time starts.
              Stream auto-connects during the live window.
            </p>
          </div>
        </>
      )}

      <audio ref={audioRef} preload="none" playsInline />
    </div>
  )
}
