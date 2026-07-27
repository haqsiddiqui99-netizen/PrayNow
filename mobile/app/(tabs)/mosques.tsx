import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CityPickerSheet } from '@/src/components/CityPickerSheet'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { MosqueCard } from '@/src/components/MosqueCard'
import { MosquePeekOverlay } from '@/src/components/MosquePeekOverlay'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { MosqueSortBar } from '@/src/components/MosqueSortBar'
import { NearbyMosquesMap } from '@/src/components/NearbyMosquesMap'
import { colors, radius, shadows } from '@/src/constants/theme'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  filterMosquesByRadius,
  formatRadiusValue,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import type { Mosque } from '@/src/types'
import { openNearbyMosquesOnMap } from '@/src/utils/maps'
import { sortMosques, type MosqueSortMode } from '@/src/utils/mosqueSort'

type ViewMode = 'list' | 'map'

const DEFAULT_TRAVEL_MODE = 'driving' as const

export default function MosquesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { location, loading: locLoading, refresh: refreshLoc, selectSavedLocation, searchAddress, savedLocations } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity } = useMosques(location)
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const filtered = filterMosquesByRadius(sortMosques(mosques, sortMode), radiusKm)
  const emptyRadiusText =
    radiusKm >= CITY_RADIUS_KM
      ? 'No mosques in your city.'
      : `No mosques within ${formatRadiusValue(radiusKm)}. Try a larger radius.`

  const locationLine = locLoading
    ? 'Updating…'
    : location.region && location.region !== location.city
      ? `${location.region}, ${location.city}`
      : location.label

  const selectedLocationId = savedLocations.find(
    (item) =>
      item.city === location.city &&
      Math.abs(item.lat - location.lat) < 0.02 &&
      Math.abs(item.lng - location.lng) < 0.02,
  )?.id ?? savedLocations[0]?.id ?? null

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void reload() }} />}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Mosques</Text>
        <Pressable style={styles.locationRow} onPress={() => setCityPickerOpen(true)} hitSlop={8}>
          <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.95)" />
          <Text style={styles.subtitle} numberOfLines={1}>
            {citySupported
              ? `${filtered.length} ${radiusKm >= CITY_RADIUS_KM ? 'in city' : `within ${formatRadiusValue(radiusKm)}`} · ${locationLine}`
              : `${locationLine} · detecting city…`}
          </Text>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.95)" />
        </Pressable>
      </View>

      <View style={styles.filtersCard}>
        <MosqueSortBar value={sortMode} onChange={setSortMode} compact />
        <View style={styles.filtersDivider} />
        <View style={styles.filtersBottomRow}>
          <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} compact />
          <View style={styles.viewToggleCol}>
            <Text style={styles.viewLabel}>View</Text>
            <View style={styles.viewToggle}>
              <Pressable
                style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('list')}>
                <Ionicons
                  name="list"
                  size={12}
                  color={viewMode === 'list' ? '#fff' : colors.textMuted}
                />
              </Pressable>
              <Pressable
                style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('map')}>
                <Ionicons
                  name="map"
                  size={12}
                  color={viewMode === 'map' ? '#fff' : colors.textMuted}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapSection}>
          {!citySupported && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          <NearbyMosquesMap
            mosques={filtered}
            userLat={location.lat}
            userLng={location.lng}
            selectedId={peekMosque?.id ?? null}
            onSelectMosque={(m) => setPeekMosque(m)}
            onOpenInGoogleMaps={() =>
              void openNearbyMosquesOnMap(filtered, location.lat, location.lng, DEFAULT_TRAVEL_MODE)
            }
          />
          {peekMosque ? (
            <View style={styles.mapSelectedCard}>
              <MosqueCard
                mosque={peekMosque}
                travelMode={DEFAULT_TRAVEL_MODE}
                compact
                showContact
                isPeekActive
                onPeek={() => setPeekMosque(peekMosque)}
                onPress={() => router.push(`/mosque/${peekMosque.id}`)}
              />
            </View>
          ) : filtered.length > 0 ? (
            <Text style={styles.mapHint}>Tap a pin to see mosque details</Text>
          ) : (
            <Text style={styles.emptyText}>{emptyRadiusText}</Text>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {!citySupported && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          {loading && !filtered.length ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{emptyRadiusText}</Text>
          ) : (
            filtered.map((m) => (
              <MosqueCard
                key={m.id}
                mosque={m}
                travelMode={DEFAULT_TRAVEL_MODE}
                compact
                showContact
                isPeekActive={peekMosque?.id === m.id}
                onPeek={() => setPeekMosque(m)}
                onPress={() => router.push(`/mosque/${m.id}`)}
              />
            ))
          )}
        </View>
      )}

      <MosquePeekOverlay
        mosque={peekMosque}
        travelMode={DEFAULT_TRAVEL_MODE}
        visible={peekMosque !== null && viewMode === 'list'}
        onClose={() => setPeekMosque(null)}
        onViewFull={(m) => router.push(`/mosque/${m.id}`)}
      />

      <CityPickerSheet
        visible={cityPickerOpen}
        selectedLocationId={selectedLocationId}
        savedLocations={savedLocations}
        onSelectSavedLocation={selectSavedLocation}
        onSearchAddress={searchAddress}
        onUseCurrentLocation={refreshLoc}
        onClose={() => setCityPickerOpen(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  subtitle: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.92)', fontWeight: '500' },
  filtersCard: {
    backgroundColor: colors.surface2,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
    ...shadows.soft,
  },
  filtersDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  filtersBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  viewToggleCol: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  viewLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface0,
    borderRadius: 8,
    padding: 2,
  },
  viewToggleBtn: {
    width: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  mapSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  mapSelectedCard: {
    marginTop: 10,
  },
  mapHint: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  list: { paddingHorizontal: 16, paddingTop: 10 },
  loader: { marginTop: 24 },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
})
