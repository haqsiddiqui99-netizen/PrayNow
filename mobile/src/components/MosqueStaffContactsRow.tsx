import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { Mosque, PersonContact } from '@/src/types'
import { getMosqueImams, getMosqueMoazzins } from '@/src/utils/mosqueStaff'

function StaffContactLine({ role, person }: { role: string; person: PersonContact | null }) {
  const styles = useStyles()
  const { colors } = useTheme()

  if (!person?.name) return null

  return (
    <View style={styles.line}>
      <Text style={styles.label} numberOfLines={1}>
        <Text style={styles.role}>{role} · </Text>
        <Text style={styles.name}>{person.name}</Text>
      </Text>
      {person.mobile ? (
        <Pressable
          style={styles.callBtn}
          onPress={() => void Linking.openURL(`tel:${person.mobile.replace(/\s/g, '')}`)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Call ${person.name}`}>
          <Ionicons name="call-outline" size={16} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.callBtn}>
          <Ionicons name="call-outline" size={16} color={colors.textMuted} />
        </View>
      )}
    </View>
  )
}

export function MosqueStaffContactsRow({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { t } = useLanguage()
  const imam = getMosqueImams(mosque)[0] ?? null
  const moazzin = getMosqueMoazzins(mosque)[0] ?? null

  if (!imam && !moazzin) return null

  return (
    <View style={styles.wrap}>
      <StaffContactLine role={t('mosque.imam')} person={imam} />
      {imam?.name && moazzin?.name ? <View style={styles.divider} /> : null}
      <StaffContactLine role={t('mosque.moazzin')} person={moazzin} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
  },
  label: { flex: 1, minWidth: 0 },
  role: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  name: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  callBtn: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
