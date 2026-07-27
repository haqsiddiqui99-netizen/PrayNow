import type { Mosque } from '../types'
import { PageHeader } from '../components/PageHeader'
import './ReviewsPage.css'

interface ReviewsPageProps {
  mosque: Mosque
  onBack: () => void
}

export function ReviewsPage({ mosque, onBack }: ReviewsPageProps) {
  return (
    <div className="reviews-page fade-in">
      <PageHeader title="Photos & Reviews" onBack={onBack} />

      <div className="reviews-body">
        <h3>{mosque.name}</h3>

        <div className="photos-row">
          {mosque.photos.map((photo, i) => (
            <div key={i} className="photo-thumb">{photo}</div>
          ))}
        </div>

        <div className="rating-summary card">
          <span className="rating-big">⭐ {mosque.rating}</span>
          <span className="rating-count">{mosque.reviewCount.toLocaleString()} reviews</span>
        </div>

        <div className="section">
          <div className="section-title">Reviews</div>
          {mosque.reviews.map((review, i) => (
            <div key={i} className="review-card card">
              <div className="review-header">
                <span className="review-author">{review.author}</span>
                <span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
              </div>
              <p className="review-text">{review.text}</p>
              <span className="review-date">{review.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
