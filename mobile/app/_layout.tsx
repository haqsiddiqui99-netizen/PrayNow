import { Stack } from 'expo-router'
import { useEffect } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from '@/src/context/AuthContext'
import { CityPrayerProvider } from '@/src/context/CityPrayerContext'
import { LocationProvider } from '@/src/context/LocationContext'
import { MosqueNotifyProvider } from '@/src/context/MosqueNotifyContext'
import { InboxProvider } from '@/src/context/InboxContext'
import 'react-native-reanimated'

export { ErrorBoundary } from 'expo-router'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CityPrayerProvider>
          <LocationProvider>
            <MosqueNotifyProvider>
              <InboxProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                  <Stack.Screen name="mosque/[id]" options={{ headerShown: true, title: 'Mosque Details' }} />
                  <Stack.Screen
                    name="notifications"
                    options={{ headerShown: true, title: 'Messages' }}
                  />
                </Stack>
              </InboxProvider>
            </MosqueNotifyProvider>
          </LocationProvider>
        </CityPrayerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
