import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Keyboard, Platform, Pressable, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { TabBarIcon } from '@/src/components/TabBarIcon'
import { useLanguage } from '@/src/context/LanguageContext'
import { useTheme } from '@/src/context/ThemeContext'

/** Floating shortcut to the AI guide, sitting just above the tab bar. */
export function AIChatFab({ bottom }: { bottom: number }) {
  const router = useRouter()
  const { t } = useLanguage()
  const { mode } = useTheme()
  const [keyboard, setKeyboard] = useState(false)
  const dark = mode === 'dark'

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  if (keyboard) return null

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={[styles.wrap, { bottom }]}>
      <Pressable
        onPress={() => router.push('/ai')}
        accessibilityRole="button"
        accessibilityLabel={t('screens.aiTitle')}
        hitSlop={6}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
          pressed && styles.pressed,
        ]}>
        <TabBarIcon name="ai" focused color={dark ? '#0F1F2E' : '#FFFFFF'} size={26} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 18px rgba(15,31,46,0.28)' }
      : { shadowColor: '#0F1F2E', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
  },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.92 },
})
