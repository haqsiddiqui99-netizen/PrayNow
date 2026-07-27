import { DAILY_HADITH, HADITH_COLLECTION } from '../data/mockData'
import './HadithPage.css'

export function HadithPage() {
  const moreHadiths = HADITH_COLLECTION.filter((h) => h !== DAILY_HADITH)

  return (
    <div className="hadith-page fade-in">
      <div className="hadith-header">
        <h2>Hadith</h2>
        <p>Daily wisdom from the Sunnah</p>
      </div>

      <div className="hadith-featured card">
        <div className="hadith-label">Hadith of the Day</div>
        <div className="hadith-quote">"{DAILY_HADITH.text}"</div>
        <div className="hadith-source">— {DAILY_HADITH.source}</div>
      </div>

      <div className="hadith-section">
        <div className="hadith-section-title">More Hadiths</div>
        <div className="hadith-list">
          {moreHadiths.map((hadith) => (
            <div key={hadith.source} className="hadith-card card">
              <div className="hadith-quote">"{hadith.text}"</div>
              <div className="hadith-source">— {hadith.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
