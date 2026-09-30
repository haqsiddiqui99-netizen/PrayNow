import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '@/src/constants/theme'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { MOSQUE_MADHAB_OPTIONS, type MosqueMadhabFilter } from '@/src/utils/mosqueSort'

export type FilterDropdownAnchor = {
  top: number
  right: number
}

const DROPDOWN_WIDTH = 210
const LIST_MAX_HEIGHT = 228

export function MosqueFilterSheet({
  visible,
  sectFilter,
  anchor,
  onChangeSect,
  onClearAll,
  onClose,
}: {
  visible: boolean
  sectFilter: MosqueMadhabFilter
  anchor: FilterDropdownAnchor | null
  onChangeSect: (madhab: MosqueMadhabFilter) => void
  onClearAll: () => void
  onClose: () => void
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const hasActiveFilters = sectFilter !== 'all'

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
                <Text style={styles.clearAllText}>Clear</Text>
              </Pressable>
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
                    <Ionicons name="checkmark" size={15} color={colors.primary} />
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

const useStyles = makeStyles(({ colors, shadows }) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
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
    borderBottomColor: colors.border,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  imamText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 13,
  },
  imamTextActive: {
    color: colors.textSecondary,
  },
  optionSpacer: {
    width: 15,
  },
}))
