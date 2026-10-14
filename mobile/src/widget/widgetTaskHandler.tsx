import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { renderPrayerWidget } from './PrayerWidget'

/** Runs headless when Android adds, resizes, refreshes or taps the widget. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return
  renderWidget(await renderPrayerWidget(widgetInfo))
}
