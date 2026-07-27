import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useAuth } from '@/src/context/AuthContext'
import { canManageMosques, isAppAdmin } from '@/src/utils/roles'

export default function AdminLayout() {
  const { user, isReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isReady) return
    if (!user || !canManageMosques(user)) {
      router.replace('/(tabs)/more')
    }
  }, [isReady, user, router])

  if (!isReady || !user || !canManageMosques(user)) return null

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#0d47a1',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Back',
      }}>
      <Stack.Screen name="index" options={{ title: isAppAdmin(user) ? 'App Admin' : 'Mosque Admin' }} />
      <Stack.Screen name="my-mosques" options={{ title: 'Mosque Admin' }} />
      <Stack.Screen name="mosque/[id]/index" options={{ title: 'Mosque Dashboard' }} />
      <Stack.Screen name="mosque/[id]/timings" options={{ title: 'Edit Prayer Timings' }} />
      <Stack.Screen name="mosque/[id]/azan" options={{ title: 'Azan Dashboard' }} />
      <Stack.Screen name="mosques" options={{ title: 'All Mosques' }} />
      <Stack.Screen name="mosque-form" options={{ title: 'Mosque' }} />
      <Stack.Screen name="managers" options={{ title: 'Mosque Admins' }} />
      <Stack.Screen name="city" options={{ title: 'City Schedule' }} />
    </Stack>
  )
}
