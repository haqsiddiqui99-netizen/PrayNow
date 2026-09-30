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
import { MosquePeekOverlay } from '@/src/components/MosquePeekOverlay'
import { MosqueRadiusChips } from '@/src/components/MosqueRadiusChips'
import { MosqueSortBar } from '@/src/components/MosqueSortBar'
import { NearbyMosquesMap } from '@/src/components/NearbyMosquesMap'
import { radius } from '@/src/constants/theme'
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
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const filterBtnRef = useRef<View>(null)
  const { t, formatRadius, placeName } = useLanguage()
  const { location, loading: locLoading } = useLocation()
  const { mosques, loading, reload, citySupported, detectedCity } = useMosques(location)
  const [sortMode, setSortMode] = useState<MosqueSortMode>('nearest')
  const [sectFilter, setSectFilter] = useState<MosqueSectFilter>('all')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(DEFAULT_MOSQUE_RADIUS_KM)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterAnchor, setFilterAnchor] = useState<FilterDropdownAnchor | null>(null)
  const [mosqueSearch, setMosqueSearch] = useState('')
  const [peekMosque, setPeekMosque] = useState<Mosque | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const filteredByMadhab = filterMosquesBySect(mosques, sectFilter)
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
    (sectFilter !== 'all' ? 1 : 0) + (radiusKm !== DEFAULT_MOSQUE_RADIUS_KM ? 1 : 0)

  const emptyRadiusText =
    radiusKm >= CITY_RADIUS_KM
      ? t('mosques.emptyCity')
      : t('mosques.emptyRadius', { radius: formatRadius(radiusKm) })

  const emptyListText = searchQuery
    ? t('mosques.emptySearch', { query: mosqueSearch.trim() })
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
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void reload() }} />}>
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
        <MosqueRadiusChips value={radiusKm} onChange={setRadiusKm} compact fullWidth />
      </View>

      <View style={styles.sortRow}>
        <View style={styles.sortScroll}>
          <MosqueSortBar value={sortMode} onChange={setSortMode} compact />
        </View>
        <Pressable ref={filterBtnRef} style={styles.filterBtn} onPress={openFilter} hitSlop={6}>
          <Text style={styles.filterBtnIcon}>⏷</Text>
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
                size={12}
                color={viewMode === 'list' ? colors.selectedText : colors.textMuted}
              />
            </Pressable>
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('map')}>
              <Ionicons
                name="map"
                size={12}
                color={viewMode === 'map' ? colors.selectedText : colors.textMuted}
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
            <Text style={styles.searchIcon}>⌕</Text>
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
                <Text style={styles.searchClear}>✕</Text>
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
                isPeekActive
                onPeek={() => setPeekMosque(peekMosque)}
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
            <Text style={styles.searchIcon}>⌕</Text>
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
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          {!loading && filtered.length > 0 && !searchQuery ? (
            <Text style={styles.peekHint}>{t('home.peekHint')}</Text>
          ) : null}
          {loading && !filtered.length ? (
            <ActivityIndicator color={colors.headerBg} style={styles.loader} />
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>{emptyListText}</Text>
          ) : (
            filtered.map((m) => (
              <MosqueCard
                key={m.id}
                mosque={m}
                travelMode={DEFAULT_TRAVEL_MODE}
                {...exploreCardProps}
                isPeekActive={peekMosque?.id === m.id}
                onPeek={() => setPeekMosque(m)}
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
      <MosqueFilterSheet
        visible={filterOpen}
        anchor={filterAnchor}
        sectFilter={sectFilter}
        onChangeSect={setSectFilter}
        onClearAll={() => {
          setSectFilter('all')
          setRadiusKm(DEFAULT_MOSQUE_RADIUS_KM)
        }}
        onClose={() => setFilterOpen(false)}
      />
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  radiusRow: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 0,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  sortScroll: {
    flex: 1,
    minWidth: 0,
  },
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
  filterBtnIcon: { fontSize: 9, color: colors.primary, fontWeight: '800' },
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
  viewToggleCol: {
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  viewLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  viewToggleBtn: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.selectedBg,
  },
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
  searchIcon: { fontSize: 15, color: colors.textMuted, marginRight: 6 },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  searchClear: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    paddingLeft: 8,
  },
  peekHint: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  // Edge-to-edge cards: the list itself carries no side gutter, unlike the
  // filter/search rows above it which still use paddingHorizontal: 16.
  list: { paddingHorizontal: 0, paddingTop: 10 },
  loader: { marginTop: 24 },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
}))
