import { useRouter } from 'expo-router'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MoreFeed } from '@/src/components/MoreFeed'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { useLocation } from '@/src/hooks/useLocation'
import { isAppAdmin } from '@/src/utils/roles'

export default function MoreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { user } = useAuth()
  const { unreadCount } = useInbox()
  const { language, setLanguage } = useLanguage()
  const { location } = useLocation()

  return (
    <MoreFeed
      topInset={insets.top}
      bottomInset={tabBarHeight}
      guest={!user}
      showAppAdmin={isAppAdmin(user)}
      city={location.supportedCity?.name ?? location.city}
      lat={location.lat}
      lon={location.lng}
      unread={user ? unreadCount : 0}
      language={language}
      onLanguage={setLanguage}
      onSignIn={() => router.push('/login')}
      onAppAdmin={() => router.push('/admin')}
      onQibla={() => router.push('/(tabs)/qibla')}
      onAddMosque={() => router.push('/submit-mosque')}
      onMessages={() => router.push('/notifications')}
      onCalendar={() => router.push('/calendar')}
      onTracker={() => router.push('/tracker')}
      onHalal={() => router.push('/halal')}
      onDuas={() => router.push('/(tabs)/duas')}
      onQuran={() => router.push('/quran')}
      onZakat={() => router.push('/zakat')}
    />
  )
}
