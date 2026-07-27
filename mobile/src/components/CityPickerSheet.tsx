import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius } from '@/src/constants/theme'
import type { SavedLocation } from '@/src/services/savedLocations'

export function CityPickerSheet({
  visible,
  selectedLocationId,
  savedLocations,
  onSelectSavedLocation,
  onSearchAddress,
  onUseCurrentLocation,
  onClose,
  searching = false,
}: {
  visible: boolean
  selectedLocationId?: string | null
  savedLocations: SavedLocation[]
  onSelectSavedLocation: (location: SavedLocation) => Promise<void>
  onSearchAddress: (query: string) => Promise<boolean>
  onUseCurrentLocation: () => Promise<boolean>
  onClose: () => void
  searching?: boolean
}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setError('')
    }
  }, [visible])

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
      setError('Location not found. Try city name or pin code.')
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Pressable style={styles.backBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <Text style={styles.title}>Select Location</Text>
          </View>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
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
          </View>

          <View style={styles.actionCard}>
            <Pressable
              style={styles.actionRow}
              onPress={() => void handleCurrentLocation()}
              disabled={searching}>
              {searching ? (
                <ActivityIndicator size="small" color={colors.accent} style={styles.actionSpinner} />
              ) : (
                <Text style={styles.actionIconPrimary}>◎</Text>
              )}
              <Text style={styles.actionTextPrimary}>Use my current location</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.sectionLabel}>Saved address/city</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {filteredSaved.length === 0 ? (
              <Text style={styles.emptyText}>No saved locations yet.</Text>
            ) : (
              filteredSaved.map((item) => {
                const active = selectedLocationId === item.id
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.cityRow, active && styles.cityRowActive]}
                    onPress={() => {
                      void (async () => {
                        await onSelectSavedLocation(item)
                        onClose()
                      })()
                    }}>
                    <View style={styles.cityRowLeft}>
                      <Text style={styles.cityIcon}>{active ? '⌂' : '📍'}</Text>
                      <View style={styles.cityTextWrap}>
                        <View style={styles.cityTitleRow}>
                          <Text style={[styles.cityName, active && styles.cityNameActive]}>{item.city}</Text>
                          {active ? <Text style={styles.selectedBadge}>Selected</Text> : null}
                        </View>
                        <Text style={styles.cityCountry}>{item.label}</Text>
                        <Text style={styles.cityAddress}>{item.region}, {item.country}</Text>
                      </View>
                    </View>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                )
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, color: colors.textMuted, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  actionCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionSpinner: { width: 20 },
  actionIconPrimary: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  actionTextPrimary: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  errorText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: -4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 8,
  },
  list: { gap: 8, paddingBottom: 8 },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  cityRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cityRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  cityIcon: { fontSize: 16, marginTop: 2 },
  cityTextWrap: { flex: 1 },
  cityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cityName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cityNameActive: { color: colors.primary },
  selectedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    backgroundColor: colors.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cityCountry: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  cityAddress: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  check: { fontSize: 16, fontWeight: '800', color: colors.primary },
})
