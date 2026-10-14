import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { registerPushToken } from '@/src/services/api'

/** Expo Go (SDK 53+) no longer supports remote push on Android — skip the module entirely. */
function isExpoGo() {
  return Constants.appOwnership === 'expo'
}

/**
 * Calls `onOpen` when the user taps a push, including the tap that launched the app.
 * Returns a cleanup function.
 */
export function listenForPushOpens(onOpen: () => void): () => void {
  if (isExpoGo() || Platform.OS === 'web') return () => {}

  let removed = false
  let remove: (() => void) | null = null

  void import('expo-notifications')
    .then(async (Notifications) => {
      if (removed) return
      const sub = Notifications.addNotificationResponseReceivedListener(() => onOpen())
      remove = () => sub.remove()
      const launch = await Notifications.getLastNotificationResponseAsync()
      if (launch && !removed) {
        onOpen()
        await Notifications.clearLastNotificationResponseAsync?.()
      }
    })
    .catch(() => {})

  return () => {
    removed = true
    remove?.()
  }
}

/** Request permission and register Expo push token with the API (logged-in users). */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo()) {
    return null
  }

  if (!Device.isDevice && Platform.OS !== 'web') {
    // Simulators often cannot receive push; still allow inbox.
    return null
  }

  try {
    const Notifications = await import('expo-notifications')

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mosque updates',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId

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
