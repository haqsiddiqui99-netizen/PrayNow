import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { JumaSession, Mosque } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const JUMA_COLUMNS = [
  { key: 'azan', label: 'Azan', getTime: (session: JumaSession) => session.azan },
  { key: 'khutba', label: 'Khutba', getTime: (session: JumaSession) => session.khutba },
  { key: 'namaz', label: 'Jamat', getTime: (session: JumaSession) => session.namaz },
] as const

/** One phase's Azan/Khutba/Jamat row inside the shared Jumu'ah card. */
function JumaPhaseRow({ session, phaseLabel }: { session: JumaSession; phaseLabel: string | null }) {
  const styles = useStyles()
  return (
    <View style={styles.phase}>
      {phaseLabel ? <Text style={styles.phaseLabel}>{phaseLabel}</Text> : null}
      <View style={styles.columnsRow}>
        {JUMA_COLUMNS.map((column, index) => {
          const align = index === 0 ? 'left' : index === JUMA_COLUMNS.length - 1 ? 'right' : 'center'
          return (
            <View key={column.key} style={styles.column}>
              <Text style={[styles.columnLabel, { textAlign: align }]}>{column.label}</Text>
              <Text style={[styles.columnValue, { textAlign: align }]} numberOfLines={1}>
                {column.getTime(session)?.trim() || '—'}
              </Text>
            </View>
          )
        })}
      </View>
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
      {activeSessions.map((session, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <JumaPhaseRow
            session={session}
            phaseLabel={activeSessions.length > 1 ? `Phase ${index + 1}` : null}
          />
        </View>
      ))}
    </View>
  )
}

/** Events that are not Juma/Friday timing strings (shown separately). */
export function getOtherMosqueEvents(events: string[]) {
  return events.filter((event) => !/friday|khutbah|khutba|juma/i.test(event))
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    backgroundColor: colors.surface2,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  phase: { gap: 6 },
  phaseLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textMuted,
  },
  columnsRow: {
    flexDirection: 'row',
  },
  column: { flex: 1, gap: 2 },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textSecondary,
  },
  columnValue: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Poppins_500Medium',
    color: colors.textPrimary,
  },
}))
