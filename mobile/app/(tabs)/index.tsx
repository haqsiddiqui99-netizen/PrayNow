import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CityPickerSheet } from '@/src/components/CityPickerSheet'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { MosqueCard } from '@/src/components/MosqueCard'
import { MosqueFilterSheet } from '@/src/components/MosqueFilterSheet'
import { MosquePeekOverlay } from '@/src/components/MosquePeekOverlay'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { PrayerStatusCard } from '@/src/components/PrayerStatusCard'
import { UserMenu } from '@/src/components/UserMenu'
import { InboxBellButton } from '@/src/components/InboxBellButton'
import { colors, radius } from '@/src/constants/theme'
import {
  DEFAULT_MOSQUE_RADIUS_KM,
  formatNearbyMosqueHeading,
  filterMosquesByRadius,
  HOME_NEARBY_PREVIEW_LIMIT,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'
import { useAuth } from '@/src/context/AuthContext'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { HomeMosqueAdminPanel } from '@/src/components/HomeMosqueAdminPanel'
import { ISLAMIC_CALENDAR } from '@/src/data/mockData'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import type { Mosque } from '@/src/types'
import { getLivePrayerInfo, getPrayerStatusExtras } from '@/src/utils/prayerSchedule'
import {
  filterMosquesBySect,
  sortMosques,
  type MosqueSectFilter,
  type MosqueSortMode,
} from '@/src/utils/mosqueSort'
import { canManageMosques } from '@/src/utils/roles'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const HEADER_HEIGHT = 96

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function HomeScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const { user } = useAuth()
  const { config: cityPrayer, reload: reloadCityPrayer } = useCityPrayer()
  const { location, loading: locLoading, refresh: refreshLoc, selectSavedLocation, searchAddress, savedLocations } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity, supportedCity } = useMosques(location)
  const [prayerInfo, setPrayerInfo] = useState(() => getLivePrayerInfo(new Date(), cityPrayer))
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [sectFilter, setSectFilter] = useState<MosqueSectFilter>('all')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [filterOpen, setFilterOpen] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const [now, setNow] = useState(new Date())
  const [nearbyOffsetY, setNearbyOffsetY] = useState(0)
  const [nearbyPinned, setNearbyPinned] = useState(false)

  const headerHeight = HEADER_HEIGHT + insets.top
  const pinStart = Math.max(0, nearbyOffsetY - headerHeight)

  const scrollNearbyOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, pinStart - 1), pinStart],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const pinnedOpacity = scrollY.interpolate({
    inputRange: [pinStart, pinStart + 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const pinnedTranslateY = scrollY.interpolate({
    inputRange: [pinStart, pinStart + 1],
    outputRange: [-4, 0],
    extrapolate: 'clamp',
  })

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      setNearbyPinned(value >= pinStart)
    })
    return () => scrollY.removeListener(id)
  }, [scrollY, pinStart])

  useEffect(() => {
    setPrayerInfo(getLivePrayerInfo(new Date(), cityPrayer))
  }, [cityPrayer])

  const refreshHome = useCallback(async () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
    const current = new Date()
    setNow(current)
    setPrayerInfo(getLivePrayerInfo(current, cityPrayer))
    await Promise.all([reload(), reloadCityPrayer()])
  }, [cityPrayer, reload, reloadCityPrayer])

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      void refreshHome()
    })
    return unsubscribe
  }, [navigation, refreshHome])

  useEffect(() => {
    const t = setInterval(() => {
      const current = new Date()
      setNow(current)
      setPrayerInfo(getLivePrayerInfo(current, cityPrayer))
    }, 30000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(t)
      clearInterval(clock)
    }
  }, [cityPrayer])

  const filtered = filterMosquesBySect(mosques, sectFilter)
  const nearbyAll = filterMosquesByRadius(sortMosques(filtered, sortMode), radiusKm)
  const nearby = nearbyAll.slice(0, HOME_NEARBY_PREVIEW_LIMIT)
  const nearbyTotal = nearbyAll.length
  const extras = getPrayerStatusExtras(now, cityPrayer)
  const activeFilterCount =
    (sortMode !== 'nearest' ? 1 : 0) + (sectFilter !== 'all' ? 1 : 0) + (radiusKm !== DEFAULT_MOSQUE_RADIUS_KM ? 1 : 0)
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

  const greetingName = user?.name?.trim().split(/\s+/)[0] ?? 'Guest'

  const nearbyHeading = formatNearbyMosqueHeading({
    count: nearbyTotal,
    radiusKm,
    loading,
    citySupported,
    locLoading,
  })
  const sunsetTime = cityPrayer.prayerSchedule.find((p) => p.name === 'Maghrib')?.start

  const nearbyFilters = (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{nearbyHeading}</Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)} hitSlop={8}>
            <Text style={styles.filterBtnIcon}>⏷</Text>
            <Text style={styles.filterBtnText}>Filter</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/mosques')} hitSlop={8}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.radiusRow}>
        <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} />
      </View>
    </>
  )

  return (
    <View style={styles.page}>
      <AnimatedScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => { void refreshHome() }} />
        }>
        <View style={{ height: headerHeight }} />

        <View style={styles.section}>
          <PrayerStatusCard
            info={prayerInfo}
            extras={extras}
            zawal={cityPrayer.zawal}
            sunsetTime={sunsetTime}
            hijriDate={ISLAMIC_CALENDAR.hijriDate}
            englishDate={formatShortDate(now)}
            compact
          />
        </View>

        {canManageMosques(user) ? (
          <View style={styles.section}>
            <HomeMosqueAdminPanel visible />
          </View>
        ) : null}

        <Animated.View
          style={[styles.stickyNearby, { opacity: scrollNearbyOpacity }]}
          onLayout={(e) => setNearbyOffsetY(e.nativeEvent.layout.y)}>
          {nearbyFilters}
        </Animated.View>

        <View style={[styles.section, styles.mosqueList]}>
          {!citySupported && !locLoading && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          {!loading && nearby.length > 0 && (
            <Text style={styles.peekHint}>Hold a mosque to preview · tap for full details</Text>
          )}
          {!loading && citySupported && nearbyTotal === 0 && (
            <Text style={styles.emptyNearby}>
              Try a larger radius or open View all to browse every mosque in {supportedCity?.name ?? 'your city'}.
            </Text>
          )}
          {loading && nearbyTotal === 0 ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            nearby.map((m) => (
              <MosqueCard
                key={m.id}
                mosque={m}
                travelMode="driving"
                homeCompact
                isPeekActive={peekMosque?.id === m.id}
                onPeek={() => setPeekMosque(m)}
                onPress={() => router.push(`/mosque/${m.id}`)}
              />
            ))
          )}
        </View>
      </AnimatedScrollView>

      <MosquePeekOverlay
        mosque={peekMosque}
        travelMode="driving"
        visible={peekMosque !== null}
        onClose={() => setPeekMosque(null)}
        onViewFull={(m) => router.push(`/mosque/${m.id}`)}
      />

      <CityPickerSheet
        visible={cityPickerOpen}
        selectedLocationId={selectedLocationId}
        savedLocations={savedLocations}
        onSelectSavedLocation={selectSavedLocation}
        onSearchAddress={searchAddress}
        searching={locLoading}
        onUseCurrentLocation={refreshLoc}
        onClose={() => setCityPickerOpen(false)}
      />

      <MosqueFilterSheet
        visible={filterOpen}
        sortMode={sortMode}
        sectFilter={sectFilter}
        onChangeSort={setSortMode}
        onChangeSect={setSectFilter}
        onClearAll={() => {
          setSortMode('nearest')
          setSectFilter('all')
        }}
        onClose={() => setFilterOpen(false)}
      />

      <Animated.View
        pointerEvents={nearbyPinned ? 'auto' : 'none'}
        style={[
          styles.pinnedNearby,
          {
            top: headerHeight,
            opacity: pinnedOpacity,
            transform: [{ translateY: pinnedTranslateY }],
          },
        ]}>
        {nearbyFilters}
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.solidHeader, { height: headerHeight, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBackdropSolid} />

        <View style={styles.heroInner}>
          <View style={styles.topRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.brandTitle} numberOfLines={1}>
                PrayNow
              </Text>
              <View style={styles.userRow}>
                <UserMenu tone="dark" />
                <InboxBellButton tone="dark" />
                <Text style={styles.userGreeting} numberOfLines={1}>
                  Hi {greetingName}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.locationRow}>
                <Text style={styles.heroLocation} numberOfLines={1}>
                  {locationLine}
                </Text>
                <Pressable
                  style={styles.locationSearchBtn}
                  onPress={() => setCityPickerOpen(true)}
                  hitSlop={8}
                  accessibilityLabel="Change location">
                  <Text style={styles.locationSearchIcon}>⌕</Text>
                </Pressable>
              </View>

              <Text style={styles.heroTime}>{formatClock(now)}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  solidHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface0,
    zIndex: 12,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBackdropSolid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface0,
  },
  pinnedNearby: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 11,
    backgroundColor: colors.surface0,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  heroInner: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 58,
  },
  headerLeft: {
    alignItems: 'flex-start',
    gap: 5,
    flexShrink: 0,
    maxWidth: '46%',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  userGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    minWidth: 0,
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: '100%',
  },
  heroTime: { color: colors.textPrimary, fontWeight: '800', fontSize: 18, textAlign: 'right' },
  heroLocation: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'right',
  },
  locationSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSearchIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: -1,
  },
  section: { paddingHorizontal: 16, marginTop: 8 },
  stickyNearby: {
    backgroundColor: colors.surface0,
    paddingBottom: 8,
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  sectionHeaderLeft: { flex: 1, minWidth: 0 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnIcon: { fontSize: 10, color: colors.primary, fontWeight: '800' },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  filterBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  radiusRow: {
    paddingHorizontal: 16,
    marginTop: 2,
  },
  emptyNearby: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  mosqueList: { paddingTop: 2 },
  peekHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 10,
    lineHeight: 16,
  },
})
