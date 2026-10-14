import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { fetchMosqueStats, type MosqueStats } from '@/src/services/api'
import type { PrayerName } from '@/src/types'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

/** Who follows this mosque and how many rely on its jamaat times for reminders. */
export function MosqueStatsCard({ mosqueId }: { mosqueId: string }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t, prayerName, digits } = useLanguage()
  const [stats, setStats] = useState<MosqueStats | null>(null)
  const [failed, setFailed] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let alive = true
      setFailed(false)
      fetchMosqueStats(mosqueId)
        .then((next) => alive && setStats(next))
        .catch(() => alive && setFailed(true))
      return () => {
        alive = false
      }
    }, [mosqueId]),
  )

  if (!stats) {
    return (
      <View style={[styles.card, styles.center]}>
        {failed ? <Text style={styles.muted}>{t('stats.failed')}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  const peak = Math.max(1, ...PRAYERS.map((p) => stats.prayers[p] ?? 0))
  const tiles = [
    { icon: 'people-outline' as const, value: stats.followers, label: t('stats.followers') },
    { icon: 'alarm-outline' as const, value: stats.withReminders, label: t('stats.reminders') },
    { icon: 'trending-up-outline' as const, value: stats.newThisWeek, label: t('stats.newWeek') },
  ]

  return (
    <View style={styles.card}>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Ionicons name={tile.icon} size={16} color={colors.textSecondary} />
            <Text style={styles.value}>{digits(tile.value)}</Text>
            <Text style={styles.label} numberOfLines={2}>
              {tile.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.breakdown}>
        {t('stats.breakdown', { jamaat: stats.jamaat, leave: stats.leave, azan: stats.azan })}
        {stats.taraweeh ? ` · ${t('stats.taraweeh', { count: stats.taraweeh })}` : ''}
      </Text>
      <View style={styles.bars}>
        {PRAYERS.map((prayer) => {
          const count = stats.prayers[prayer] ?? 0
          return (
            <View key={prayer} style={styles.barCol}>
              <Text style={styles.barCount}>{digits(count)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.round((count / peak) * 100)}%` }]} />
              </View>
              <Text style={styles.barName} numberOfLines={1}>
                {prayerName(prayer)}
              </Text>
            </View>
          )
        })}
      </View>
      <Text style={styles.muted}>{t('stats.hint')}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 90 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, gap: 4, padding: 10, borderRadius: 14, backgroundColor: colors.surface0 },
  value: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  breakdown: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barCount: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  barTrack: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.surface0,
  },
  barFill: { width: '100%', borderRadius: 8, backgroundColor: colors.pageAccent },
  barName: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  muted: { fontSize: 11, lineHeight: 16, color: colors.textMuted },
}))
