import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius } from '@/src/constants/theme'
import {
  MOSQUE_SECT_OPTIONS,
  MOSQUE_SORT_OPTIONS,
  type MosqueSectFilter,
  type MosqueSortMode,
} from '@/src/utils/mosqueSort'

export function MosqueFilterSheet({
  visible,
  sortMode,
  sectFilter,
  onChangeSort,
  onChangeSect,
  onClearAll,
  onClose,
}: {
  visible: boolean
  sortMode: MosqueSortMode
  sectFilter: MosqueSectFilter
  onChangeSort: (mode: MosqueSortMode) => void
  onChangeSect: (sect: MosqueSectFilter) => void
  onClearAll: () => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const hasActiveFilters = sortMode !== 'nearest' || sectFilter !== 'all'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Filter mosques</Text>
            {hasActiveFilters ? (
              <Pressable onPress={onClearAll} hitSlop={8}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <Text style={styles.sectionLabel}>Sort by</Text>
            <View style={styles.optionGrid}>
              {MOSQUE_SORT_OPTIONS.map(({ id, label, icon }) => {
                const active = sortMode === id
                return (
                  <Pressable
                    key={id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => onChangeSort(id)}>
                    <Text style={styles.optionIcon}>{icon}</Text>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>

            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.optionGrid}>
              {MOSQUE_SECT_OPTIONS.map(({ id, label }) => {
                const active = sectFilter === id
                return (
                  <Pressable
                    key={id}
                    style={[styles.optionChip, active && styles.optionChipActive]}
                    onPress={() => onChangeSect(id)}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hasActiveFilters ? (
              <Pressable style={styles.clearAllBtn} onPress={onClearAll}>
                <Text style={styles.clearAllBtnText}>Clear all filters</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.doneBtn, !hasActiveFilters && styles.doneBtnFull]} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, flex: 1 },
  clearAllText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  content: { paddingBottom: 8, gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  optionIcon: { fontSize: 12 },
  optionText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  optionTextActive: { color: '#fff' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 8 },
  clearAllBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearAllBtnText: { color: colors.textPrimary, fontWeight: '800', fontSize: 14 },
  doneBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnFull: { flex: 1 },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
