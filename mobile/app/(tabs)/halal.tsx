import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/src/components/AppHeader'
import { GradientFill } from '@/src/components/GradientFill'
import { HalalDetailSheet } from '@/src/components/halal/HalalDetailSheet'
import { HalalJoinSheet } from '@/src/components/halal/HalalJoinSheet'
import { HalalArt, HalalListingCard, VerifiedSeal, roundKm } from '@/src/components/halal/HalalListingCard'
import { HALAL_CATEGORIES, HALAL_GOLD, halalCategory, halalTag } from '@/src/constants/halalCategories'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLocation } from '@/src/hooks/useLocation'
import { fetchHalalListings, trackHalalListing, type HalalCategory, type HalalListing } from '@/src/services/api'
import { haversineKm } from '@/src/utils/geo'
import { callListing, directionsToListing, openListingWebsite, whatsappListing } from '@/src/utils/halalContact'

const SAVED_KEY = 'praynow.halalSaved.v2'
/** Places this close count as "near you" even when their city name is spelled differently. */
const NEARBY_KM = 60
const COLLAPSED_TILES = 6

type Ranked = { listing: HalalListing; km: number | null }

const byDistance = (a: Ranked, b: Ranked) => (a.km ?? Number.MAX_VALUE) - (b.km ?? Number.MAX_VALUE)

export default function HalalScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { width } = useWindowDimensions()
  const { t, placeName, formatDistance, digits } = useLanguage()
  const { location } = useLocation()

  const [listings, setListings] = useState<HalalListing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategoryState] = useState<HalalCategory | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const setCategory = (next: HalalCategory | null) => {
    setCategoryState(next)
    setTagFilter(null)
  }
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [deliveryOnly, setDeliveryOnly] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [join, setJoin] = useState<{ featured: boolean } | null>(null)
  const [slide, setSlide] = useState(0)
  const [allTiles, setAllTiles] = useState(false)

  const load = useCallback(async () => {
    try {
      setListings(await fetchHalalListings())
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void AsyncStorage.getItem(SAVED_KEY).then((raw) => {
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSaved(parsed.filter((id) => typeof id === 'string'))
      } catch {
        /* ignore a bad save */
      }
    })
  }, [])

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]
      void AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next))
      return next
    })
  }

  const cityName = location.supportedCity?.name || location.city || ''
  const cityLabel = placeName(cityName) || t('halal.near')

  const ranked = useMemo<Ranked[]>(
    () =>
      listings.map((listing) => ({
        listing,
        km: listing.lat != null && listing.lng != null ? haversineKm(location.lat, location.lng, listing.lat, listing.lng) : null,
      })),
    [listings, location.lat, location.lng],
  )

  const local = useMemo(() => {
    const city = cityName.trim().toLowerCase()
    return ranked.filter(({ listing, km }) => (km != null && km <= NEARBY_KM) || (city && listing.city.trim().toLowerCase() === city))
  }, [ranked, cityName])
  const away = !local.length && ranked.length > 0
  const pool = away ? ranked : local

  const counts = useMemo(() => {
    const out = new Map<HalalCategory, number>()
    for (const { listing } of pool) out.set(listing.category, (out.get(listing.category) ?? 0) + 1)
    return out
  }, [pool])

  const needle = query.trim().toLowerCase()
  const filtering = Boolean(needle || category || verifiedOnly || deliveryOnly || savedOnly)
  const categoryTags = category ? halalCategory(category).tags ?? [] : []
  const activeTag = categoryTags.some((item) => item.id === tagFilter) ? tagFilter : null

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { listing } of pool) {
      if (listing.category !== category) continue
      for (const tag of listing.tags) {
        const id = tag.trim().toLowerCase()
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    return counts
  }, [pool, category])

  const results = useMemo(() => {
    if (!filtering) return []
    return pool
      .filter(({ listing }) => (category ? listing.category === category : true))
      .filter(({ listing }) => (activeTag ? listing.tags.some((tag) => tag.trim().toLowerCase() === activeTag) : true))
      .filter(({ listing }) => (verifiedOnly ? listing.verified : true))
      .filter(({ listing }) => (deliveryOnly ? listing.delivers : true))
      .filter(({ listing }) => (savedOnly ? saved.includes(listing.id) : true))
      .filter(({ listing }) => {
        if (!needle) return true
        const haystack = [
          listing.name,
          listing.tagline,
          listing.area,
          listing.city,
          listing.description,
          listing.tags.join(' '),
          listing.tags.map((tag) => {
            const known = halalTag(tag)
            return known ? t(known.label) : ''
          }).join(' '),
          t(halalCategory(listing.category).label),
        ].join(' ')
        return `${haystack} ${placeName(haystack)}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => Number(b.listing.featured) - Number(a.listing.featured) || byDistance(a, b))
  }, [filtering, pool, category, activeTag, verifiedOnly, deliveryOnly, savedOnly, saved, needle, t, placeName])

  const featured = useMemo(() => pool.filter(({ listing }) => listing.featured).sort(byDistance).slice(0, 8), [pool])
  const certified = useMemo(
    () => pool.filter(({ listing }) => listing.verified && !listing.featured).sort(byDistance).slice(0, 12),
    [pool],
  )
  const nearby = useMemo(() => [...pool].sort(byDistance).slice(0, 30), [pool])

  const open = ranked.find(({ listing }) => listing.id === openId) ?? null

  const failText = t('halal.openFail')
  const contact = (listing: HalalListing, run: () => Promise<void>) => {
    trackHalalListing(listing.id, 'contact')
    void run()
  }
  const actionsFor = (listing: HalalListing) => ({
    onCall: () => contact(listing, () => callListing(listing, failText)),
    onWhatsapp: () => contact(listing, () => whatsappListing(listing, t('halal.waHello'), failText)),
    onDirections: () => contact(listing, () => directionsToListing(listing, failText)),
  })
  const openListing = (listing: HalalListing) => {
    trackHalalListing(listing.id, 'view')
    setOpenId(listing.id)
  }

  const slideWidth = width - 36
  const onSlide = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSlide(Math.round(event.nativeEvent.contentOffset.x / (slideWidth + 10)))
  }

  const tiles = allTiles ? HALAL_CATEGORIES : HALAL_CATEGORIES.slice(0, COLLAPSED_TILES)
  const activeCategory = category ? halalCategory(category) : null

  const subtitle = loading
    ? t('common.updating')
    : away
      ? t('halal.subtitleAway', { count: digits(ranked.length), city: cityLabel })
      : t('halal.subtitle', { count: digits(pool.length), city: cityLabel })

  const renderCard = ({ listing, km }: Ranked) => (
    <HalalListingCard
      key={listing.id}
      listing={listing}
      km={km}
      saved={saved.includes(listing.id)}
      onOpen={() => openListing(listing)}
      onToggleSave={() => toggleSaved(listing.id)}
      {...actionsFor(listing)}
    />
  )

  const searchMaps = () => {
    const what = activeCategory ? t(activeCategory.label) : 'halal'
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`halal ${what} near ${cityName || 'me'}`)}`)
  }

  const filterChip = (on: boolean, label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void) => (
    <Pressable onPress={onPress} style={[styles.filter, on && styles.filterOn]} accessibilityState={{ selected: on }}>
      <Ionicons name={icon} size={14} color={on ? paper.onInk : paper.ink} />
      <Text style={[styles.filterText, on && styles.filterTextOn]}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={styles.page}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={paper.ink}
            colors={[paper.ink]}
            progressBackgroundColor={paper.card}
          />
        }>
        <ScreenHeader icon="halal" title={t('halal.title')} subtitle={subtitle} topInset={insets.top} showAccountMenu={false} />

        <View style={styles.search}>
          <Ionicons name="search" size={17} color={paper.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('halal.search')}
            placeholderTextColor={paper.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t('common.clearSearch')}>
              <Ionicons name="close-circle" size={18} color={paper.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filterChip(verifiedOnly, t('halal.verifiedOnly'), 'shield-checkmark-outline', () => setVerifiedOnly((on) => !on))}
          {filterChip(deliveryOnly, t('halal.delivery'), 'bicycle-outline', () => setDeliveryOnly((on) => !on))}
          {filterChip(
            savedOnly,
            saved.length ? `${t('halal.saved')} · ${digits(saved.length)}` : t('halal.saved'),
            savedOnly ? 'heart' : 'heart-outline',
            () => setSavedOnly((on) => !on),
          )}
          {HALAL_CATEGORIES.map((item) => {
            const on = item.id === category
            return (
              <Pressable
                key={item.id}
                onPress={() => setCategory(on ? null : item.id)}
                style={[styles.filter, on && styles.filterOn]}
                accessibilityState={{ selected: on }}>
                <MaterialCommunityIcons name={item.icon} size={14} color={on ? paper.onInk : paper.ink} />
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{t(item.label)}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={paper.ink} />
          </View>
        ) : failed && !listings.length ? (
          <View style={styles.failed}>
            <Ionicons name="cloud-offline-outline" size={28} color={paper.muted} />
            <Text style={styles.failedText}>{t('halal.loadFail')}</Text>
            <Pressable onPress={() => { setLoading(true); void load() }} style={styles.retry}>
              <Text style={styles.retryText}>{t('halal.retry')}</Text>
            </Pressable>
          </View>
        ) : filtering ? (
          <>
            {activeCategory ? (
              <View style={styles.catHero}>
                <GradientFill colors={activeCategory.colors} steps={20} />
                <View style={styles.catHeroGlyph} pointerEvents="none">
                  <MaterialCommunityIcons name={activeCategory.icon} size={120} color="rgba(255,255,255,0.12)" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catHeroTitle}>{t(activeCategory.label)}</Text>
                  <Text style={styles.catHeroSub}>{t(activeCategory.sub)}</Text>
                </View>
                <Pressable onPress={() => setCategory(null)} hitSlop={10} style={styles.catHeroClose} accessibilityLabel={t('common.close')}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
            {categoryTags.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, styles.subFilters]}>
                <Pressable onPress={() => setTagFilter(null)} style={[styles.filter, !activeTag && styles.filterOn]} accessibilityState={{ selected: !activeTag }}>
                  <Text style={[styles.filterText, !activeTag && styles.filterTextOn]}>{t('halal.tag.all')}</Text>
                </Pressable>
                {categoryTags.map((item) => {
                  const on = item.id === activeTag
                  const count = tagCounts.get(item.id) ?? 0
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setTagFilter(on ? null : item.id)}
                      style={[styles.filter, on && styles.filterOn, !count && !on && styles.filterIdle]}
                      accessibilityState={{ selected: on }}>
                      <MaterialCommunityIcons name={item.icon} size={14} color={on ? paper.onInk : paper.ink} />
                      <Text style={[styles.filterText, on && styles.filterTextOn]}>
                        {count ? `${t(item.label)} · ${digits(count)}` : t(item.label)}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : null}
            <Text style={styles.section}>{t('halal.results', { count: digits(results.length) })}</Text>
            {results.map(renderCard)}
            {!results.length ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name={activeCategory?.icon ?? 'storefront-outline'} size={28} color={paper.ink} />
                </View>
                <Text style={styles.emptyTitle}>
                  {needle
                    ? t('halal.emptySearch', { query: query.trim() })
                    : t('halal.emptyTitle', { category: activeCategory ? t(activeCategory.label) : t('halal.places') })}
                </Text>
                <Text style={styles.emptySub}>{t('halal.emptySub')}</Text>
                <View style={styles.emptyActions}>
                  <Pressable onPress={() => setJoin({ featured: false })} style={styles.emptyMain}>
                    <Ionicons name="add" size={16} color={paper.onInk} />
                    <Text style={styles.emptyMainText}>{t('halal.suggest')}</Text>
                  </Pressable>
                  <Pressable onPress={searchMaps} style={styles.emptyGhost}>
                    <Ionicons name="map-outline" size={15} color={paper.ink} />
                    <Text style={styles.emptyGhostText}>{t('halal.mapsShort')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {featured.length ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={slideWidth + 10}
                  decelerationRate="fast"
                  onMomentumScrollEnd={onSlide}
                  contentContainerStyle={styles.slides}>
                  {featured.map(({ listing, km }) => {
                    const info = halalCategory(listing.category)
                    return (
                      <Pressable key={listing.id} onPress={() => openListing(listing)} style={[styles.slide, { width: slideWidth }]}>
                        <GradientFill colors={info.colors} steps={24} />
                        <View style={styles.slideGlyph} pointerEvents="none">
                          <MaterialCommunityIcons name={info.icon} size={170} color="rgba(255,255,255,0.10)" />
                        </View>
                        <View style={styles.slideTop}>
                          <View style={styles.slideBadge}>
                            <MaterialCommunityIcons name="crown" size={11} color="#1C140C" />
                            <Text style={styles.slideBadgeText}>{t('halal.featuredBadge')}</Text>
                          </View>
                          {listing.verified ? (
                            <View style={styles.slideSeal}>
                              <MaterialCommunityIcons name="check-decagram" size={13} color="#FFFFFF" />
                              <Text style={styles.slideSealText}>{t('halal.verified')}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.slideBody}>
                          {listing.photoUrl ? <HalalArt listing={listing} size={54} radius={14} style={styles.slidePhoto} /> : null}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.slideName} numberOfLines={1}>
                              {listing.name}
                            </Text>
                            {listing.tagline ? (
                              <Text style={styles.slideTagline} numberOfLines={1}>
                                {listing.tagline}
                              </Text>
                            ) : null}
                            <Text style={styles.slideMeta} numberOfLines={1}>
                              {[t(info.label), listing.area ? placeName(listing.area) : '', km != null ? formatDistance(roundKm(km)) : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                          <View style={styles.slideGo}>
                            <Ionicons name="arrow-forward" size={16} color="#1C140C" />
                          </View>
                        </View>
                      </Pressable>
                    )
                  })}
                  <Pressable onPress={() => setJoin({ featured: true })} style={[styles.slide, styles.promo, { width: slideWidth }]}>
                    <PromoBody />
                  </Pressable>
                </ScrollView>
                <View style={styles.dots}>
                  {[...featured, null].map((item, i) => (
                    <View key={item?.listing.id ?? 'promo'} style={[styles.dot, i === slide && styles.dotOn]} />
                  ))}
                </View>
              </>
            ) : (
              <Pressable onPress={() => setJoin({ featured: true })} style={[styles.slide, styles.promo, styles.promoAlone]}>
                <PromoBody />
              </Pressable>
            )}

            <View style={styles.sectionRow}>
              <Text style={styles.sectionInline}>{t('halal.categories')}</Text>
            </View>
            <View style={styles.tiles}>
              {tiles.map((item) => {
                const count = counts.get(item.id) ?? 0
                return (
                  <Pressable key={item.id} onPress={() => setCategory(item.id)} style={styles.tile}>
                    <GradientFill colors={item.colors} steps={18} />
                    <View style={styles.tileGlyph} pointerEvents="none">
                      <MaterialCommunityIcons name={item.icon} size={78} color="rgba(255,255,255,0.13)" />
                    </View>
                    <View style={styles.tileIcon}>
                      <MaterialCommunityIcons name={item.icon} size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {t(item.label)}
                    </Text>
                    <Text style={styles.tileSub} numberOfLines={1}>
                      {t(item.sub)}
                    </Text>
                    <Text style={styles.tileCount}>
                      {count ? (count === 1 ? t('halal.onePlace') : t('halal.placesCount', { count: digits(count) })) : t('halal.comingSoon')}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {HALAL_CATEGORIES.length > COLLAPSED_TILES ? (
              <Pressable onPress={() => setAllTiles((on) => !on)} style={styles.more}>
                <Text style={styles.moreText}>{allTiles ? t('halal.fewer') : t('halal.allCategories', { count: digits(HALAL_CATEGORIES.length) })}</Text>
                <Ionicons name={allTiles ? 'chevron-up' : 'chevron-down'} size={15} color={paper.ink} />
              </Pressable>
            ) : null}

            {certified.length ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionInline}>{t('halal.certified')}</Text>
                  <VerifiedSeal compact />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.certRow}>
                  {certified.map(({ listing, km }) => (
                    <Pressable key={listing.id} onPress={() => openListing(listing)} style={styles.certCard}>
                      <HalalArt listing={listing} size={132} radius={18} iconSize={44} />
                      <Text style={styles.certName} numberOfLines={1}>
                        {listing.name}
                      </Text>
                      <Text style={styles.certMeta} numberOfLines={1}>
                        {[t(halalCategory(listing.category).label), km != null ? formatDistance(roundKm(km)) : ''].filter(Boolean).join(' · ')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.section}>{away ? t('halal.elsewhere') : t('halal.near')}</Text>
            {nearby.map(renderCard)}
            {!nearby.length ? <Text style={styles.footnote}>{t('halal.emptySub')}</Text> : null}
          </>
        )}

        {!loading ? (
          <Pressable onPress={() => setJoin({ featured: false })} style={styles.join}>
            <GradientFill colors={['#1C140C', '#3B2A14']} steps={20} />
            <View style={styles.joinIcon}>
              <MaterialCommunityIcons name="storefront-outline" size={24} color="#1C140C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.joinTitle}>{t('halal.joinBannerTitle')}</Text>
              <Text style={styles.joinSub}>{t('halal.joinBannerSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={HALAL_GOLD} />
          </Pressable>
        ) : null}

        <Text style={styles.footnote}>{t('halal.note')}</Text>
      </ScrollView>

      <HalalDetailSheet
        listing={open?.listing ?? null}
        km={open?.km ?? null}
        saved={open ? saved.includes(open.listing.id) : false}
        onClose={() => setOpenId(null)}
        onToggleSave={() => open && toggleSaved(open.listing.id)}
        onWebsite={() => open && contact(open.listing, () => openListingWebsite(open.listing, failText))}
        {...(open ? actionsFor(open.listing) : { onCall: () => {}, onWhatsapp: () => {}, onDirections: () => {} })}
      />
      <HalalJoinSheet
        visible={join != null}
        city={cityName}
        initialCategory={category}
        initialFeatured={join?.featured ?? false}
        onClose={() => setJoin(null)}
      />
    </View>
  )
}

function PromoBody() {
  const styles = useStyles()
  const { t } = useLanguage()
  return (
    <>
      <GradientFill colors={['#1C140C', '#4A3518']} steps={24} />
      <View style={styles.slideGlyph} pointerEvents="none">
        <MaterialCommunityIcons name="crown" size={160} color="rgba(231,211,161,0.10)" />
      </View>
      <View style={styles.slideTop}>
        <View style={styles.slideBadge}>
          <MaterialCommunityIcons name="bullhorn-outline" size={11} color="#1C140C" />
          <Text style={styles.slideBadgeText}>{t('halal.featuredBadge')}</Text>
        </View>
      </View>
      <View style={styles.slideBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.slideName}>{t('halal.promoTitle')}</Text>
          <Text style={styles.promoSub}>{t('halal.promoSub')}</Text>
        </View>
        <View style={styles.promoCta}>
          <Text style={styles.promoCtaText}>{t('halal.promoCta')}</Text>
        </View>
      </View>
    </>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
    page: { flex: 1, backgroundColor: paper.page },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 14,
      marginTop: 6,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 18,
      backgroundColor: paper.card,
      borderWidth: 1,
      borderColor: paper.line,
    },
    searchInput: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 14.5, color: paper.ink, padding: 0 },
    filters: { gap: 7, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
    filter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: paper.chip,
    },
    filterOn: { backgroundColor: paper.ink },
    filterIdle: { opacity: 0.55 },
    subFilters: { paddingTop: 2, paddingBottom: 6 },
    filterText: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: paper.ink },
    filterTextOn: { color: paper.onInk },
    loading: { paddingVertical: 60, alignItems: 'center' },
    failed: { alignItems: 'center', gap: 10, paddingVertical: 40, marginHorizontal: 24 },
    failedText: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: paper.muted, textAlign: 'center' },
    retry: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: paper.ink },
    retryText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.onInk },
    slides: { gap: 10, paddingHorizontal: 18, paddingTop: 12 },
    slide: { height: 178, borderRadius: 26, overflow: 'hidden', padding: 16, justifyContent: 'space-between' },
    slideGlyph: { position: 'absolute', right: -26, bottom: -34 },
    slideTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slideBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: HALAL_GOLD,
    },
    slideBadgeText: { fontFamily: 'Figtree_800ExtraBold', fontSize: 9.5, letterSpacing: 0.9, color: '#1C140C' },
    slideSeal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    slideSealText: { fontFamily: 'Figtree_700Bold', fontSize: 10.5, color: '#FFFFFF' },
    slideBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    slidePhoto: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
    slideName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, lineHeight: 30, color: '#FFFFFF', letterSpacing: -0.3 },
    slideTagline: { fontFamily: 'Figtree_600SemiBold', fontSize: 13.5, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
    slideMeta: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 5 },
    slideGo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: HALAL_GOLD },
    promo: { borderWidth: 1, borderColor: 'rgba(231,211,161,0.35)' },
    promoAlone: { marginHorizontal: 14, marginTop: 12 },
    promoSub: { fontFamily: 'Figtree_500Medium', fontSize: 13, lineHeight: 18, color: '#CDBFA6', marginTop: 4 },
    promoCta: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: HALAL_GOLD },
    promoCtaText: { fontFamily: 'Figtree_800ExtraBold', fontSize: 12.5, color: '#1C140C' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: paper.line },
    dotOn: { width: 18, backgroundColor: paper.ink },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10, marginHorizontal: 18 },
    sectionInline: {
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: paper.muted,
    },
    section: {
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 18,
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: paper.muted,
    },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, paddingHorizontal: 14 },
    tile: { width: '48.5%', height: 112, borderRadius: 22, overflow: 'hidden', padding: 12, justifyContent: 'flex-end' },
    tileGlyph: { position: 'absolute', right: -12, top: -10 },
    tileIcon: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    tileLabel: { fontFamily: 'Figtree_800ExtraBold', fontSize: 15, color: '#FFFFFF' },
    tileSub: { fontFamily: 'Figtree_500Medium', fontSize: 11.5, color: 'rgba(255,255,255,0.82)', marginTop: 1 },
    tileCount: { fontFamily: 'Figtree_700Bold', fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.3 },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      marginTop: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: paper.chip,
    },
    moreText: { fontFamily: 'Figtree_700Bold', fontSize: 12.5, color: paper.ink },
    certRow: { gap: 12, paddingHorizontal: 14 },
    certCard: { width: 132 },
    certName: { fontFamily: 'Figtree_700Bold', fontSize: 13.5, color: paper.ink, marginTop: 7 },
    certMeta: { fontFamily: 'Figtree_500Medium', fontSize: 11.5, color: paper.muted, marginTop: 1 },
    catHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 14,
      marginTop: 10,
      padding: 16,
      minHeight: 92,
      borderRadius: 22,
      overflow: 'hidden',
    },
    catHeroGlyph: { position: 'absolute', right: 30, bottom: -28 },
    catHeroTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: '#FFFFFF' },
    catHeroSub: { fontFamily: 'Figtree_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    catHeroClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    empty: { alignItems: 'center', marginHorizontal: 24, marginTop: 10, gap: 6 },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: paper.chip,
      marginBottom: 4,
    },
    emptyTitle: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: paper.ink, textAlign: 'center' },
    emptySub: { fontFamily: 'Figtree_500Medium', fontSize: 13, lineHeight: 19, color: paper.muted, textAlign: 'center' },
    emptyActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    emptyMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: paper.ink,
    },
    emptyMainText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.onInk },
    emptyGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: paper.line,
      backgroundColor: paper.card,
    },
    emptyGhostText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.ink },
    join: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 14,
      marginTop: 18,
      padding: 16,
      borderRadius: 24,
      overflow: 'hidden',
    },
    joinIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: HALAL_GOLD },
    joinTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, color: '#F7F1E6' },
    joinSub: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, lineHeight: 17, color: '#CDBFA6', marginTop: 2 },
    footnote: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 12,
      lineHeight: 17,
      color: paper.muted,
      marginHorizontal: 18,
      marginTop: 14,
      textAlign: 'center',
    },
  }
})
