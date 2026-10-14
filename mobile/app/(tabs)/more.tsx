import { useRouter } from 'expo-router'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MoreFeed } from '@/src/components/MoreFeed'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { DAILY_HADITH, DAILY_VERSE } from '@/src/data/mockData'
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
      verse={{
        arabic: DAILY_VERSE.arabic,
        translation: DAILY_VERSE.translation,
        source: DAILY_VERSE.reference,
      }}
      hadith={{ translation: DAILY_HADITH.text, source: DAILY_HADITH.source }}
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
      onDuas={() => router.push('/duas')}
      onQuran={() => router.push('/quran')}
      onZakat={() => router.push('/zakat')}
    />
  )
}
