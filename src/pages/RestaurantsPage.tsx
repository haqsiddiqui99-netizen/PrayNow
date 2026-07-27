import { HALAL_RESTAURANTS } from '../data/mockData'
import { PageHeader } from '../components/PageHeader'
import './RestaurantsPage.css'

interface RestaurantsPageProps {
  onBack: () => void
}

export function RestaurantsPage({ onBack }: RestaurantsPageProps) {
  return (
    <div className="restaurants-page fade-in">
      <PageHeader title="Halal Restaurants" onBack={onBack} />

      <div className="restaurants-body">
        <p className="restaurants-subtitle">Halal dining options near Delhi</p>

        {HALAL_RESTAURANTS.map((r) => (
          <div key={r.id} className="restaurant-card card">
            <div className="restaurant-info">
              <div className="restaurant-name">{r.name}</div>
              <div className="restaurant-cuisine">{r.cuisine}</div>
              <div className="restaurant-meta">
                <span>📍 {r.distance} km</span>
                <span>★ {r.rating}</span>
              </div>
            </div>
            <button className="restaurant-directions" onClick={() => {
              window.open(`https://www.google.com/maps/search/${encodeURIComponent(r.name + ' Delhi')}`, '_blank')
            }}>
              Directions
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
