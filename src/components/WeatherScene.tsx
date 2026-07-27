import type { WeatherTheme } from '../hooks/useWeatherHeader'
import './WeatherScene.css'

interface WeatherSceneProps {
  theme: WeatherTheme
  precipitation?: number
}

export function WeatherScene({ theme, precipitation = 0 }: WeatherSceneProps) {
  const rainCount = precipitation > 0 ? Math.min(12, 8 + Math.round(precipitation * 2)) : 8
  return (
    <div className={`weather-scene weather-scene--${theme}`} aria-hidden="true">
      {theme === 'sunny' && (
        <>
          <div className="weather-sun">
            <div className="sun-core" />
            <div className="sun-rays" />
          </div>
        </>
      )}

      {theme === 'night' && (
        <>
          <span className="star star-1">✦</span>
          <span className="star star-2">✦</span>
          <span className="star star-3">·</span>
          <span className="star star-4">✦</span>
          <span className="star star-5">·</span>
          <div className="weather-moon" />
        </>
      )}

      {theme === 'rainy' && (
        <>
          <div className="weather-cloud weather-cloud-1" />
          <div className="weather-cloud weather-cloud-2" />
          {Array.from({ length: rainCount }).map((_, i) => (
            <span key={i} className={`raindrop raindrop-${(i % 8) + 1}`} style={{ animationDelay: `${(i * 0.12) % 0.8}s` }} />
          ))}
        </>
      )}

      {theme === 'cloudy' && (
        <>
          <div className="weather-sun weather-sun--dim" />
          <div className="weather-cloud weather-cloud-1" />
          <div className="weather-cloud weather-cloud-2" />
        </>
      )}
    </div>
  )
}
