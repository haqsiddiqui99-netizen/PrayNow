import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { canManageMosques, isAppAdmin } from '@/src/utils/roles'

export default function AdminLayout() {
  const { user, isReady } = useAuth()
  const { t } = useLanguage()
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
        headerBackTitle: t('common.back'),
      }}>
      <Stack.Screen name="index" options={{ title: isAppAdmin(user) ? t('owner.appAdmin') : t('admin.screenAdmin') }} />
      <Stack.Screen name="my-mosques" options={{ title: t('admin.screenAdmin') }} />
      <Stack.Screen name="mosque/[id]/index" options={{ title: t('admin.screenHub') }} />
      <Stack.Screen name="mosque/[id]/timings" options={{ title: t('admin.editTimes') }} />
      <Stack.Screen name="mosque/[id]/azan" options={{ title: t('admin.dashboard') }} />
      <Stack.Screen name="mosques" options={{ title: t('owner.allMosques') }} />
      <Stack.Screen name="mosque-form" options={{ title: t('owner.mosque') }} />
      <Stack.Screen name="mosque-requests" options={{ title: t('owner.requests') }} />
      <Stack.Screen name="corrections" options={{ title: t('correction.ownerTile') }} />
      <Stack.Screen name="managers" options={{ title: t('owner.admins') }} />
      <Stack.Screen name="city" options={{ title: t('owner.city') }} />
    </Stack>
  )
}
