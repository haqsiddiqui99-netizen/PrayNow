import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { useNavigation } from "expo-router/react-navigation"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppHeader, APP_HEADER_CONTENT_HEIGHT } from '@/src/components/AppHeader'
import { CityPickerSheet } from '@/src/components/CityPickerSheet'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { MosqueCard } from '@/src/components/MosqueCard'
import { MosqueFilterSheet, type FilterDropdownAnchor } from '@/src/components/MosqueFilterSheet'
import { MosquePeekOverlay } from '@/src/components/MosquePeekOverlay'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { MosqueSortBar } from '@/src/components/MosqueSortBar'
import { HomePrayerCard } from '@/src/components/HomePrayerCard'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  filterMosquesByRadius,
  HOME_NEARBY_PREVIEW_LIMIT,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'
import { useAuth } from '@/src/context/AuthContext'
import { useCityPrayer } from '@/src/context/CityPrayerContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { HomeMosqueAdminPanel } from '@/src/components/HomeMosqueAdminPanel'
import { formatHijriDate } from '@/src/utils/hijriDate'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import type { Mosque } from '@/src/types'
import { getLivePrayerInfo } from '@/src/utils/prayerSchedule'
import {
  filterMosquesBySect,
  sortMosques,
  type MosqueSectFilter,
  type MosqueSortMode,
} from '@/src/utils/mosqueSort'
import { canManageMosques } from '@/src/utils/roles'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

/** Home keeps the three sorts people actually use; the Mosques tab has them all. */
const HOME_SORT_MODES: ReadonlyArray<MosqueSortMode> = ['nearest', 'early-namaz', 'capacity-high']

export default function HomeScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useRef(new Animated.Value(0)).current
  const { user } = useAuth()
  const { t, formatRadius, placeName } = useLanguage()
  const { config: cityPrayer, reload: reloadCityPrayer } = useCityPrayer()
  const {
    location,
    loading: locLoading,
    refresh: refreshLoc,
    selectCity,
    selectSavedLocation,
    removeSavedLocation,
    searchAddress,
    savedLocations,
  } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity, supportedCity } = useMosques(location)
  const [prayerInfo, setPrayerInfo] = useState(() => getLivePrayerInfo(new Date(), cityPrayer))
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [sectFilter, setSectFilter] = useState<MosqueSectFilter>('all')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterAnchor, setFilterAnchor] = useState<FilterDropdownAnchor | null>(null)
  const filterBtnRef = useRef<View>(null)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const [now, setNow] = useState(new Date())
  const [mosqueSearch, setMosqueSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState<number | null>(null)

  const headerHeight = measuredHeaderHeight ?? APP_HEADER_CONTENT_HEIGHT + insets.top

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, Math.max(headerHeight, 1)],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  })

  useEffect(() => {
    setPrayerInfo(getLivePrayerInfo(new Date(), cityPrayer))
  }, [cityPrayer])

  const refreshHome = useCallback(
    async (options?: { scrollToTop?: boolean }) => {
      if (options?.scrollToTop) {
        scrollRef.current?.scrollTo({ y: 0, animated: true })
      }
      setRefreshing(true)
      const current = new Date()
      setNow(current)
      setPrayerInfo(getLivePrayerInfo(current, cityPrayer))
      try {
        await Promise.all([reload(), reloadCityPrayer(), refreshLoc()])
      } finally {
        setRefreshing(false)
      }
    },
    [cityPrayer, reload, reloadCityPrayer, refreshLoc],
  )

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      void refreshHome({ scrollToTop: true })
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
  const nearbyByRadius = filterMosquesByRadius(sortMosques(filtered, sortMode), radiusKm)
  const searchQuery = mosqueSearch.trim().toLowerCase()
  const nearbyAll = searchQuery
    ? nearbyByRadius.filter((m) => {
        const latin = `${m.name} ${m.area} ${m.address}`
        // Match either script, so typing "Jama" or "जामा" both work.
        const haystack = `${latin} ${placeName(latin)}`.toLowerCase()
        return haystack.includes(searchQuery)
      })
    : nearbyByRadius
  // Distance chips keep a short home preview; search / Within City lists every match in range.
  const nearby =
    searchQuery || radiusKm >= CITY_RADIUS_KM
      ? nearbyAll
      : nearbyAll.slice(0, HOME_NEARBY_PREVIEW_LIMIT)
  const nearbyTotal = nearbyAll.length
  const activeFilterCount =
    (sectFilter !== 'all' ? 1 : 0) + (radiusKm !== DEFAULT_MOSQUE_RADIUS_KM ? 1 : 0)
  const locationLine = locLoading
    ? t('common.updating')
    : location.region && location.region !== location.city
      ? `${location.region}, ${location.city}`
      : location.label

  const selectedLocationId = savedLocations.find(
    (item) =>
      item.city === location.city &&
      Math.abs(item.lat - location.lat) < 0.02 &&
      Math.abs(item.lng - location.lng) < 0.02,
  )?.id ?? savedLocations[0]?.id ?? null

  const greetingName = user?.name?.trim().split(/\s+/)[0] ?? t('common.guest')

  const headerLocationText = locLoading ? t('common.updating') : locationLine

  const radiusScope =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.inCity')
      : t('mosques.within', { radius: formatRadius(radiusKm) })

  const nearbyCountText = loading ? t('common.updating') : `${nearbyTotal} · ${radiusScope}`

  const openFilter = () => {
    const node = filterBtnRef.current
    if (!node) {
      setFilterAnchor(null)
      setFilterOpen(true)
      return
    }
    node.measureInWindow((x, y, width, height) => {
      const screenW = Dimensions.get('window').width
      setFilterAnchor({ top: y + height + 6, right: Math.max(12, screenW - x - width) })
      setFilterOpen(true)
    })
  }

  const filterButton = (
    <Pressable
      ref={filterBtnRef}
      style={styles.filterBtn}
      onPress={openFilter}
      hitSlop={6}>
      <Ionicons name="options-outline" size={12} color={colors.primary} />
      <Text style={styles.filterBtnText}>{t('common.filter')}</Text>
      {activeFilterCount > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
        </View>
      )}
    </Pressable>
  )

  const nearbyRadius = (
    <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} compact fullWidth />
  )

  const nearbySort = (
    <View style={styles.sortRow}>
      <View style={styles.sortScroll}>
        <MosqueSortBar
          value={sortMode}
          onChange={setSortMode}
          compact
          modes={HOME_SORT_MODES}
        />
      </View>
      {filterButton}
    </View>
  )

  return (
    <View style={styles.page}>
      <AnimatedScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
        scrollEventThrottle={16}
        alwaysBounceVertical
        overScrollMode="always"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshHome()
            }}
            tintColor={colors.primary}
            colors={[colors.primary, colors.primaryLight]}
            progressViewOffset={Platform.OS === 'android' ? headerHeight : 0}
            progressBackgroundColor={colors.surface2}
          />
        }>
        <View style={{ height: headerHeight }} />

        <View style={styles.section}>
          <HomePrayerCard
            info={prayerInfo}
            config={cityPrayer}
            hijriDate={formatHijriDate(now)}
            now={now}
          />
        </View>

        {canManageMosques(user) ? (
          <View style={styles.section}>
            <HomeMosqueAdminPanel visible />
          </View>
        ) : null}

        <View style={[styles.section, styles.mosqueList]}>
          {!citySupported && !locLoading && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          <View style={styles.nearbyHeadingRow}>
            <Text style={styles.nearbyTitle} numberOfLines={1}>
              {t('home.nearby')}
            </Text>
            <Text style={styles.nearbyCount} numberOfLines={1}>
              {nearbyCountText}
            </Text>
          </View>
          {nearbyRadius}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                radiusKm >= CITY_RADIUS_KM
                  ? t('home.searchInCity')
                  : t('home.searchInRange')
              }
              placeholderTextColor={colors.textMuted}
              value={mosqueSearch}
              onChangeText={setMosqueSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {mosqueSearch.length > 0 ? (
              <Pressable onPress={() => setMosqueSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {nearbySort}
          {!loading && nearby.length > 0 && !searchQuery ? (
            <Text style={styles.peekHint}>{t('home.peekHint')}</Text>
          ) : null}
          {!loading && citySupported && nearbyTotal === 0 && (
            <Text style={styles.emptyNearby}>
              {searchQuery
                ? t('mosques.emptySearch', { query: mosqueSearch.trim() })
                : t('mosques.emptyHint', { city: supportedCity?.name ?? '' })}
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
        selectedCityName={location.supportedCity?.name ?? location.city}
        savedLocations={savedLocations}
        onSelectCity={selectCity}
        onSelectSavedLocation={selectSavedLocation}
        onRemoveSavedLocation={removeSavedLocation}
        onSearchAddress={searchAddress}
        searching={locLoading}
        onUseCurrentLocation={refreshLoc}
        onClose={() => setCityPickerOpen(false)}
      />

      <MosqueFilterSheet
        visible={filterOpen}
        anchor={filterAnchor}
        sectFilter={sectFilter}
        onChangeSect={setSectFilter}
        onClearAll={() => setSectFilter('all')}
        onClose={() => setFilterOpen(false)}
      />

      <Animated.View
        style={[
          styles.headerWrap,
          styles.boxNonePointerEvents,
          { transform: [{ translateY: headerTranslateY }] },
        ]}>
        <AppHeader
          greetingName={greetingName}
          locationText={headerLocationText}
          onPressLocation={() => setCityPickerOpen(true)}
          topInset={insets.top}
          onMeasureHeight={setMeasuredHeaderHeight}
        />
      </Animated.View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 12,
  },
  boxNonePointerEvents: { pointerEvents: 'box-none' },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 10, marginTop: 4 },
  nearbyHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  nearbyTitle: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  nearbyCount: { flexShrink: 0, fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
    alignSelf: 'center',
  },
  filterBtnText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  filterBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 0,
    marginBottom: 4,
  },
  sortScroll: {
    flex: 1,
    minWidth: 0,
  },
  emptyNearby: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  mosqueList: { paddingTop: 4, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  peekHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 16,
  },
}))
