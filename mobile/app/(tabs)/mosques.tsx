import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/src/components/AppHeader'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { MosqueCard } from '@/src/components/MosqueCard'
import { MosqueFilterSheet, type FilterDropdownAnchor } from '@/src/components/MosqueFilterSheet'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { MosqueSortBar } from '@/src/components/MosqueSortBar'
import { NearbyMosquesMap } from '@/src/components/NearbyMosquesMap'
import { paperColors, radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import {
  CITY_RADIUS_KM,
  DEFAULT_MOSQUE_RADIUS_KM,
  filterMosquesByRadius,
  type MosqueRadiusKm,
} from '@/src/constants/mosqueRadius'
import { useLanguage } from '@/src/context/LanguageContext'
import { useLocation } from '@/src/hooks/useLocation'
import { useMosques } from '@/src/hooks/useMosques'
import type { Mosque } from '@/src/types'
import { filterMosquesByFacilities, type FacilityFilterId } from '@/src/utils/facilities'
import { openNearbyMosquesOnMap } from '@/src/utils/maps'
import {
  filterMosquesBySect,
  sortMosques,
  type MosqueSectFilter,
  type MosqueSortMode,
} from '@/src/utils/mosqueSort'

type ViewMode = 'list' | 'map'

const DEFAULT_TRAVEL_MODE = 'driving' as const

export default function MosquesScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const filterBtnRef = useRef<View>(null)
  const { t, formatRadius, placeName } = useLanguage()
  const { location, loading: locLoading } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity } = useMosques(location)
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [sectFilter, setSectFilter] = useState<MosqueSectFilter>('all')
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilterId[]>([])
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterAnchor, setFilterAnchor] = useState<FilterDropdownAnchor | null>(null)
  const [mosqueSearch, setMosqueSearch] = useState('')
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const filteredByMadhab = filterMosquesByFacilities(filterMosquesBySect(mosques, sectFilter), facilityFilter)
  const filteredByRadius = filterMosquesByRadius(sortMosques(filteredByMadhab, sortMode), radiusKm)
  const searchQuery = mosqueSearch.trim().toLowerCase()
  const filtered = searchQuery
    ? filteredByRadius.filter((m) => {
        const latin = `${m.name} ${m.area} ${m.address}`
        // Match either script, so typing "Jama" or "जामा" both work.
        const haystack = `${latin} ${placeName(latin)}`.toLowerCase()
        return haystack.includes(searchQuery)
      })
    : filteredByRadius

  const activeFilterCount =
    (sectFilter !== 'all' ? 1 : 0) + (radiusKm !== DEFAULT_MOSQUE_RADIUS_KM ? 1 : 0) + facilityFilter.length

  const emptyRadiusText =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.emptyCity')
      : t('mosques.emptyRadius', { radius: formatRadius(radiusKm) })

  const emptyListText = searchQuery
    ? t('mosques.emptySearch', { query: mosqueSearch.trim() })
    : facilityFilter.length
      ? t('filter.emptyFacilities')
      : sectFilter !== 'all'
      ? t('mosques.emptyMadhab')
      : emptyRadiusText

  const radiusScope =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.inCity')
      : t('mosques.within', { radius: formatRadius(radiusKm) })

  const locationLine = locLoading
    ? t('common.updating')
    : location.region && location.region !== location.city
      ? `${location.region}, ${location.city}`
      : location.label

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

  const exploreCardProps = {
    compact: true as const,
    explore: true,
    showStaffContacts: true,
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => { void reload() }}
          tintColor={paper.ink}
          colors={[paper.ink]}
          progressBackgroundColor={paper.card}
        />
      }>
      <ScreenHeader
        title={t('screens.mosquesTitle')}
        subtitle={
          citySupported
            ? `${filtered.length} ${radiusScope} · ${locationLine}`
            : t('mosques.detecting', { location: locationLine })
        }
        topInset={insets.top}
        showAccountMenu={false}
      />

      <View style={styles.radiusRow}>
        <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} />
      </View>

      <View style={styles.sortOnly}>
        <MosqueSortBar
          value={sortMode}
          onChange={setSortMode}
          compact
          hintBackgroundColor={paper.page}
        />
      </View>

      <View style={styles.toolRow}>
        <Pressable ref={filterBtnRef} style={styles.filterBtn} onPress={openFilter} hitSlop={6}>
          <Ionicons name="options-outline" size={16} color={paper.ink} />
          <Text style={styles.filterBtnText}>{t('common.filter')}</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.viewToggleCol}>
          <Text style={styles.viewLabel}>{t('common.view')}</Text>
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}>
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? paper.onInk : paper.muted}
              />
            </Pressable>
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('map')}>
              <Ionicons
                name="map"
                size={16}
                color={viewMode === 'map' ? paper.onInk : paper.muted}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapSection}>
          {!citySupported && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color={paper.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                radiusKm >= CITY_RADIUS_KM
                  ? t('home.searchInCity')
                  : t('home.searchInRange')
              }
              placeholderTextColor={paper.faint}
              value={mosqueSearch}
              onChangeText={setMosqueSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {mosqueSearch.length > 0 ? (
              <Pressable onPress={() => setMosqueSearch('')} hitSlop={8} accessibilityLabel={t('common.clearSearch')}>
                <Ionicons name="close-circle" size={16} color={paper.muted} />
              </Pressable>
            ) : null}
          </View>
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
                {...exploreCardProps}
              />
            </View>
          ) : filtered.length > 0 ? (
            <Text style={styles.mapHint}>Tap a pin to see mosque details</Text>
          ) : (
            <Text style={styles.emptyText}>{emptyListText}</Text>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {!citySupported && (
            <CityUnavailableBanner detectedCity={detectedCity} country={location.country} />
          )}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color={paper.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                radiusKm >= CITY_RADIUS_KM
                  ? t('home.searchInCity')
                  : t('home.searchInRange')
              }
              placeholderTextColor={paper.faint}
              value={mosqueSearch}
              onChangeText={setMosqueSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {mosqueSearch.length > 0 ? (
              <Pressable onPress={() => setMosqueSearch('')} hitSlop={8} accessibilityLabel={t('common.clearSearch')}>
                <Ionicons name="close-circle" size={16} color={paper.muted} />
              </Pressable>
            ) : null}
          </View>
          {loading && !filtered.length ? (
            <ActivityIndicator color={paper.ink} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{emptyListText}</Text>
          ) : (
            filtered.map((m) => (
              <MosqueCard
                key={m.id}
                mosque={m}
                travelMode={DEFAULT_TRAVEL_MODE}
                {...exploreCardProps}
              />
            ))
          )}
        </View>
      )}

      <MosqueFilterSheet
        visible={filterOpen}
        anchor={filterAnchor}
        sectFilter={sectFilter}
        onChangeSect={setSectFilter}
        facilities={facilityFilter}
        onChangeFacilities={setFacilityFilter}
        onClearAll={() => {
          setSectFilter('all')
          setFacilityFilter([])
          setRadiusKm(DEFAULT_MOSQUE_RADIUS_KM)
        }}
        onClose={() => setFilterOpen(false)}
      />
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
  page: { flex: 1, backgroundColor: paper.page },
  radiusRow: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 0,
  },
  sortOnly: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: paper.chip,
    flexShrink: 0,
    alignSelf: 'center',
  },
  filterBtnText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.ink },
  filterBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontFamily: 'Figtree_700Bold', fontSize: 8, color: '#fff' },
  viewToggleCol: {
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  viewLabel: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 8,
    color: paper.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: paper.chip,
    borderRadius: radius.pill,
    padding: 2,
  },
  viewToggleBtn: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  viewToggleBtnActive: {
    backgroundColor: paper.ink,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: paper.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: paper.line,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: 'Figtree_500Medium',
    fontSize: 14,
    color: paper.ink,
  },
  peekHint: {
    fontFamily: 'Figtree_500Medium',
    fontSize: 11,
    color: paper.muted,
    marginBottom: 8,
    lineHeight: 16,
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
    fontFamily: 'Figtree_500Medium',
    color: paper.muted,
    fontSize: 13,
  },
  list: { paddingHorizontal: 12, paddingTop: 10 },
  loader: { marginTop: 24 },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: 'Figtree_500Medium',
    color: paper.muted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  }
})
