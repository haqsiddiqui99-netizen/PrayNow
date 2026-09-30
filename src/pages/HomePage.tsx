import { useEffect, useState } from 'react'
import { NearbyMosques } from '../components/NearbyMosques'
import { UserMenu } from '../components/UserMenu'
import { formatHijriDate } from '../utils/hijriDate'
import { useWeatherHeader, type WeatherTheme } from '../hooks/useWeatherHeader'
import { api } from '../services/api'
import { mapApiCitySettings, setCityPrayerConfig } from '../config/cityPrayerConfig'
import type { Mosque, Screen } from '../types'
import {
  formatCompactTime,
  formatPrayerRakats,
  getLivePrayerInfo,
  getPrayerRakats,
  getPrayerStatusExtras,
  type LivePrayerInfo,
} from '../utils/prayerSchedule'
import './HomePage.css'
import '../components/UserMenu.css'

interface HomePageProps {
  onSelectMosque: (mosque: Mosque) => void
  onNavigate: (screen: Screen) => void
}

function weatherIcon(theme: WeatherTheme): string {
  switch (theme) {
    case 'night':
      return '🌙'
    case 'rainy':
      return '🌧️'
    case 'cloudy':
      return '☁️'
    default:
      return '☀️'
  }
}

export function HomePage({ onSelectMosque, onNavigate }: HomePageProps) {
  const [prayerInfo, setPrayerInfo] = useState<LivePrayerInfo>(getLivePrayerInfo)

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.getCitySettings()
        setCityPrayerConfig(mapApiCitySettings(data))
        setPrayerInfo(getLivePrayerInfo())
      } catch {
        // keep mock defaults when API offline
      }
    })()
  }, [])

  const {
    theme,
    currentTime,
    currentDate,
    temperature,
    condition,
    locationLabel,
    locationLoading,
    locationLive,
    locationError,
    refreshLocation,
    loading,
    isLive,
  } = useWeatherHeader()

  useEffect(() => {
    const interval = setInterval(() => setPrayerInfo(getLivePrayerInfo()), 30000)
    return () => clearInterval(interval)
  }, [])

  const prayerExtras = getPrayerStatusExtras(prayerInfo)

  return (
    <div className="home-page fade-in">
      <header className={`home-status-bar home-status-bar--${theme}${loading ? ' home-status-bar--loading' : ''}`}>
        <div className="status-bar-row status-bar-row--location">
          <button
            type="button"
            className="status-bar-location-block"
            onClick={() => { void refreshLocation() }}
            disabled={locationLoading}
            title={locationError ?? 'Tap to update your location'}
            aria-label={locationLoading ? 'Updating location' : 'Update your location'}
          >
            <span className="status-bar-pin" aria-hidden="true">📍</span>
            <span className="status-bar-location">
              {locationLoading
                ? 'Updating location…'
                : locationError
                  ? `${locationLabel} (approx.)`
                  : locationLabel}
            </span>
            {locationLive && !locationLoading && (
              <span className="status-bar-gps" title="Using your live location">●</span>
            )}
            {!locationLoading && (
              <span className="status-bar-refresh" aria-hidden="true">↻</span>
            )}
          </button>
          <div className="status-bar-actions">
            <UserMenu onNavigate={onNavigate} />
            <time className="status-bar-clock">{currentTime}</time>
          </div>
        </div>
        <div className="status-bar-row">
          <div className="status-bar-primary">
            <span className="status-bar-icon" aria-hidden="true">{weatherIcon(theme)}</span>
            {temperature !== null && (
              <>
                <span className="status-bar-temp">{Math.round(temperature)}°C</span>
                <span className="status-bar-sep">·</span>
              </>
            )}
            <span className="status-bar-condition">{loading ? 'Loading…' : condition}</span>
            {isLive && <span className="status-bar-live" title="Live weather">●</span>}
          </div>
        </div>
        <div className="status-bar-row status-bar-row--meta">
          <span className="status-bar-hijri">{formatHijriDate(new Date())}</span>
          <span className="status-bar-sep">·</span>
          <span className="status-bar-date">{currentDate}</span>
        </div>
      </header>

      <div className="home-body">
        <div className="prayer-rainbow-frame">
        <div className="prayer-status card">
          <div className="prayer-status-main">
            {prayerInfo.current ? (
              <div className="prayer-block prayer-block--current">
                <div className="prayer-block-label">Current Prayer Time</div>
                {prayerInfo.current.name === 'Dhuhr' && (
                  <div className="prayer-zawal-extras prayer-zawal-extras--before">
                    <div
                      className={`prayer-extra-row zawal${prayerInfo.zawalTimings.inZawal ? ' zawal--active' : ''}`}
                    >
                      <span className="prayer-extra-label">Zawal</span>
                      <span>
                        {formatCompactTime(prayerInfo.zawalTimings.start)} — {formatCompactTime(prayerInfo.zawalTimings.end)}
                      </span>
                    </div>
                    {prayerInfo.zawalTimings.inZawal && (
                      <div className="zawal-warning">
                        🔴 Praying is prohibited during Zawal
                      </div>
                    )}
                  </div>
                )}
                <div className="prayer-block-name">{prayerInfo.current.displayName}</div>
                <div className="prayer-block-rakats">
                  {formatPrayerRakats(getPrayerRakats(prayerInfo.current.name))}
                </div>
                <div className="prayer-timing-pills">
                  <div className="prayer-timing-pill">
                    <span className="prayer-extra-label">Start</span>
                    <span className="prayer-extra-value">{prayerInfo.current.start}</span>
                  </div>
                  <div className="prayer-timing-pill">
                    <span className="prayer-extra-label">End</span>
                    <span className="prayer-extra-value">{prayerInfo.current.end}</span>
                  </div>
                </div>
                {prayerInfo.current.name === 'Fajr' && (
                  <div className="prayer-end-note">Namaz ends at End time</div>
                )}
              </div>
            ) : (
              <div className="prayer-block prayer-block--current">
                <div className="prayer-block-label">Current Prayer Time</div>
                <div className="prayer-block-idle">No active prayer window</div>
              </div>
            )}

            <div className="prayer-vdivider" />

            <div className="prayer-block prayer-block--next">
              <div className="prayer-block-label">Next Prayer</div>
              {prayerInfo.next.name === 'Dhuhr' && prayerInfo.current?.name !== 'Dhuhr' && (
                <div className="prayer-zawal-extras prayer-zawal-extras--before">
                  <div
                    className={`prayer-extra-row zawal${prayerInfo.zawalTimings.inZawal ? ' zawal--active' : ''}`}
                  >
                    <span className="prayer-extra-label">Zawal</span>
                    <span>
                      {formatCompactTime(prayerInfo.zawalTimings.start)} — {formatCompactTime(prayerInfo.zawalTimings.end)}
                    </span>
                  </div>
                  {prayerInfo.zawalTimings.inZawal && (
                    <div className="zawal-warning">🔴 Praying is prohibited during Zawal</div>
                  )}
                </div>
              )}
              <div className="prayer-block-name next">{prayerInfo.next.displayName}</div>
              <div className="prayer-block-times">
                Starts at {prayerInfo.next.start}
              </div>
              <div className="prayer-countdown-pill">{prayerInfo.next.countdown}</div>
            </div>
          </div>

          {prayerExtras && (
            <div className="prayer-status-extras">
              {prayerExtras.heading && (
                <div className="prayer-extras-heading">{prayerExtras.heading}</div>
              )}
              {prayerExtras.nightTimings && (
                <div className="prayer-night-grid">
                  <div className="prayer-night-col">
                    <div className="prayer-night-row">
                      <span className="prayer-night-label">Tahajjud Start</span>
                      <span className="prayer-night-dash">-</span>
                      <span className="prayer-night-value">
                        {formatCompactTime(prayerExtras.nightTimings.tahajjud.start)}
                      </span>
                    </div>
                    <div className="prayer-night-row">
                      <span className="prayer-night-label">Tahajjud End</span>
                      <span className="prayer-night-dash">-</span>
                      <span className="prayer-night-value">
                        {formatCompactTime(prayerExtras.nightTimings.tahajjud.end)}
                      </span>
                    </div>
                  </div>
                  <div className="prayer-night-col">
                    <div className="prayer-night-row">
                      <span className="prayer-night-label">Sehri Start</span>
                      <span className="prayer-night-dash">-</span>
                      <span className="prayer-night-value">
                        {formatCompactTime(prayerExtras.nightTimings.sehri.start)}
                      </span>
                    </div>
                    <div className="prayer-night-row">
                      <span className="prayer-night-label">Sehri End</span>
                      <span className="prayer-night-dash">-</span>
                      <span className="prayer-night-value">
                        {formatCompactTime(prayerExtras.nightTimings.sehri.end)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {prayerExtras.items.length > 0 && (
                <div className="prayer-extras-grid">
                  {prayerExtras.items.map((item) => (
                    <div
                      key={item.id}
                      className={`prayer-extra-chip${item.variant ? ` ${item.variant}` : ''}${item.active ? ` ${item.variant}--active` : ''}`}
                    >
                      <span className="prayer-extra-label">{item.label}</span>
                      <span className="prayer-extra-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {prayerExtras?.alerts.map((alert) => (
            <div key={alert.id} className={`prayer-status-alert ${alert.id}-warning`}>
              {alert.message}
            </div>
          ))}

          {prayerInfo.zawalTimings.inZawal && prayerInfo.current?.name === 'Dhuhr' && (
            <div className="prayer-status-alert zawal-warning">
              🔴 Praying is prohibited during Zawal
            </div>
          )}
        </div>
        </div>

        <NearbyMosques
          onSelectMosque={onSelectMosque}
          onNeedLogin={() => onNavigate('login')}
        />
      </div>
    </div>
  )
}
