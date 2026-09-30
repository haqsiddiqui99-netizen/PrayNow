import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { getOtherMosqueEvents } from '@/src/components/MosqueFridaySection'
import type { Mosque } from '@/src/types'

/**
 * Mosque-posted notices, reusing `mosque.events` (the same plain-text list the
 * mosque detail page already shows) rather than a separate feed — there is no
 * per-mosque public announcements endpoint yet, only the admin-only post route.
 */
export function MosqueAnnouncementsSection({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const events = getOtherMosqueEvents(mosque.events)

  if (!events.length) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Announcements</Text>
        <Text style={styles.hint}>From the mosque</Text>
      </View>
      {events.map((event, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="megaphone" size={13} color={colors.primary} />
            <Text style={styles.cardFrom}>Mosque admin</Text>
          </View>
          <Text style={styles.cardBody}>{event}</Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: 8, marginTop: 10 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  hint: { fontSize: 12, fontWeight: '400', color: colors.textSecondary },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    padding: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFrom: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cardBody: { fontSize: 13, fontWeight: '400', color: colors.textPrimary, lineHeight: 19 },
}))
