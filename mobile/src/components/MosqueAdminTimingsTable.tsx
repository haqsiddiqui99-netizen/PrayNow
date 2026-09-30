import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { timingTextStyle } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'
import type { Mosque, PrayerName } from '@/src/types'
import { getJumaSessions } from '@/src/utils/jumaTimings'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

type Props = {
  mosque: Mosque
  /** Show header with Edit all button (default true). */
  showHeader?: boolean
}

/**
 * Mosque admin prayer chart: daily Azan+Jamat, plus a separate Juma section (Azan/Khutba/Jamat).
 */
export function MosqueAdminTimingsTable({ mosque, showHeader = true }: Props) {
  const styles = useStyles()
  const router = useRouter()
  const editPath = `/admin/mosque/${mosque.id}/timings` as const
  const jumaSessions = getJumaSessions(
    mosque.jumaTimings,
    mosque.timings?.Dhuhr?.azan || '',
  )

  return (
    <View style={styles.wrap}>
      {showHeader ? (
        <View style={styles.timingsHead}>
          <Text style={styles.sectionLabel}>Prayer Timings</Text>
          <Pressable style={styles.editBtn} onPress={() => router.push(editPath)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardKicker}>Daily</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.cell, styles.prayerCol, styles.head, styles.prayerHead]}>Prayer</Text>
          <Text style={[styles.cell, styles.head]}>Azan</Text>
          <Text style={[styles.cell, styles.head]}>Jamat</Text>
        </View>

        {PRAYERS.map((p, index) => (
          <View key={p} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
            <Text style={[styles.cell, styles.prayerCol, styles.prayerName]}>{p}</Text>
            <Text style={[styles.cell, styles.timeCell]}>{mosque.timings?.[p]?.azan || '—'}</Text>
            <Text style={[styles.cell, styles.timeCell]}>{mosque.timings?.[p]?.jamat || '—'}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, styles.jumaCard]}>
        <Text style={styles.cardKicker}>Juma (Friday)</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.cell, styles.prayerCol, styles.head, styles.prayerHead]}>Sitting</Text>
          <Text style={[styles.cell, styles.head]}>Azan</Text>
          <Text style={[styles.cell, styles.head]}>Khutba</Text>
          <Text style={[styles.cell, styles.head]}>Jamat</Text>
        </View>

        {jumaSessions.map((session, i) => (
          <View key={`juma-${i}`} style={[styles.row, i === jumaSessions.length - 1 && styles.rowLast]}>
            <Text style={[styles.cell, styles.prayerCol, styles.prayerName]}>
              {jumaSessions.length > 1 ? `Juma ${i + 1}` : 'Juma'}
            </Text>
            <Text style={[styles.cell, styles.timeCell]}>{session.azan || '—'}</Text>
            <Text style={[styles.cell, styles.timeCell]}>{session.khutba || '—'}</Text>
            <Text style={[styles.cell, styles.timeCell]}>{session.namaz || '—'}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.editFull} onPress={() => router.push(editPath)}>
        <Text style={styles.editFullText}>Edit azan, jamat & Juma ›</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: 10 },
  timingsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  editBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  editBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  jumaCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowAlt: { backgroundColor: 'rgba(148,163,184,0.08)' },
  cell: { flex: 1, ...timingTextStyle(colors), fontSize: 11 },
  prayerCol: { flex: 1.15 },
  timeCell: { textAlign: 'center', ...timingTextStyle(colors), fontSize: 11 },
  head: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 9,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  prayerHead: { textAlign: 'left' },
  prayerName: { fontWeight: '800', color: colors.textPrimary, fontSize: 12, textAlign: 'left' },
  editFull: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    backgroundColor: colors.surface0,
  },
  editFullText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
}))
