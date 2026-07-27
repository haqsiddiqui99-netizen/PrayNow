import { DAILY_VERSE, ISLAMIC_CALENDAR } from '../data/mockData'
import type { Screen } from '../types'
import './MorePage.css'

interface MorePageProps {
  onNavigate: (screen: Screen) => void
}

const MENU_ITEMS: { screen: Screen; icon: string; label: string; desc: string }[] = [
  { screen: 'notifications', icon: '💬', label: 'Messages', desc: 'Mosque timing updates & announcements' },
  { screen: 'live-azan', icon: '🔊', label: 'Live Azan', desc: 'Hear azan from wired mosque mics' },
  { screen: 'admin-login', icon: '🔐', label: 'Admin Portal', desc: 'Manage mosques & timings' },
  { screen: 'qibla', icon: '🧭', label: 'Qibla Direction', desc: 'Find direction to the Kaaba' },
  { screen: 'tracker', icon: '✅', label: 'Prayer Tracker', desc: 'Track your daily prayers' },
  { screen: 'calendar', icon: '📅', label: 'Islamic Calendar', desc: ISLAMIC_CALENDAR.hijriDate },
  { screen: 'restaurants', icon: '🍽️', label: 'Halal Restaurants', desc: 'Find halal food nearby' },
]

export function MorePage({ onNavigate }: MorePageProps) {
  return (
    <div className="more-page fade-in">
      <div className="more-header">
        <h2>More</h2>
      </div>

      <div className="daily-inspiration card">
        <div className="inspiration-label">Daily Verse</div>
        <div className="verse-arabic">{DAILY_VERSE.arabic}</div>
        <div className="verse-translation">"{DAILY_VERSE.translation}"</div>
        <div className="verse-ref">— {DAILY_VERSE.reference}</div>
      </div>

      <div className="more-menu">
        {MENU_ITEMS.map((item) => (
          <button key={item.screen} className="more-menu-item card" onClick={() => onNavigate(item.screen)}>
            <span className="menu-icon">{item.icon}</span>
            <div className="menu-text">
              <span className="menu-label">{item.label}</span>
              <span className="menu-desc">{item.desc}</span>
            </div>
            <span className="menu-arrow">›</span>
          </button>
        ))}
      </div>

      <div className="app-info">
        <div className="app-logo">🕌 PrayNow</div>
        <div className="app-version">Version 1.0.0 · Demo</div>
      </div>
    </div>
  )
}
