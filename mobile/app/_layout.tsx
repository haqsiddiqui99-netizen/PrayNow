import { Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/src/context/AuthContext'
import { CityPrayerProvider } from '@/src/context/CityPrayerContext'
import { LocationProvider } from '@/src/context/LocationContext'
import { MosqueNotifyProvider } from '@/src/context/MosqueNotifyContext'
import { InboxProvider } from '@/src/context/InboxContext'
import { LanguageProvider } from '@/src/context/LanguageContext'
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
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="login" />
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="admin" options={{ headerShown: false }} />
                      <Stack.Screen name="mosque/[id]" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="notifications"
                        options={{ headerShown: true, title: 'Messages' }}
                      />
                      <Stack.Screen
                        name="submit-mosque"
                        options={{ headerShown: true, title: 'Add a mosque' }}
                      />
                    </Stack>
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
