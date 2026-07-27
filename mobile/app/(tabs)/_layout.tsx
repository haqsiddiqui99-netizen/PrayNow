import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon } from '@/src/components/AppIcon'
import { BlurredTabBarBackground } from '@/src/components/BlurredTabBarBackground'
import { SeparatedTabBarButton } from '@/src/components/SeparatedTabBarButton'
import { useAuth } from '@/src/context/AuthContext'
import { colors } from '@/src/constants/theme'
import { TAB_BAR_HEIGHT, tabBarBottomPadding } from '@/src/constants/layout'
import type { AppIconName } from '@/src/constants/appIcons'

const TAB_ICON_SIZE = 28

function TabImageIcon({ name, focused }: { name: AppIconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <AppIcon name={name} size={TAB_ICON_SIZE} variant="tab" style={{ opacity: focused ? 1 : 0.42 }} />
    </View>
  )
}

function MoreTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <AppIcon name="more" size={TAB_ICON_SIZE} variant="tab" style={{ opacity: focused ? 1 : 0.42 }} />
    </View>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const { isReady, isAuthenticated } = useAuth()
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface0 },
        tabBarBackground: () => <BlurredTabBarBackground />,
        tabBarButton: (props) => <SeparatedTabBarButton {...props} />,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: TAB_BAR_HEIGHT + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
          paddingHorizontal: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabImageIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Guide',
          tabBarAccessibilityLabel: 'AI Guide',
          tabBarIcon: ({ focused }) => <TabImageIcon name="ai" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mosques"
        options={{
          title: 'Mosques',
          tabBarAccessibilityLabel: 'Mosque',
          tabBarIcon: ({ focused }) => <TabImageIcon name="mosque" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="live-azan"
        options={{
          title: 'Live Azan',
          tabBarAccessibilityLabel: 'Azan',
          tabBarIcon: ({ focused }) => <TabImageIcon name="azan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarAccessibilityLabel: 'More',
          tabBarIcon: ({ focused }) => <MoreTabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen name="hadith" options={{ href: null }} />
      <Tabs.Screen name="qibla" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    transform: [{ scale: 1.06 }],
  },
})
