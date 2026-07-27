import { StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '@/src/constants/theme'
import type { LivePrayerInfo } from '@/src/utils/prayerSchedule'

/** Single-line current prayer only — used on Home above mosque list */
export function CurrentPrayerStrip({ info }: { info: LivePrayerInfo }) {
  return (
    <View style={styles.strip}>
      <Text style={styles.label}>Current prayer</Text>
      {info.current ? (
        <View style={styles.row}>
          <Text style={styles.name}>{info.current.displayName}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.time}>
            {info.current.start} – {info.current.end}
          </Text>
        </View>
      ) : (
        <Text style={styles.idle}>No active prayer window</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(13,71,161,0.12)',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  name: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  dot: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  time: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  idle: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
})
