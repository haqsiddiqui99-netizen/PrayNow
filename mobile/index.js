import 'expo-router/entry'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// The widget module is native-only; Expo Go and web load without it.
if (Platform.OS === 'android' && Constants.appOwnership !== 'expo') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget')
    const { widgetTaskHandler } = require('./src/widget/widgetTaskHandler')
    registerWidgetTaskHandler(widgetTaskHandler)
  } catch (err) {
    console.warn('[widget] not available in this build', err instanceof Error ? err.message : err)
  }
}
