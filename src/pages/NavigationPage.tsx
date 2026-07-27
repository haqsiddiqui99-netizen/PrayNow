import { useState } from 'react'
import { ROUTE_OPTIONS } from '../data/mockData'
import type { Mosque } from '../types'
import { PageHeader } from '../components/PageHeader'
import './NavigationPage.css'

interface NavigationPageProps {
  mosque: Mosque
  onBack: () => void
}

export function NavigationPage({ mosque, onBack }: NavigationPageProps) {
  const [selectedRoute, setSelectedRoute] = useState('fastest')

  const isEarly = mosque.arrivalStatus === 'early'
  const isLate = mosque.arrivalStatus === 'late'
  const route = ROUTE_OPTIONS.find((r) => r.id === selectedRoute) ?? ROUTE_OPTIONS[0]

  const openMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}&travelmode=driving`
    window.open(url, '_blank')
  }

  return (
    <div className="navigation-page fade-in">
      <PageHeader title="Smart Navigation" onBack={onBack} />

      <div className={`nav-hero ${isEarly ? 'success' : isLate ? 'danger' : 'warning'}`}>
        <div className="nav-hero-label">
          {isEarly ? '✅ Perfect Timing!' : isLate ? '⚠️ Tight Schedule' : '⏱️ Just in Time'}
        </div>
        <div className="nav-hero-title">You'll arrive</div>
        <div className="nav-hero-time">
          {isEarly ? '15 min early' : isLate ? '15 min late' : 'on time'}
        </div>
        <div className="nav-hero-mosque">{mosque.name}</div>
      </div>

      <div className="nav-body">
        <div className="nav-stats card">
          <div className="nav-stat">
            <span className="nav-stat-label">Distance</span>
            <span className="nav-stat-value">{mosque.distance} km</span>
          </div>
          <div className="nav-stat">
            <span className="nav-stat-label">Duration</span>
            <span className="nav-stat-value">{route.duration} min</span>
          </div>
          <div className="nav-stat">
            <span className="nav-stat-label">Next Prayer</span>
            <span className="nav-stat-value">Dhuhr 1:15 PM</span>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Route Options</div>
          {ROUTE_OPTIONS.map((r) => (
            <button
              key={r.id}
              className={`route-option card ${selectedRoute === r.id ? 'selected' : ''}`}
              onClick={() => setSelectedRoute(r.id)}
            >
              <div className="route-option-row">
                <span>{r.label} ({r.duration} min)</span>
                {r.recommended && <span className="route-badge">Recommended</span>}
              </div>
            </button>
          ))}
        </div>

        <div className={`timing-indicator ${mosque.arrivalStatus}`}>
          {isEarly && '🟢 You\'ll reach the mosque before Dhuhr — plenty of time for wudu'}
          {!isEarly && !isLate && '🟡 You\'ll arrive just in time — leave now'}
          {isLate && '🔴 You\'ll miss Dhuhr at this mosque — consider a closer option'}
        </div>

        <button className="btn-success" onClick={openMaps}>
          🗺️ Open in Google Maps
        </button>
      </div>
    </div>
  )
}
