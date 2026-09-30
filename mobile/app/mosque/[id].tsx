import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MosqueCard } from '@/src/components/MosqueCard'
import { getOtherMosqueEvents, MosqueFridaySection } from '@/src/components/MosqueFridaySection'
import { MosqueStaffSection } from '@/src/components/MosqueStaffSection'
import { MosqueTimingsGrid } from '@/src/components/MosqueTimingsGrid'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { fetchMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { getCurrentPrayerForMosques } from '@/src/utils/prayerSchedule'

export default function MosqueDetailScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const currentPrayer = getCurrentPrayerForMosques()
  const otherEvents = mosque ? getOtherMosqueEvents(mosque.events) : []

  useEffect(() => {
    void (async () => {
      const list = await fetchMosques()
      setMosque(list.find((m) => m.id === id) ?? null)
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!mosque) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('detail.notFound')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('detail.title')}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <MosqueCard
          mosque={mosque}
          travelMode="driving"
          homeCompact
          static
          showContact
          hideStaff
        />

        <MosqueStaffSection mosque={mosque} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('detail.allTimes')}</Text>
          <Text style={styles.sectionHint}>{t('detail.allTimesHint')}</Text>
          <MosqueTimingsGrid mosque={mosque} currentPrayer={currentPrayer?.name ?? null} compact />
          <MosqueFridaySection mosque={mosque} />
        </View>

        {otherEvents.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('detail.events')}</Text>
            {otherEvents.map((event) => (
              <View key={event} style={styles.eventRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.eventItem}>{event}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface0 },
  notFound: { color: colors.textSecondary, fontWeight: '600' },
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.pageAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eventItem: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
}))
