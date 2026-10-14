import { Platform } from 'react-native'

const CHANNEL_ID = 'event-reminders'

export type OneShotAlert = { id: string; at: Date; title: string; body: string }

export type AlertSyncResult = 'scheduled' | 'off' | 'denied' | 'unsupported'

async function notifications() {
  if (Platform.OS === 'web') return null
  try {
    const Notifications = await import('expo-notifications')
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Event reminders',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
      })
    }
    return Notifications
  } catch {
    return null
  }
}

const queues = new Map<string, Promise<unknown>>()

/**
 * Replace every alarm in `group` with the soonest future `alerts`, keeping at most `limit`
 * so the iOS cap of 64 pending notifications is shared fairly with prayer and mosque reminders.
 */
export function syncOneShotAlerts(
  group: string,
  alerts: OneShotAlert[],
  { askPermission = false, limit = 6 } = {},
): Promise<AlertSyncResult> {
  const run = (queues.get(group) ?? Promise.resolve()).then(() => runSync(group, alerts, askPermission, limit))
  queues.set(group, run.catch(() => {}))
  return run
}

async function runSync(group: string, alerts: OneShotAlert[], askPermission: boolean, limit: number): Promise<AlertSyncResult> {
  const Notifications = await notifications()
  if (!Notifications) return alerts.length ? 'unsupported' : 'off'

  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => [])
  for (const request of scheduled) {
    if (request.content.data?.group === group) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {})
    }
  }

  const now = Date.now()
  const upcoming = alerts
    .filter((alert) => alert.at.getTime() > now + 30_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, limit)
  if (!upcoming.length) return 'off'

  let granted = (await Notifications.getPermissionsAsync().catch(() => null))?.granted ?? false
  if (!granted && askPermission) granted = (await Notifications.requestPermissionsAsync().catch(() => null))?.granted ?? false
  if (!granted) return 'denied'

  for (const alert of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.body,
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'event_reminder', group, id: alert.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alert.at,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    }).catch(() => null)
  }
  return 'scheduled'
}
