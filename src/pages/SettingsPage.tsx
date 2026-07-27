import { useState } from 'react'
import { useUserAuth } from '../context/UserAuthContext'
import './SettingsPage.css'

interface SettingsPageProps {
  onBack: () => void
  onLogin: () => void
}

export function SettingsPage({ onBack, onLogin }: SettingsPageProps) {
  const { user, logout, isAuthenticated } = useUserAuth()
  const [prayerAlerts, setPrayerAlerts] = useState(true)
  const [nearbyMosques, setNearbyMosques] = useState(true)

  return (
    <div className="settings-page fade-in">
      <header className="page-header">
        <button type="button" className="back-btn" onClick={onBack}>←</button>
        <h1>Settings</h1>
      </header>

      <div className="settings-body">
        <div className="settings-section card">
          <div className="settings-section-title">Notifications</div>
          <label className="settings-toggle">
            <span>Prayer time alerts</span>
            <input
              type="checkbox"
              checked={prayerAlerts}
              onChange={(e) => setPrayerAlerts(e.target.checked)}
            />
          </label>
          <label className="settings-toggle">
            <span>Nearby mosque updates</span>
            <input
              type="checkbox"
              checked={nearbyMosques}
              onChange={(e) => setNearbyMosques(e.target.checked)}
            />
          </label>
        </div>

        <div className="settings-section card">
          <div className="settings-section-title">Account</div>
          {isAuthenticated ? (
            <>
              <div className="settings-info-row">
                <span>Signed in as</span>
                <strong>{user?.email}</strong>
              </div>
              <button type="button" className="settings-action settings-action--danger" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="settings-action settings-action--primary" onClick={onLogin}>
              Sign in
            </button>
          )}
        </div>

        <p className="settings-version">PrayNow v0.1</p>
      </div>
    </div>
  )
}
