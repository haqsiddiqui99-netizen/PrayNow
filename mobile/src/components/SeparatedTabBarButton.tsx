import type { BottomTabBarButtonProps } from "expo-router/js-tabs"
import { PlatformPressable } from "expo-router/react-navigation"
import { StyleSheet, View } from 'react-native'
import { radius } from '@/src/constants/theme'

/** Tab button that marks the active tab with a soft filled pill. */
export function SeparatedTabBarButton(props: BottomTabBarButtonProps) {
  const { style, children, accessibilityState, 'aria-selected': ariaSelected, ...rest } = props
  const focused = ariaSelected === true || accessibilityState?.selected === true

  return (
    <View style={styles.slot}>
      <PlatformPressable
        {...rest}
        aria-selected={ariaSelected}
        accessibilityState={accessibilityState}
        pressColor="rgba(13, 71, 161, 0.08)"
        pressOpacity={0.96}
        android_ripple={{ color: 'rgba(13, 71, 161, 0.08)', borderless: false }}
        style={[styles.btn, style]}>
        <View style={[styles.content, focused && styles.contentActive]}>{children}</View>
      </PlatformPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  content: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
    paddingBottom: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contentActive: {
    backgroundColor: 'rgba(13, 71, 161, 0.10)',
    borderColor: 'rgba(13, 71, 161, 0.18)',
  },
})
