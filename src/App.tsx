import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { CalendarPage } from './pages/CalendarPage'
import { HomePage } from './pages/HomePage'
import { MorePage } from './pages/MorePage'
import { MosqueDetailPage } from './pages/MosqueDetailPage'
import { MosquesPage } from './pages/MosquesPage'
import { NavigationPage } from './pages/NavigationPage'
import { LiveAzanPage } from './pages/LiveAzanPage'
import { IslamicChatPage } from './pages/IslamicChatPage'
import { QiblaPage } from './pages/QiblaPage'
import { RestaurantsPage } from './pages/RestaurantsPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { HadithPage } from './pages/HadithPage'
import { TrackerPage } from './pages/TrackerPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { NotificationsPage } from './pages/NotificationsPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import {
  api,
  getAdminUser,
  getAppToken,
  getAppUser,
  setAdminToken,
  setAdminUser,
} from './services/api'
import { UserLocationProvider } from './context/UserLocationContext'
import { UserAuthProvider } from './context/UserAuthContext'
import type { Mosque, Screen } from './types'

const SUB_SCREENS: Screen[] = ['mosque-detail', 'navigation', 'calendar', 'restaurants', 'reviews', 'tracker', 'qibla', 'login', 'profile', 'settings', 'admin-login', 'admin', 'notifications']

function syncAdminFromAppUser() {
  const user = getAppUser()
  const token = getAppToken()
  if (user && token) {
    setAdminToken(token)
    setAdminUser(user)
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null)
  const [returnScreen, setReturnScreen] = useState<Screen>('home')

  const showNav = !SUB_SCREENS.includes(screen)

  const handleSelectMosque = (mosque: Mosque, from: Screen = 'mosques') => {
    setSelectedMosque(mosque)
    setReturnScreen(from)
    setScreen('mosque-detail')
  }

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomePage
            onFindMosques={() => setScreen('mosques')}
            onSelectMosque={(mosque) => handleSelectMosque(mosque, 'home')}
            onNavigate={setScreen}
          />
        )
      case 'mosques':
        return (
          <MosquesPage
            onSelectMosque={(mosque) => handleSelectMosque(mosque, 'mosques')}
            onNeedLogin={() => setScreen('login')}
          />
        )
      case 'mosque-detail':
        return selectedMosque ? (
          <MosqueDetailPage
            mosque={selectedMosque}
            onBack={() => setScreen(returnScreen)}
            onDirections={() => setScreen('navigation')}
            onReviews={() => setScreen('reviews')}
            onNeedLogin={() => setScreen('login')}
          />
        ) : null
      case 'navigation':
        return selectedMosque ? (
          <NavigationPage mosque={selectedMosque} onBack={() => setScreen('mosque-detail')} />
        ) : null
      case 'reviews':
        return selectedMosque ? (
          <ReviewsPage mosque={selectedMosque} onBack={() => setScreen('mosque-detail')} />
        ) : null
      case 'chat':
        return <IslamicChatPage />
      case 'live-azan':
        return <LiveAzanPage />
      case 'qibla':
        return <QiblaPage onBack={() => setScreen('more')} />
      case 'hadith':
        return <HadithPage />
      case 'more':
        return <MorePage onNavigate={setScreen} />
      case 'notifications':
        return (
          <NotificationsPage
            onBack={() => setScreen('more')}
            onNeedLogin={() => setScreen('login')}
            onOpenMosque={(mosqueId) => {
              void (async () => {
                if (selectedMosque && String(selectedMosque.id) === String(mosqueId)) {
                  setReturnScreen('notifications')
                  setScreen('mosque-detail')
                  return
                }
                try {
                  const list = await api.getMosques()
                  const found = list.find((m) => String(m.id) === String(mosqueId))
                  if (found) {
                    setSelectedMosque(found)
                    setReturnScreen('notifications')
                    setScreen('mosque-detail')
                  }
                } catch {
                  setScreen('mosques')
                }
              })()
            }}
          />
        )
      case 'calendar':
        return <CalendarPage onBack={() => setScreen('more')} />
      case 'restaurants':
        return <RestaurantsPage onBack={() => setScreen('more')} />
      case 'tracker':
        return <TrackerPage onBack={() => setScreen('more')} />
      case 'login':
        return (
          <LoginPage
            onBack={() => setScreen('home')}
            onSuccess={() => setScreen('home')}
          />
        )
      case 'profile':
        return <ProfilePage onBack={() => setScreen('home')} />
      case 'settings':
        return (
          <SettingsPage
            onBack={() => setScreen('home')}
            onLogin={() => setScreen('login')}
          />
        )
      case 'admin-login':
        return (
          <AdminLoginPage
            onBack={() => setScreen('more')}
            onSuccess={() => setScreen('admin')}
          />
        )
      case 'admin':
        syncAdminFromAppUser()
        return getAdminUser() ? (
          <AdminDashboard onBack={() => setScreen('more')} />
        ) : (
          <AdminLoginPage onBack={() => setScreen('more')} onSuccess={() => setScreen('admin')} />
        )
      default:
        return null
    }
  }

  return (
    <UserAuthProvider>
      <UserLocationProvider>
        <div className="app-shell">
          <main className={`app-content ${showNav ? '' : 'no-nav'}${screen === 'chat' ? ' app-content--chat' : ''}${screen === 'admin' || screen === 'admin-login' || screen === 'login' ? ' app-content--form-page' : ''}`}>
            {renderScreen()}
          </main>
          {showNav && <BottomNav active={screen} onNavigate={setScreen} />}
        </div>
      </UserLocationProvider>
    </UserAuthProvider>
  )
}
