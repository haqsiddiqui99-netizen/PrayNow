import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSiteUrl, getSupportEmail } from '@/src/config/api'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { TranslationKey } from '@/src/i18n/translations'

const FAQ: Array<[TranslationKey, TranslationKey]> = [
  ['help.q1', 'help.a1'],
  ['help.q2', 'help.a2'],
  ['help.q3', 'help.a3'],
  ['help.q4', 'help.a4'],
  ['help.q5', 'help.a5'],
  ['help.q6', 'help.a6'],
]

type IconName = React.ComponentProps<typeof Ionicons>['name']

export default function HelpScreen() {
  const styles = useStyles()
  const { t } = useLanguage()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState<number | null>(0)
  const email = getSupportEmail()

  const links: Array<{ key: string; icon: IconName; label: string; url: string }> = [
    ...(email ? [{ key: 'email', icon: 'mail-outline' as const, label: t('help.email'), url: `mailto:${email}?subject=PrayNow%20help` }] : []),
    { key: 'delete', icon: 'trash-outline', label: t('help.delete'), url: getSiteUrl('/delete-account/') },
    { key: 'privacy', icon: 'shield-checkmark-outline', label: t('about.privacy'), url: getSiteUrl('/privacy/') },
  ]

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={paper.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('help.title')}</Text>
      </View>
      <Text style={styles.intro}>{t('help.intro')}</Text>

      <View style={styles.card}>
        {FAQ.map(([question, answer], index) => {
          const expanded = open === index
          return (
            <View key={question} style={index > 0 ? styles.rowLine : undefined}>
              <Pressable
                onPress={() => setOpen(expanded ? null : index)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.question}>
                <Text style={styles.questionText}>{t(question)}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={paper.muted} />
              </Pressable>
              {expanded ? <Text style={styles.answer}>{t(answer)}</Text> : null}
            </View>
          )
        })}
      </View>

      <Text style={styles.section}>{t('help.contact')}</Text>
      <View style={styles.card}>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 4 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: paper.card },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: paper.ink, letterSpacing: -0.3 },
    intro: { fontFamily: 'Figtree_500Medium', fontSize: 14, lineHeight: 20, color: paper.muted, marginHorizontal: 16, marginBottom: 12 },
    card: { marginHorizontal: 12, borderRadius: 22, backgroundColor: paper.card, borderWidth: 1, borderColor: paper.line, overflow: 'hidden' },
    rowLine: { borderTopWidth: 1, borderTopColor: paper.line },
    question: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
    questionText: { flex: 1, fontFamily: 'Figtree_700Bold', fontSize: 15, lineHeight: 20, color: paper.ink },
    answer: { fontFamily: 'Figtree_400Regular', fontSize: 14, lineHeight: 21, color: paper.muted, paddingHorizontal: 16, paddingBottom: 14, marginTop: -4 },
    section: {
      marginTop: 20,
      marginBottom: 8,
      marginHorizontal: 16,
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.4,
      color: paper.muted,
    },
    link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    linkText: { flex: 1, fontFamily: 'Figtree_600SemiBold', fontSize: 15, color: paper.ink },
  }
})
