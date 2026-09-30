import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { Mosque, PersonContact } from '@/src/types'
import { getMosqueImams, getMosqueMoazzins } from '@/src/utils/mosqueStaff'

function StaffGroup({
  title,
  icon,
  people,
  showWhenEmpty = false,
}: {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  people: PersonContact[]
  showWhenEmpty?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const { t } = useLanguage()

  if (!people.length && !showWhenEmpty) return null

  if (!people.length) {
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.emptyHint}>{t('mosque.staffUnlisted')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {people.map((person, index) => (
        <View key={`${person.name}-${person.mobile}-${index}`} style={styles.personRow}>
          <View style={styles.personIcon}>
            <Ionicons name={icon} size={15} color={colors.pageAccent} />
          </View>
          <View style={styles.personBody}>
            <Text style={styles.personName}>{person.name}</Text>
            {person.mobile ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${person.mobile.replace(/\s/g, '')}`)}
                hitSlop={6}>
                <Text style={styles.personMobile}>{person.mobile}</Text>
              </Pressable>
            ) : (
              <Text style={styles.personMobileMuted}>{t('mosque.mobileUnlisted')}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

export function MosqueStaffSection({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { t } = useLanguage()
  const imams = getMosqueImams(mosque)
  const moazzins = getMosqueMoazzins(mosque)

  if (!imams.length && !moazzins.length) return null

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{t('mosque.staff')}</Text>
      <StaffGroup title={t('mosque.imam')} icon="person-outline" people={imams} showWhenEmpty />
      <View style={styles.groupDivider} />
      <StaffGroup
        title={t('mosque.moazzin')}
        icon="megaphone-outline"
        people={moazzins}
        showWhenEmpty
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.pageAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  personIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.pageAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  personName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  personMobile: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  personMobileMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
}))
