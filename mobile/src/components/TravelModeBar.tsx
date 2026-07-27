import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '@/src/constants/theme'
import type { TravelMode } from '@/src/types'
import { TRAVEL_MODES } from '@/src/utils/travelTime'

export function TravelModeBar({
  value,
  onChange,
  compact = false,
}: {
  value: TravelMode
  onChange: (mode: TravelMode) => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <View style={styles.compactBar}>
        {TRAVEL_MODES.map(({ mode, icon }) => {
          const active = value === mode
          return (
            <Pressable
              key={mode}
              style={[styles.compactChip, active && styles.compactChipActive]}
              onPress={() => onChange(mode)}
              hitSlop={4}>
              <Text style={styles.compactIcon}>{icon}</Text>
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View style={styles.bar}>
      {TRAVEL_MODES.map(({ mode, label, icon }) => {
        const active = value === mode
        return (
          <Pressable
            key={mode}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(mode)}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  compactBar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface0,
    borderRadius: radius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactChip: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactChipActive: { backgroundColor: colors.primary },
  compactIcon: { fontSize: 13 },
  bar: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  chipActive: { backgroundColor: colors.primary },
  icon: { fontSize: 14 },
  text: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  textActive: { color: '#fff' },
})
