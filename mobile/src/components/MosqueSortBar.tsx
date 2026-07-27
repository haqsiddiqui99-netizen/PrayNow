import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '@/src/constants/theme'
import { MOSQUE_SORT_OPTIONS, type MosqueSortMode } from '@/src/utils/mosqueSort'

export function MosqueSortBar({
  value,
  onChange,
  compact = false,
}: {
  value: MosqueSortMode
  onChange: (mode: MosqueSortMode) => void
  compact?: boolean
}) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact && <Text style={styles.label}>Sort by</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, compact && styles.rowCompact]}>
        {MOSQUE_SORT_OPTIONS.map(({ id, label, icon }) => {
          const active = value === id
          return (
            <Pressable
              key={id}
              style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
              onPress={() => onChange(id)}>
              <Ionicons
                name={icon}
                size={compact ? 11 : 14}
                color={active ? '#fff' : colors.textMuted}
              />
              <Text style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}>
                {compact ? label.split(' ')[0] : label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  wrapCompact: { marginTop: 0 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  row: { paddingHorizontal: 16, gap: 8 },
  rowCompact: { paddingHorizontal: 0, gap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextCompact: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
})
