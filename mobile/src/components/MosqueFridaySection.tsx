import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { JumaSession, Mosque } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const JUMA_COLUMNS = [
  { key: 'azan', label: 'Azan', getTime: (session: JumaSession) => session.azan },
  { key: 'khutba', label: 'Khutba', getTime: (session: JumaSession) => session.khutba },
  { key: 'namaz', label: 'Jamat', getTime: (session: JumaSession) => session.namaz },
] as const

/** One Friday session: a label over Azan, Khutba, and Jamat stacked tightly. */
function JumaPhaseRow({ session, phaseLabel }: { session: JumaSession; phaseLabel: string | null }) {
  const styles = useStyles()
  return (
    <View style={styles.phase}>
      {phaseLabel ? <Text style={styles.phaseLabel}>{phaseLabel}</Text> : null}
      {JUMA_COLUMNS.map((column) => (
        <View key={column.key} style={styles.timeRow}>
          <Text style={styles.columnLabel}>{column.label}</Text>
          <Text style={styles.columnValue} numberOfLines={1}>
            {column.getTime(session)?.trim() || '—'}
          </Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Friday/Jumu'ah timings as a single card. Most mosques run one session; a
 * few run two, shown as stacked phases inside the same card rather than as
 * separate cards.
 */
export function MosqueFridaySection({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const sessions = getJumaSessions(mosque.jumaTimings, mosque.timings?.Dhuhr?.azan || '')
  const activeSessions = sessions.filter((session) =>
    [session.azan, session.khutba, session.namaz].some((value) => value?.trim()),
  )

  if (!activeSessions.length) return null

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="star-outline" size={16} color={colors.primary} />
        <Text style={styles.cardTitle}>Jumu&apos;ah (Friday)</Text>
      </View>
      <View style={styles.phases}>
        {activeSessions.map((session, index) => (
          <JumaPhaseRow
            key={index}
            session={session}
            phaseLabel={activeSessions.length > 1 ? `Phase ${index + 1}` : null}
          />
        ))}
      </View>
    </View>
  )
}

/** Events that are not Juma/Friday timing strings (shown separately). */
export function getOtherMosqueEvents(events: string[]) {
  return events.filter((event) => !/friday|khutbah|khutba|juma/i.test(event))
}

const useStyles = makeStyles(({ colors, mode }) => ({
  card: {
    marginTop: 10,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    backgroundColor: mode === 'dark' ? '#3a3228' : '#f6efe4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Same family/weight as the mosque name header (Poppins_500Medium).
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
  },
  phases: {
    flexDirection: 'row',
    gap: 8,
  },
  phase: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  phaseLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: 'Poppins_500Medium',
    color: '#6f4e37',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textSecondary,
  },
  columnValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
    textAlign: 'right',
  },
}))
