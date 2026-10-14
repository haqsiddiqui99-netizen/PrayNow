import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppToastHost } from '@/src/components/AppToast'
import { AuthProvider } from '@/src/context/AuthContext'
import { CityPrayerProvider } from '@/src/context/CityPrayerContext'
import { LocationProvider } from '@/src/context/LocationContext'
import { MosqueNotifyProvider } from '@/src/context/MosqueNotifyContext'
import { InboxProvider } from '@/src/context/InboxContext'
import { LanguageProvider, useLanguage } from '@/src/context/LanguageContext'
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext'
import { loadAppFonts } from '@/src/utils/loadAppFonts'
import 'react-native-reanimated'

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

/** Keeps the status bar glyphs legible against the active header colour. */
function AppStatusBar() {
  const { mode } = useTheme()
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
}

function RootStack() {
  const { t } = useLanguage()
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: t('common.back') }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="mosque/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: t('more.notifications') }} />
      <Stack.Screen name="calendar" options={{ headerShown: false }} />
      <Stack.Screen name="tracker" options={{ headerShown: false }} />
      <Stack.Screen name="ai" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="duas" options={{ headerShown: false }} />
      <Stack.Screen name="quran" options={{ headerShown: false }} />
      <Stack.Screen name="zakat" options={{ headerShown: false }} />
      <Stack.Screen name="halal" options={{ headerShown: false }} />
      <Stack.Screen name="submit-mosque" options={{ headerShown: true, title: t('addMosque.title') }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        await loadAppFonts()
      } catch (error) {
        console.warn('App fonts failed to preload:', error)
      } finally {
        setAppReady(true)
        await SplashScreen.hideAsync()
      }
    })()
  }, [])

  if (!appReady) return null

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CityPrayerProvider>
              <LocationProvider>
                <MosqueNotifyProvider>
                  <InboxProvider>
                    <AppStatusBar />
                    <RootStack />
                    <AppToastHost />
                  </InboxProvider>
                </MosqueNotifyProvider>
              </LocationProvider>
            </CityPrayerProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
