import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View } from 'react-native'

export function BlurredTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 28 : 36}
        tint="light"
        style={StyleSheet.absoluteFill}
        {...(Platform.OS === 'android'
          ? { experimentalBlurMethod: 'dimezisBlurView' as const }
          : {})}
      />
      <View style={styles.glassTint} />
      <View style={styles.topEdge} />
    </View>
  )
}

const styles = StyleSheet.create({
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
  },
})
