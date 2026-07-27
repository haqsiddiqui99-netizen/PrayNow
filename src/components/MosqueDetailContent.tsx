import type { Mosque } from '../types'
import { MosqueFacilitiesLine } from './MosqueFacilitiesLine'
import { MosqueNotifyToggle } from './MosqueNotifyToggle'
import './MosqueFacilitiesLine.css'
import '../pages/MosqueDetailPage.css'

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const

interface MosqueDetailContentProps {
  mosque: Mosque
  compact?: boolean
  onNeedLogin?: () => void
}

export function MosqueDetailContent({ mosque, compact, onNeedLogin }: MosqueDetailContentProps) {
  const jumaKhutba = mosque.jumaTimings.khutba || mosque.timings.Dhuhr.azan
  const jumaNamaz = mosque.jumaTimings.namaz || mosque.timings.Dhuhr.jamat

  return (
    <>
      <div className={`detail-title-section${compact ? ' detail-title-section--compact' : ''}`}>
        <div className="detail-title-row">
          <h2>{mosque.name}</h2>
          <MosqueNotifyToggle mosqueId={mosque.id} onNeedLogin={onNeedLogin} />
        </div>
        <div className="detail-meta">
          <span>📍 {mosque.distance} km</span>
          {mosque.capacity > 0 && <span>👥 {mosque.capacity.toLocaleString()}</span>}
          {mosque.sect && <span>{mosque.sect}</span>}
        </div>
        <div className="detail-address">{mosque.address}</div>
        <MosqueFacilitiesLine facilities={mosque.facilities} className="mosque-facilities-line--detail" />
        <div className="detail-contact">📞 {mosque.phone}</div>
      </div>

      <div className="section">
        <div className="section-title">Prayer Times</div>
        <div className="detail-prayer-grid">
          {PRAYER_ORDER.map((name) => (
            <div key={name} className="detail-prayer-cell">
              <span className="prayer-label">{name}</span>
              <span className="prayer-time">
                {mosque.timings[name].azan} / {mosque.timings[name].jamat}
              </span>
            </div>
          ))}
          <div className="detail-prayer-cell">
            <span className="prayer-label">Juma</span>
            <span className="prayer-time">
              {jumaKhutba} / {jumaNamaz}
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Imam & Sermon</div>
        <div className="info-row">
          <span className="info-label">Imam</span>
          <span>{mosque.imam}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Language</span>
          <span>{mosque.sermonLanguage}</span>
        </div>
      </div>

      {mosque.events.length > 0 && (
        <div className="section">
          <div className="section-title">Events & Classes</div>
          {mosque.events.map((e) => (
            <div key={e} className="event-item">📅 {e}</div>
          ))}
        </div>
      )}

      <div className={`arrival-badge ${mosque.arrivalStatus}`}>
        {mosque.arrivalStatus === 'early' ? '🟢' : mosque.arrivalStatus === 'on-time' ? '🟡' : '🔴'}{' '}
        {mosque.arrivalMessage}
      </div>
    </>
  )
}
