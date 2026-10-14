import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { fetchCityDays } from '@/src/services/api'
import { PRAYER_WIDGET, saveWidgetDays, widgetDateRange } from './prayerWidgetData'

/** Two weeks keeps the widget correct while the app stays closed. */
const WIDGET_DAYS = 14

/** Expo Go and web have no native widget module. */
export function widgetsSupported() {
  return Platform.OS === 'android' && Constants.appOwnership !== 'expo'
}

/** Redraws any PrayNow widgets on the home screen from the saved days. */
export async function refreshPrayerWidget() {
  if (!widgetsSupported()) return
  try {
    const [{ requestWidgetUpdate }, { renderPrayerWidget }] = await Promise.all([
      import('react-native-android-widget'),
      import('./PrayerWidget'),
    ])
    await requestWidgetUpdate({ widgetName: PRAYER_WIDGET, renderWidget: renderPrayerWidget })
  } catch (err) {
    console.warn('[widget] refresh skipped', err instanceof Error ? err.message : err)
  }
}

/** Saves upcoming prayer days for the widget, then redraws it. */
export async function syncPrayerWidget(city: string) {
  if (!widgetsSupported()) return
  try {
    const { from, to } = widgetDateRange(WIDGET_DAYS)
    await saveWidgetDays(city, await fetchCityDays(city, from, to))
  } catch (err) {
    console.warn('[widget] days not refreshed', err instanceof Error ? err.message : err)
  }
  await refreshPrayerWidget()
}
