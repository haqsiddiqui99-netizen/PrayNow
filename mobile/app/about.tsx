import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import * as Updates from 'expo-updates'
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSiteUrl } from '@/src/config/api'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

const ICON = require('../assets/brand/icon.png')

type IconName = React.ComponentProps<typeof Ionicons>['name']

export default function AboutScreen() {
  const styles = useStyles()
  const { t, digits } = useLanguage()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const version = Constants.expoConfig?.version ?? '1.0.0'
  // Shows which over-the-air update is running, so testers can confirm a fix arrived.
  const update = Updates.updateId ? ` 뿯½ ${Updates.updateId.slice(0, 7)}` : ''

  const links: Array<{ key: string; icon: IconName; label: string; url: string }> = [
    { key: 'privacy', icon: 'shield-checkmark-outline', label: t('about.privacy'), url: getSiteUrl('/privacy/') },
    { key: 'delete', icon: 'trash-outline', label: t('about.delete'), url: getSiteUrl('/delete-account/') },
  ]

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={paper.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('about.title')}</Text>
      </View>

      <View style={styles.hero}>
        <Image source={ICON} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text style={styles.name}>PrayNow</Text>
        <Text style={styles.tagline}>{t('about.tagline')}</Text>
        <Text style={styles.version}>{t('about.version', { version: digits(version) })}{update}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>{t('about.body')}</Text>
        <Text style={styles.mission}>{t('about.mission')}</Text>
      </View>

      <View style={[styles.card, styles.linksCard]}>
        {links.map((link, index) => (
          <Pressable
            key={link.key}
            onPress={() => void Linking.openURL(link.url)}
            accessibilityRole="link"
            style={[styles.link, index > 0 && styles.rowLine]}>
            <Ionicons name={link.icon} size={18} color={paper.ink} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Ionicons name="open-outline" size={16} color={paper.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
    page: { flex: 1, backgroundColor: paper.page },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: paper.card },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: paper.ink, letterSpacing: -0.3 },
    hero: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 24 },
    icon: { width: 84, height: 84, borderRadius: 22 },
    name: { fontFamily: 'Newsreader_600SemiBold', fontSize: 30, color: paper.ink, marginTop: 12 },
    tagline: { fontFamily: 'Figtree_500Medium', fontSize: 14, lineHeight: 20, color: paper.muted, textAlign: 'center', marginTop: 4 },
    version: { fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: paper.faint, marginTop: 8 },
    card: { marginHorizontal: 12, padding: 16, borderRadius: 22, backgroundColor: paper.card, borderWidth: 1, borderColor: paper.line },
    body: { fontFamily: 'Figtree_400Regular', fontSize: 14.5, lineHeight: 22, color: paper.ink },
    mission: { fontFamily: 'Newsreader_600SemiBold', fontSize: 18, lineHeight: 24, color: paper.ink, marginTop: 12 },
    linksCard: { marginTop: 12, padding: 0, overflow: 'hidden' },
    rowLine: { borderTopWidth: 1, borderTopColor: paper.line },
    link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    linkText: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 15, color: paper.ink },
  }
})
