import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { PlatformPressable } from '@react-navigation/elements'
import { StyleSheet, View } from 'react-native'
import { radius } from '@/src/constants/theme'

export function SeparatedTabBarButton(props: BottomTabBarButtonProps) {
  const { style, accessibilityState, ...rest } = props
  const focused = accessibilityState?.selected

  return (
    <View style={styles.slot}>
      <PlatformPressable
        {...rest}
        accessibilityState={accessibilityState}
        pressColor="rgba(15, 23, 42, 0.1)"
        pressOpacity={0.88}
        android_ripple={{ color: 'rgba(15, 23, 42, 0.1)', borderless: false }}
        style={[styles.btn, focused && styles.btnActive, style]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    paddingHorizontal: 2,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnActive: {
    backgroundColor: 'rgba(13, 71, 161, 0.18)',
    borderColor: 'rgba(13, 71, 161, 0.35)',
    borderWidth: 1.5,
  },
})
