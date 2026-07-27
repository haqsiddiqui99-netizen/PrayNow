import { StyleSheet, Text, View } from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '@/src/constants/theme'

const FACILITY_ICONS: Record<string, { lib: 'ion' | 'mci'; name: string }> = {
  'Wudu Area': { lib: 'mci', name: 'water' },
  Washroom: { lib: 'mci', name: 'toilet' },
  Parking: { lib: 'ion', name: 'car-outline' },
  WiFi: { lib: 'ion', name: 'wifi-outline' },
  'Wheelchair access': { lib: 'mci', name: 'wheelchair-accessibility' },
  'Women section': { lib: 'ion', name: 'people-outline' },
  Library: { lib: 'ion', name: 'library-outline' },
  AC: { lib: 'mci', name: 'air-conditioner' },
  'Historical site': { lib: 'mci', name: 'bank' },
}

function FacilityIcon({ facility }: { facility: string }) {
  const meta = FACILITY_ICONS[facility]
  if (!meta) {
    return <Ionicons name="checkmark-circle-outline" size={12} color={colors.primary} />
  }
  if (meta.lib === 'mci') {
    return <MaterialCommunityIcons name={meta.name as never} size={12} color={colors.primary} />
  }
  return <Ionicons name={meta.name as never} size={12} color={colors.primary} />
}

export function FacilitiesLine({ facilities, max = 3 }: { facilities: string[]; max?: number }) {
  if (!facilities.length) return null
  const shown = facilities.slice(0, max)
  const extra = facilities.length - shown.length
  return (
    <View style={styles.row}>
      {shown.map((f) => (
        <View key={f} style={styles.chip}>
          <FacilityIcon facility={f} />
          <Text style={styles.chipText}>{f}</Text>
        </View>
      ))}
      {extra > 0 && <Text style={styles.extra}>+{extra}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  extra: { fontSize: 10, color: colors.textMuted, alignSelf: 'center' },
})
