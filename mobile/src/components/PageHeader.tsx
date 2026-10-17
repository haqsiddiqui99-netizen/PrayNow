import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useLanguage } from '@/src/context/LanguageContext'
import { paperColors } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

/** Warm page background shared by the calendar and other full-screen pages. */
export function pageBackground(mode: string) {
  return paperColors(mode).page
}

/** Round back button and serif title, matching the Hijri calendar. */
export function PageHeader({ title, topInset = 0 }: { title: string; topInset?: number }) {
  const styles = useStyles()
  const router = useRouter()
  const { mode } = useTheme()
  const { t } = useLanguage()
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={mode === 'dark' ? '#EAF3F0' : '#0F1F2E'} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  return {
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? '#122027' : '#FFFFFF',
    },
    title: {
      flex: 1,
      fontFamily: 'Newsreader_600SemiBold',
      fontSize: 26,
      color: dark ? '#EAF3F0' : '#0F1F2E',
      letterSpacing: -0.3,
    },
  }
})
