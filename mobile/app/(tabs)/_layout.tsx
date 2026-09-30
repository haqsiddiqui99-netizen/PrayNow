import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, Platform, View, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabBarBackground } from '@/src/components/TabBarBackground'
import { SeparatedTabBarButton } from '@/src/components/SeparatedTabBarButton'
import { TabBarIcon, type TabBarIconName } from '@/src/components/TabBarIcon'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { TAB_BAR_HEIGHT, tabBarBottomPadding } from '@/src/constants/layout'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

/** Icon size is fixed so the slim tab bar keeps icon + label on one line. */
const TAB_ICON_SIZE = 21

function TabImageIcon({
  name,
  focused,
  color,
}: {
  name: TabBarIconName
  focused: boolean
  color: ColorValue
}) {
  return <TabBarIcon name={name} focused={focused} color={color} size={TAB_ICON_SIZE} />
}

export default function TabLayout() {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { isReady, isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const bottomPad = tabBarBottomPadding(insets.bottom)

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface0 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface0 },
        tabBarBackground: () => <TabBarBackground />,
        tabBarButton: (props) => <SeparatedTabBarButton {...props} />,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          // `shadow*` props are deprecated on web; `boxShadow` is the replacement.
          ...(Platform.OS === 'web' ? { boxShadow: 'none' } : { shadowOpacity: 0 }),
          height: TAB_BAR_HEIGHT + bottomPad,
          paddingTop: 0,
          paddingBottom: bottomPad,
          paddingHorizontal: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.home'),
          tabBarIcon: ({ focused, color }) => (
            <TabImageIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('screens.aiTitle'),
          tabBarLabel: t('tabs.ai'),
          tabBarAccessibilityLabel: t('screens.aiTitle'),
          tabBarIcon: ({ focused, color }) => (
            <TabImageIcon name="ai" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mosques"
        options={{
          title: t('screens.mosquesTitle'),
          tabBarLabel: t('tabs.mosques'),
          tabBarAccessibilityLabel: t('screens.mosquesTitle'),
          tabBarIcon: ({ focused, color }) => (
            <TabImageIcon name="mosque" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live-azan"
        options={{
          title: t('screens.azanTitle'),
          tabBarLabel: t('tabs.azan'),
          tabBarAccessibilityLabel: t('screens.azanTitle'),
          tabBarIcon: ({ focused, color }) => (
            <TabImageIcon name="azan" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('screens.moreTitle'),
          tabBarLabel: t('tabs.more'),
          tabBarAccessibilityLabel: t('screens.moreTitle'),
          tabBarIcon: ({ focused, color }) => (
            <TabImageIcon name="more" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="hadith" options={{ href: null }} />
      <Tabs.Screen name="qibla" options={{ href: null }} />
    </Tabs>
  )
}

const useStyles = makeStyles(() => ({
  tabIcon: {
    marginTop: 0,
    marginBottom: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
    marginBottom: 0,
    letterSpacing: 0.1,
  },
}))
