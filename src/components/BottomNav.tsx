import type { Screen } from '../types'

interface BottomNavProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'home', icon: '🕌', label: 'Home' },
  { screen: 'mosques', icon: '📍', label: 'Mosques' },
  { screen: 'live-azan', icon: '🔊', label: 'Azan' },
  { screen: 'chat', icon: '🤖', label: 'AI' },
  { screen: 'hadith', icon: '📜', label: 'Hadith' },
  { screen: 'more', icon: '☰', label: 'More' },
]

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const mainScreens: Screen[] = ['home', 'mosques', 'live-azan', 'chat', 'hadith', 'more']

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ screen, icon, label }) => (
        <button
          key={screen}
          className={`nav-item${screen === 'live-azan' ? ' nav-item--azan' : ''} ${mainScreens.includes(active) && active === screen ? 'active' : ''}`}
          onClick={() => onNavigate(screen)}
        >
          <span className="nav-icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
