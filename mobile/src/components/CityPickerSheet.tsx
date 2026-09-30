import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getSupportedCities, type SupportedCity } from '@/src/constants/cities'
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { SavedLocation } from '@/src/services/savedLocations'

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles()
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

function LocationRow({
  title,
  lines,
  active,
  icon,
  activeIcon,
  onPress,
  onDelete,
}: {
  title: string
  lines: string[]
  active: boolean
  icon: keyof typeof Ionicons.glyphMap
  activeIcon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
  onDelete?: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const glyph = active && activeIcon ? activeIcon : icon
  const iconColor = active ? colors.textPrimary : colors.textSecondary

  return (
    <Pressable
      style={({ pressed }) => [
        styles.locationRow,
        active && styles.locationRowActive,
        pressed && styles.locationRowPressed,
      ]}
      onPress={onPress}>
      <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
        <Ionicons name={glyph} size={15} color={iconColor} />
      </View>
      <View style={styles.locationTextWrap}>
        <View style={styles.locationTitleRow}>
          <Text style={[styles.locationTitle, active && styles.locationTitleActive]} numberOfLines={1}>
            {title}
          </Text>
          {active ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          ) : null}
        </View>
        {lines.map((line, i) => (
          <Text key={i} style={styles.locationSubtitle} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.rowActions}>
        {active ? <Ionicons name="checkmark-circle" size={18} color={colors.textPrimary} /> : null}
        {onDelete ? (
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
            onPress={onDelete}
            hitSlop={8}
            accessibilityLabel={`Remove ${title}`}>
            <Ionicons name="trash-outline" size={16} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
}

export function CityPickerSheet({
  visible,
  selectedLocationId,
  selectedCityName,
  savedLocations,
  cities,
  onSelectCity,
  onSelectSavedLocation,
  onRemoveSavedLocation,
  onSearchAddress,
  onUseCurrentLocation,
  onClose,
  searching = false,
}: {
  visible: boolean
  selectedLocationId?: string | null
  selectedCityName?: string | null
  savedLocations: SavedLocation[]
  cities?: SupportedCity[]
  onSelectCity: (city: SupportedCity) => Promise<void>
  onSelectSavedLocation: (location: SavedLocation) => Promise<void>
  onRemoveSavedLocation: (id: string) => Promise<void>
  onSearchAddress: (query: string) => Promise<boolean>
  onUseCurrentLocation: () => Promise<boolean>
  onClose: () => void
  searching?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const { user, isGuest } = useAuth()
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setError('')
    }
  }, [visible])

  const allCities = useMemo(() => {
    const list = cities?.length ? cities : getSupportedCities()
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [cities])

  const filteredCities = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return allCities
    const digits = needle.replace(/\D/g, '')
    return allCities.filter(
      (city) =>
        city.name.toLowerCase().includes(needle) ||
        city.country.toLowerCase().includes(needle) ||
        city.aliases.some((alias) => alias.includes(needle)) ||
        (digits.length >= 3 &&
          ((city.pinCodes || []).some((p) => p.includes(digits) || digits.startsWith(p.slice(0, digits.length))) ||
            (city.pinPrefixes || []).some((p) => digits.startsWith(p) || p.startsWith(digits)))),
    )
  }, [allCities, query])

  const filteredSaved = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return savedLocations
    return savedLocations.filter(
      (item) =>
        item.city.toLowerCase().includes(needle) ||
        item.region.toLowerCase().includes(needle) ||
        item.label.toLowerCase().includes(needle) ||
        item.country.toLowerCase().includes(needle),
    )
  }, [query, savedLocations])

  const submitSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setError('')
    const ok = await onSearchAddress(trimmed)
    if (ok) {
      onClose()
    } else {
      setError('Location not found. Try a supported city name or pin code.')
    }
  }

  const handleCurrentLocation = async () => {
    setError('')
    const ok = await onUseCurrentLocation()
    if (ok) {
      onClose()
    } else {
      setError('Could not detect location. Enable GPS and allow location permission.')
    }
  }

  const selectedName = (selectedCityName || '').trim().toLowerCase()

  const recentEmptyHint =
    user && !isGuest
      ? 'Your recently used addresses will appear here.'
      : 'Sign in or pick a location to build your recent list.'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          <View style={styles.handle} />

          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator
            persistentScrollbar={Platform.OS === 'android'}
            indicatorStyle="black"
            scrollIndicatorInsets={{ right: 2 }}>
            <View style={styles.headerRow}>
              <Pressable
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                onPress={onClose}
                hitSlop={8}
                accessibilityLabel="Close">
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>Select Location</Text>
                <Text style={styles.headerSubtitle}>Choose where you pray today</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search city or pin code"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={(text) => {
                  setQuery(text)
                  if (error) setError('')
                }}
                returnKeyType="search"
                onSubmitEditing={() => void submitSearch()}
                editable={!searching}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={({ pressed }) => [styles.gpsRow, pressed && styles.gpsRowPressed]}
              onPress={() => void handleCurrentLocation()}
              disabled={searching}>
              <View style={styles.gpsIconWrap}>
                {searching ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Ionicons name="locate" size={16} color={colors.textPrimary} />
                )}
              </View>
              <View style={styles.gpsTextWrap}>
                <Text style={styles.gpsTitle}>Use my current location</Text>
                <Text style={styles.gpsSubtitle}>Detect via GPS</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <SectionHeader
              title="Recent address"
              subtitle={filteredSaved.length > 0 ? `${filteredSaved.length} saved` : undefined}
            />
            {filteredSaved.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No recent addresses</Text>
                <Text style={styles.emptyText}>{recentEmptyHint}</Text>
              </View>
            ) : (
              filteredSaved.map((item) => {
                const active = selectedLocationId === item.id
                return (
                  <LocationRow
                    key={item.id}
                    title={item.city}
                    lines={[item.label, `${item.region}, ${item.country}`]}
                    active={active}
                    icon="time-outline"
                    activeIcon="home"
                    onPress={() => {
                      void (async () => {
                        await onSelectSavedLocation(item)
                        onClose()
                      })()
                    }}
                    onDelete={() => {
                      void onRemoveSavedLocation(item.id)
                    }}
                  />
                )
              })
            )}

            <View style={styles.sectionDivider} />
            <SectionHeader title="Available Cities in India" />

            {filteredCities.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="map-outline" size={20} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching cities</Text>
                <Text style={styles.emptyText}>Try another name or pin code.</Text>
              </View>
            ) : (
              filteredCities.map((city) => {
                const active = selectedName === city.name.toLowerCase()
                const pinLine = city.pinCodes?.[0]
                  ? `${city.country} · PIN ${city.pinCodes[0]}${city.pinCodes.length > 1 ? '+' : ''}`
                  : city.country
                return (
                  <LocationRow
                    key={city.id}
                    title={city.name}
                    lines={[pinLine]}
                    active={active}
                    icon="location-outline"
                    activeIcon="home"
                    onPress={() => {
                      void (async () => {
                        await onSelectCity(city)
                        onClose()
                      })()
                    }}
                  />
                )
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '88%',
    ...shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  pageScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  pageContent: {
    gap: 6,
    paddingBottom: 12,
    paddingRight: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  backBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadows.soft,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  gpsRowPressed: {
    opacity: 0.88,
    backgroundColor: colors.border,
  },
  gpsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsTextWrap: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  gpsSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  sectionHeader: {
    marginTop: 2,
    marginBottom: 6,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 14,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.pageAccent,
    lineHeight: 16,
  },
  sectionSubtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 15,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface2,
    marginBottom: 4,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 240,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    marginBottom: 2,
    ...shadows.soft,
  },
  locationRowActive: {
    borderColor: colors.border,
    backgroundColor: colors.surface1,
  },
  locationRowPressed: {
    opacity: 0.9,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: colors.border,
  },
  locationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textPrimary,
    flexShrink: 1,
    lineHeight: 18,
  },
  locationTitleActive: {
    color: colors.textPrimary,
  },
  selectedBadge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  selectedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.success,
  },
  locationSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 14,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
  },
  deleteBtnPressed: {
    backgroundColor: '#fee2e2',
  },
}))
