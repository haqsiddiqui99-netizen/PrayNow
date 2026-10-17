import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { paperColors } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { FACILITY_FILTERS, renderFacilityIcon, type FacilityFilterId } from '@/src/utils/facilities'
import { MOSQUE_MADHAB_OPTIONS, type MosqueMadhabFilter } from '@/src/utils/mosqueSort'

export type FilterDropdownAnchor = {
  top: number
  right: number
}

const DROPDOWN_WIDTH = 260
const LIST_MAX_HEIGHT = 228

export function MosqueFilterSheet({
  visible,
  sectFilter,
  anchor,
  onChangeSect,
  facilities = [],
  onChangeFacilities,
  onClearAll,
  onClose,
}: {
  visible: boolean
  sectFilter: MosqueMadhabFilter
  anchor: FilterDropdownAnchor | null
  onChangeSect: (madhab: MosqueMadhabFilter) => void
  /** Leave out `onChangeFacilities` to hide the facility chips. */
  facilities?: FacilityFilterId[]
  onChangeFacilities?: (ids: FacilityFilterId[]) => void
  onClearAll: () => void
  onClose: () => void
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t } = useLanguage()
  const hasActiveFilters = sectFilter !== 'all' || facilities.length > 0

  const toggleFacility = (id: FacilityFilterId) => {
    if (!onChangeFacilities) return
    onChangeFacilities(facilities.includes(id) ? facilities.filter((x) => x !== id) : [...facilities, id])
  }

  const pick = (id: MosqueMadhabFilter) => {
    onChangeSect(id)
    onClose()
  }

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.dropdown,
            anchor
              ? { top: anchor.top, right: anchor.right, width: DROPDOWN_WIDTH }
              : styles.dropdownFallback,
          ]}
          onPress={() => {}}>
          {hasActiveFilters ? (
            <View style={styles.clearRow}>
              <Pressable onPress={onClearAll} hitSlop={8}>
                <Text style={styles.clearAllText}>{t('filter.clear')}</Text>
              </Pressable>
            </View>
          ) : null}

          {onChangeFacilities ? (
            <View style={styles.facilities}>
              <Text style={styles.groupLabel}>{t('filter.facilities')}</Text>
              <View style={styles.chips}>
                {FACILITY_FILTERS.map((f) => {
                  const on = facilities.includes(f.id)
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => toggleFacility(f.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}>
                      {renderFacilityIcon(f.icon, 13, on ? paper.onInk : paper.muted)}
                      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                        {t(f.label)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <Text style={styles.groupLabel}>{t('filter.madhab')}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            persistentScrollbar
            nestedScrollEnabled
            bounces={false}>
            {MOSQUE_MADHAB_OPTIONS.map(({ id, label, imam }, index) => {
              const active = sectFilter === id
              const last = index === MOSQUE_MADHAB_OPTIONS.length - 1
              return (
                <Pressable
                  key={id}
                  style={[styles.optionRow, !last && styles.optionRowBorder]}
                  onPress={() => pick(id)}>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                      {label}
                    </Text>
                    {imam ? (
                      <Text style={[styles.imamText, active && styles.imamTextActive]} numberOfLines={2}>
                        {imam}
                      </Text>
                    ) : null}
                  </View>
                  {active ? (
                    <Ionicons name="checkmark" size={15} color={paper.ink} />
                  ) : (
                    <View style={styles.optionSpacer} />
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ mode, shadows }) => {
  const paper = paperColors(mode)
  return {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: paper.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: paper.line,
    overflow: 'hidden',
    ...shadows.card,
  },
  dropdownFallback: {
    top: 120,
    right: 16,
    width: DROPDOWN_WIDTH,
  },
  clearRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  clearAllText: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 12,
    color: paper.ink,
  },
  facilities: { paddingHorizontal: 12, paddingTop: 8 },
  groupLabel: {
    fontFamily: 'Figtree_700Bold',
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: paper.muted,
    marginBottom: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: paper.chip,
  },
  chipOn: { backgroundColor: paper.ink },
  chipText: { fontFamily: 'Figtree_700Bold', fontSize: 12, color: paper.ink },
  chipTextOn: { color: paper.onInk },
  listScroll: {
    maxHeight: LIST_MAX_HEIGHT,
  },
  listContent: {
    paddingRight: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  optionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.line,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionText: {
    fontFamily: 'Figtree_600SemiBold',
    fontSize: 13,
    color: paper.ink,
  },
  optionTextActive: {
    fontFamily: 'Figtree_700Bold',
  },
  imamText: {
    fontFamily: 'Figtree_500Medium',
    fontSize: 11,
    color: paper.muted,
    lineHeight: 13,
  },
  imamTextActive: {
    color: paper.ink,
  },
  optionSpacer: {
    width: 15,
  },
  }
})
