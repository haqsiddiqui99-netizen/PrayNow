import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useJanaza } from '@/src/hooks/useJanaza'
import { useEventWhen } from '@/src/hooks/useMosqueEvents'
import type { Mosque } from '@/src/types'
import { janazaMessage, shareToWhatsApp } from '@/src/utils/share'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const

/** Upcoming janaza prayers at one mosque. Renders nothing when there are none. */
export function JanazaBanner({ mosque, inset = true }: { mosque: Mosque; inset?: boolean }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const lang = useLanguage()
  const { t, prayerName } = lang
  const when = useEventWhen()
  const list = useJanaza(mosque.id)
  const ink = mode === 'dark' ? '#EAF3F0' : '#0F1F2E'

  if (!list.length) return null

  return (
    <View style={[styles.wrap, inset && styles.inset]}>
      {list.map((janaza) => {
        const at = when(new Date(janaza.prayerAt))
        const timeLine = janaza.afterPrayer
          ? t('janaza.afterAt', { prayer: prayerName(janaza.afterPrayer), when: at })
          : at
        return (
          <View key={janaza.id} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="flower-outline" size={16} color={ink} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.kicker}>{t('janaza.title')}</Text>
              {janaza.deceasedName ? (
                <Text style={styles.name} numberOfLines={1}>
                  {janaza.deceasedName}
                </Text>
              ) : null}
              <Text style={styles.when} numberOfLines={1}>
                {timeLine}
              </Text>
              {janaza.burial ? (
                <Text style={styles.detail} numberOfLines={1}>
                  {t('janaza.burialAt', { place: janaza.burial })}
                </Text>
              ) : null}
              {janaza.note ? (
                <Text style={styles.detail} numberOfLines={2}>
                  {janaza.note}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.()
                void shareToWhatsApp(janazaMessage(lang, janaza, at, mosque))
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('share.whatsapp')}
              style={styles.share}>
              <Ionicons name="logo-whatsapp" size={15} color={ink} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  return {
    wrap: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: dark ? '#17262E' : '#F3F5F8' },
    inset: { marginHorizontal: 12, marginTop: 10 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    copy: { flex: 1, minWidth: 0, gap: 1 },
    kicker: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.7, textTransform: 'uppercase', color: muted },
    name: { fontFamily: F.bold, fontSize: 14.5, color: ink },
    when: { fontFamily: F.semi, fontSize: 13, color: ink },
    detail: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted },
    share: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
  }
})
