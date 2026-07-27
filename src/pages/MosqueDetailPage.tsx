import { PRAYER_TIMES } from '../data/mockData'
import type { Mosque } from '../types'
import { MosqueDetailContent } from '../components/MosqueDetailContent'
import './MosqueDetailPage.css'

interface MosqueDetailPageProps {
  mosque: Mosque
  onBack: () => void
  onDirections: () => void
  onReviews: () => void
  onNeedLogin?: () => void
}

export function MosqueDetailPage({ mosque, onBack, onDirections, onReviews, onNeedLogin }: MosqueDetailPageProps) {
  return (
    <div className="mosque-detail fade-in">
      <div className="detail-hero">
        <button className="hero-back" onClick={onBack}>←</button>
        <div className="hero-emoji">{mosque.photos[0]}</div>
      </div>

      <div className="detail-body">
        <MosqueDetailContent mosque={mosque} onNeedLogin={onNeedLogin} />

        <div className="section">
          <div className="section-title">City Schedule</div>
          <div className="detail-prayer-grid">
            {PRAYER_TIMES.map((p) => (
              <div key={p.name} className="detail-prayer-cell">
                <span className="prayer-label">{p.name}</span>
                <span className={`prayer-time ${p.name === 'Dhuhr' ? 'active' : ''}`}>
                  {p.start}{p.completed ? ' ✓' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn-accent" onClick={onDirections}>Get Directions</button>
        <div style={{ height: 8 }} />
        <button className="btn-outline" onClick={onReviews}>See Photos & Reviews</button>
      </div>
    </div>
  )
}
