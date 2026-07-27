import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { registerPushToken } from '@/src/services/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/** Request permission and register Expo push token with the API (logged-in users). */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice && Platform.OS !== 'web') {
    // Simulators often cannot receive push; still allow inbox.
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Mosque updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    // Expo Go may expose a projectId under easConfig
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId

  try {
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync()
    const token = tokenResult.data
    if (token) {
      await registerPushToken(token, Platform.OS)
    }
    return token
  } catch (err) {
    console.warn('[push] token register skipped', err instanceof Error ? err.message : err)
    return null
  }
}
