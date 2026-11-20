import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

/** Shown when the server could not be reached and there is nothing saved to show. */
export function LoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t } = useLanguage()
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={28} color={paperColors(mode).muted} />
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
    wrap: { alignItems: 'center', gap: 10, paddingVertical: 32, marginHorizontal: 24 },
    text: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, lineHeight: 20, color: paper.muted, textAlign: 'center' },
    retry: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: paper.ink },
    retryText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.onInk },
  }
})
