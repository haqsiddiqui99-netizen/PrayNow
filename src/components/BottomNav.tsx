import type { Screen } from '../types'

interface BottomNavProps {
  active: Screen
  onNavigate: (screen: Screen) => void
}

type NavIconName = 'home' | 'mosque' | 'azan' | 'ai' | 'hadith' | 'more'

const NAV_ITEMS: { screen: Screen; icon: NavIconName; label: string }[] = [
  { screen: 'home', icon: 'home', label: 'Home' },
  { screen: 'mosques', icon: 'mosque', label: 'Mosques' },
  { screen: 'live-azan', icon: 'azan', label: 'Azan' },
  { screen: 'chat', icon: 'ai', label: 'AI' },
  { screen: 'hadith', icon: 'hadith', label: 'Hadith' },
  { screen: 'more', icon: 'more', label: 'More' },
]

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 32,
}

function NavIcon({ name }: { name: NavIconName }) {
  if (name === 'mosque') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M24 7C24 5.9 22 4 22 4S20 5.9 20 7C20 7.7 20.4 8.4 21 8.7V13H19V11C19 10.1 18.3 9.3 17.5 9.1C17.8 8.5 18 7.9 18 7.1C18 5.8 17.4 4.6 16.3 3.9L12 1L7.7 3.8C6.7 4.6 6 5.8 6 7.1C6 7.8 6.2 8.5 6.6 9.1C5.7 9.3 5 10.1 5 11V13H3V8.7C3.6 8.4 4 7.7 4 7C4 5.9 2 4 2 4S0 5.9 0 7C0 7.7 .4 8.4 1 8.7V21H11V17C11 16.5 11.4 16 12 16S13 16.5 13 17V21H23V8.7C23.6 8.4 24 7.7 24 7M8.9 5.5L12 3.4L15.1 5.5C15.7 5.9 16 6.4 16 7.1C16 8.1 15.1 9 14.1 9H9.9C8.9 9 8 8.1 8 7.1C8 6.4 8.3 5.9 8.9 5.5M21 19H15V17C15 15.4 13.6 14 12 14S9 15.4 9 17V19H3V15H7V11H17V15H21V19Z"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 512 512" aria-hidden="true">
      {name === 'home' && (
        <>
          <path d="M80,212V448a16,16,0,0,0,16,16h96V328a24,24,0,0,1,24-24h80a24,24,0,0,1,24,24V464h96a16,16,0,0,0,16-16V212" {...stroke} />
          <path d="M480,256,266.89,52c-5-5.28-16.69-5.34-21.78,0L32,256" {...stroke} />
          <polyline points="400 179 400 64 352 64 352 133" {...stroke} />
        </>
      )}
      {name === 'azan' && (
        <>
          <circle cx="256" cy="256.02" r="32" fill="currentColor" />
          <path d="M184.25,192.25a96,96,0,0,0,0,127.52" {...stroke} />
          <path d="M327.77,319.77a96,96,0,0,0,0-127.52" {...stroke} />
          <path d="M133.28,141.28a168,168,0,0,0,0,229.44" {...stroke} />
          <path d="M378.72,370.72a168,168,0,0,0,0-229.44" {...stroke} />
        </>
      )}
      {name === 'ai' && (
        <>
          <path d="M259.92,262.91,216.4,149.77a9,9,0,0,0-16.8,0L156.08,262.91a9,9,0,0,1-5.17,5.17L37.77,311.6a9,9,0,0,0,0,16.8l113.14,43.52a9,9,0,0,1,5.17,5.17L199.6,490.23a9,9,0,0,0,16.8,0l43.52-113.14a9,9,0,0,1,5.17-5.17L378.23,328.4a9,9,0,0,0,0-16.8L265.09,268.08A9,9,0,0,1,259.92,262.91Z" {...stroke} />
          <polygon points="108 68 88 16 68 68 16 88 68 108 88 160 108 108 160 88 108 68" {...stroke} />
          <polygon points="426.67 117.33 400 48 373.33 117.33 304 144 373.33 170.67 400 240 426.67 170.67 496 144 426.67 117.33" {...stroke} />
        </>
      )}
      {name === 'hadith' && (
        <>
          <path d="M256,160c16-63.16,76.43-95.41,208-96a15.94,15.94,0,0,1,16,16V368a16,16,0,0,1-16,16c-128,0-177.45,25.81-208,64-30.37-38-80-64-208-64-9.88,0-16-8.05-16-17.93V80A15.94,15.94,0,0,1,48,64C179.57,64.59,240,96.84,256,160Z" {...stroke} />
          <line x1="256" y1="160" x2="256" y2="448" {...stroke} />
        </>
      )}
      {name === 'more' && (
        <>
          <line x1="80" y1="160" x2="432" y2="160" {...stroke} />
          <line x1="80" y1="256" x2="432" y2="256" {...stroke} />
          <line x1="80" y1="352" x2="432" y2="352" {...stroke} />
        </>
      )}
    </svg>
  )
}

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
          <span className="nav-icon">
            <NavIcon name={icon} />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
