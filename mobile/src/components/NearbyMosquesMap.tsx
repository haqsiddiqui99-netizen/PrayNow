import { Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { Mosque } from '@/src/types'

type Props = {
  mosques: Mosque[]
  userLat: number
  userLng: number
  selectedId?: string | null
  onSelectMosque: (mosque: Mosque) => void
  onOpenInGoogleMaps?: () => void
}

/** Web fallback — react-native-maps is native-only and cannot load in Metro web. */
export function NearbyMosquesMap({
  mosques,
  selectedId,
  onSelectMosque,
  onOpenInGoogleMaps,
}: Props) {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t, placeName } = useLanguage()
  const pinMosques = mosques.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="map-outline" size={18} color={paper.ink} />
        <Text style={styles.title}>{t('map.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('map.webHint')}</Text>

      {onOpenInGoogleMaps && pinMosques.length > 0 ? (
        <View style={styles.mapsWrap}>
          <GoogleMapsButton
            variant="chip"
            label={t('mosque.openInMaps')}
            onPress={onOpenInGoogleMaps}
          />
        </View>
      ) : null}

      {pinMosques.length === 0 ? (
        <Text style={styles.emptyText}>{t('map.empty')}</Text>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {pinMosques.map((m) => {
            const selected = m.id === selectedId
            return (
              <Pressable
                key={m.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => onSelectMosque(m)}>
                <Ionicons
                  name="location"
                  size={16}
                  color={selected ? paper.onInk : paper.muted}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.name, selected && styles.nameOn]} numberOfLines={1}>
                    {placeName(m.name)}
                  </Text>
                  <Text style={[styles.meta, selected && styles.metaOn]} numberOfLines={1}>
                    {placeName(m.area || m.address)}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
  wrap: {
    minHeight: 280,
    maxHeight: 360,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: paper.line,
    backgroundColor: paper.card,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: paper.ink,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: 'Figtree_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: paper.muted,
  },
  mapsWrap: { marginTop: 12, alignSelf: 'flex-start' },
  list: {
    marginTop: 12,
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: paper.chip,
    marginBottom: 8,
  },
  rowSelected: {
    backgroundColor: paper.ink,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 14,
    color: paper.ink,
  },
  nameOn: { color: paper.onInk },
  meta: {
    marginTop: 2,
    fontFamily: 'Figtree_500Medium',
    fontSize: 12,
    color: paper.muted,
  },
  metaOn: { color: paper.onInk },
  emptyText: {
    marginTop: 16,
    fontFamily: 'Figtree_500Medium',
    color: paper.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  }
})
