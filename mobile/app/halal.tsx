import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showToast } from '@/src/components/AppToast'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { HALAL_CUISINES, HALAL_PLACES, distanceKm, formatKm, type HalalPlace } from '@/src/data/halalPlaces'
import { useLocation } from '@/src/hooks/useLocation'
import { openGoogleMapsCitySearch } from '@/src/utils/maps'

const SAVED_KEY = 'praynow.halalSaved.v1'

export default function HalalScreen() {
  const styles = useStyles()
  const { mode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { location } = useLocation()
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState<(typeof HALAL_CUISINES)[number]>('All')
  const [saved, setSaved] = useState<string[]>([])

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

  const city = location.supportedCity?.name || location.city || 'your city'
  const ranked = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return HALAL_PLACES.map((place) => ({
      place,
      km: distanceKm(location.lat, location.lng, place.lat, place.lng),
    }))
      .filter(({ place }) => (cuisine === 'All' ? true : place.cuisine === cuisine))
      .filter(({ place }) =>
        needle ? `${place.name} ${place.area} ${place.cuisine} ${place.knownFor}`.toLowerCase().includes(needle) : true,
      )
      .sort((a, b) => a.km - b.km)
  }, [cuisine, location.lat, location.lng, query])

  const nearest = ranked[0]?.km ?? 99
  const inDelhi = nearest < 80
  const savedPlaces = HALAL_PLACES.filter((place) => saved.includes(place.id))

  const toggleSaved = (place: HalalPlace) => {
    setSaved((current) => {
      const next = current.includes(place.id) ? current.filter((id) => id !== place.id) : [place.id, ...current]
      void AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next))
      return next
    })
  }

  const openPlace = (place: HalalPlace) => {
    void openGoogleMapsCitySearch(`${place.name}, ${place.area}, ${place.city}`)
  }

  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Halal food</Text>
          <Text style={styles.headerSub}>{inDelhi ? `Sorted by distance from ${city}` : `Delhi kitchens · you are in ${city}`}</Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a kitchen or area"
          placeholderTextColor={muted}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {HALAL_CUISINES.map((item) => {
          const on = item === cuisine
          return (
            <Pressable key={item} onPress={() => setCuisine(item)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{item}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <Pressable
        onPress={() => showToast('Featured spots open for restaurants in this list', 'information-circle-outline')}
        style={styles.feature}>
        <View style={styles.featureBadge}>
          <Text style={styles.featureBadgeText}>FEATURED</Text>
        </View>
        <Text style={styles.featureTitle}>Your kitchen, at the top</Text>
        <Text style={styles.featureSub}>A paid spot above this list, seen by everyone nearby.</Text>
        <Text style={styles.featureLink}>Ask for this spot</Text>
      </Pressable>

      {savedPlaces.length ? (
        <>
          <Text style={styles.section}>Saved</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
            {savedPlaces.map((place) => (
              <Pressable key={place.id} onPress={() => openPlace(place)} style={styles.savedCard}>
                <Text style={styles.savedName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.savedArea} numberOfLines={1}>
                  {place.area}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.section}>{inDelhi ? 'Near you' : 'Delhi'}</Text>
      {ranked.map(({ place, km }) => {
        const loved = saved.includes(place.id)
        return (
          <View key={place.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardCopy}>
                <Text style={styles.name}>{place.name}</Text>
                <Text style={styles.meta}>
                  {place.cuisine} · {place.area}
                </Text>
                <Text style={styles.known}>{place.knownFor}</Text>
              </View>
              <Pressable
                onPress={() => toggleSaved(place)}
                hitSlop={8}
                accessibilityLabel={loved ? `Unsave ${place.name}` : `Save ${place.name}`}>
                <Ionicons name={loved ? 'heart' : 'heart-outline'} size={20} color={loved ? '#C2321F' : muted} />
              </Pressable>
            </View>
            <View style={styles.cardFoot}>
              <Text style={styles.distance}>{formatKm(km)}</Text>
              <Pressable onPress={() => openPlace(place)} style={styles.go}>
                <Text style={styles.goText}>Directions</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )
      })}
      {!ranked.length ? <Text style={styles.empty}>Nothing matches that search.</Text> : null}

      <Pressable
        onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`halal restaurant near ${city}`)}`)}
        style={styles.maps}>
        <Ionicons name="map-outline" size={16} color={ink} />
        <Text style={styles.mapsText}>Search halal near {city} on Maps</Text>
      </Pressable>
      <Text style={styles.footnote}>
        These are known Delhi kitchens. Pins are approximate, so confirm the place in Maps. No ratings are shown, because none were verified.
      </Text>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const card = dark ? '#122027' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const chip = dark ? '#1C3330' : '#F3F1EC'
  return {
    page: { flex: 1, backgroundColor: dark ? '#0C1818' : '#F6F4F0' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: card },
    headerCopy: { flex: 1, minWidth: 0 },
    headerTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 26, color: ink, letterSpacing: -0.3 },
    headerSub: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: muted, marginTop: 1 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 16,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
    },
    searchInput: { flex: 1, fontFamily: 'Figtree_500Medium', fontSize: 14, color: ink, padding: 0 },
    chips: { gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: chip },
    chipOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    chipText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    chipTextOn: { color: dark ? '#0F1F2E' : '#FFFFFF' },
    feature: {
      marginHorizontal: 12,
      padding: 16,
      borderRadius: 22,
      backgroundColor: dark ? '#241C12' : '#1C140C',
    },
    featureBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(231,211,161,0.18)',
    },
    featureBadgeText: { fontFamily: 'Figtree_800ExtraBold', fontSize: 10, letterSpacing: 0.8, color: '#E7D3A1' },
    featureTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, color: '#F7F1E6', marginTop: 8 },
    featureSub: { fontFamily: 'Figtree_500Medium', fontSize: 13, lineHeight: 18, color: '#CDBFA6', marginTop: 4 },
    featureLink: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: '#E7D3A1', marginTop: 10 },
    section: {
      marginTop: 16,
      marginBottom: 8,
      marginHorizontal: 16,
      fontFamily: 'Figtree_700Bold',
      fontSize: 12,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: muted,
    },
    savedRow: { gap: 8, paddingHorizontal: 12 },
    savedCard: { width: 150, padding: 12, borderRadius: 16, backgroundColor: card, borderWidth: 1, borderColor: line },
    savedName: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: ink },
    savedArea: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: muted, marginTop: 2 },
    card: { marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: 20, backgroundColor: card, borderWidth: 1, borderColor: line },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardCopy: { flex: 1, minWidth: 0 },
    name: { fontFamily: 'Figtree_700Bold', fontSize: 16, color: ink },
    meta: { fontFamily: 'Figtree_500Medium', fontSize: 12.5, color: muted, marginTop: 2 },
    known: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: ink, marginTop: 6 },
    cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    distance: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: ink },
    go: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: dark ? '#EAF3F0' : '#0F1F2E',
    },
    goText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: dark ? '#0F1F2E' : '#FFFFFF' },
    empty: { fontFamily: 'Figtree_500Medium', fontSize: 14, color: muted, textAlign: 'center', marginTop: 20 },
    maps: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginTop: 8,
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: card,
    },
    mapsText: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: ink },
    footnote: { fontFamily: 'Figtree_500Medium', fontSize: 12, lineHeight: 17, color: muted, marginHorizontal: 16, marginTop: 12 },
  }
})
