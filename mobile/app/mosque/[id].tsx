import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FacilitiesLine } from '@/src/components/FacilitiesLine'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { MosqueTimingsTable } from '@/src/components/MosqueTimingsGrid'
import { colors, radius, shadows } from '@/src/constants/theme'
import { fetchMosques } from '@/src/services/api'
import type { Mosque } from '@/src/types'
import { getCurrentPrayerForMosques } from '@/src/utils/prayerSchedule'
import { formatCapacity } from '@/src/utils/mosqueSort'

export default function MosqueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [mosque, setMosque] = useState<Mosque | null>(null)
  const [loading, setLoading] = useState(true)
  const currentPrayer = getCurrentPrayerForMosques()

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
        <Text style={styles.notFound}>Mosque not found</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="moon" size={48} color="#fff" />
        <Text style={styles.name}>{mosque.name}</Text>
        <Text style={styles.address}>{mosque.address}</Text>
        <View style={styles.heroMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="star" size={11} color="#f59e0b" />
            <Text style={styles.metaChipText}>{mosque.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={11} color="#fff" />
            <Text style={styles.metaChipText}>{mosque.distance} km away</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="people-outline" size={11} color="#fff" />
            <Text style={styles.metaChipText}>{formatCapacity(mosque.capacity)} capacity</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{mosque.sect}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.detailLine}>
            Total capacity: {mosque.capacity.toLocaleString()} worshippers
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.detailLine}>{mosque.area}</Text>
        </View>
        {mosque.phone ? (
          <Pressable
            style={styles.detailRow}
            onPress={() => void Linking.openURL(`tel:${mosque.phone.replace(/\s/g, '')}`)}>
            <Ionicons name="call" size={15} color={colors.primary} />
            <Text style={[styles.detailLine, styles.phoneLine]}>{mosque.phone}</Text>
          </Pressable>
        ) : null}
        {mosque.imam ? (
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailLine}>Imam: {mosque.imam}</Text>
          </View>
        ) : null}
        {mosque.sermonLanguage ? (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailLine}>Khutbah: {mosque.sermonLanguage}</Text>
          </View>
        ) : null}
        <FacilitiesLine facilities={mosque.facilities} max={8} />
      </View>

      <Text style={styles.sectionTitle}>Prayer Times</Text>
      <Text style={styles.sectionHint}>Azan and Jamat for all five daily prayers</Text>
      <MosqueTimingsTable mosque={mosque} currentPrayer={currentPrayer?.name ?? null} />

      {mosque.events.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Events</Text>
          {mosque.events.map((event) => (
            <View key={event} style={styles.eventRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.eventItem}>{event}</Text>
            </View>
          ))}
        </View>
      )}

      <GoogleMapsButton mosque={mosque} variant="button" style={styles.mapsBtn} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.textSecondary, fontWeight: '600' },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  name: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  address: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 18,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  metaChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: colors.surface2,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sectionTitle: {
    marginHorizontal: 16,
    marginTop: 18,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailLine: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  phoneLine: { color: colors.primary },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eventItem: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  mapsBtn: { marginHorizontal: 16, marginTop: 16 },
})
