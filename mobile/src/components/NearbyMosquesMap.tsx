import { Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { radius } from '@/src/constants/theme'
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
  const { colors } = useTheme()
  const { t, placeName } = useLanguage()
  const pinMosques = mosques.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="map-outline" size={18} color={colors.primary} />
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
                  color={selected ? colors.primary : colors.textMuted}
                />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {placeName(m.name)}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
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

const useStyles = makeStyles(({ colors, shadows }) => ({
  wrap: {
    minHeight: 280,
    maxHeight: 360,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    padding: 14,
    ...shadows.soft,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    fontWeight: '500',
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
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface0,
    marginBottom: 8,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
}))
