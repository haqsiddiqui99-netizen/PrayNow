import { Redirect, useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { radius } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'
import { isAppAdmin, isMosqueAdmin } from '@/src/utils/roles'

export default function AdminIndex() {
  const styles = useStyles()
  const { user } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  if (isMosqueAdmin(user) && !isAppAdmin(user)) {
    return <Redirect href="/admin/my-mosques" />
  }

  if (!isAppAdmin(user)) {
    return <Redirect href="/(tabs)/more" />
  }

  const tiles = [
    { title: t('owner.mosquesTile'), desc: t('owner.mosquesDesc'), href: '/admin/mosques' as const },
    { title: t('owner.requests'), desc: t('owner.requestsDesc'), href: '/admin/mosque-requests' as const },
    { title: t('correction.ownerTile'), desc: t('correction.ownerTileDesc'), href: '/admin/corrections' as const },
    { title: t('owner.admins'), desc: t('owner.adminsDesc'), href: '/admin/managers' as const },
    { title: t('owner.city'), desc: t('owner.cityDesc'), href: '/admin/city' as const },
    { title: t('owner.broadcast'), desc: t('owner.broadcastDesc'), href: '/admin/my-mosques' as const },
  ]

  return (
    <View style={styles.page}>
      <Text style={styles.lead}>{t('owner.lead')}</Text>
      {tiles.map((tile) => (
        <Pressable key={tile.href} style={styles.tile} onPress={() => router.push(tile.href)}>
          <Text style={styles.tileTitle}>{tile.title}</Text>
          <Text style={styles.tileDesc}>{tile.desc}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0, padding: 16 },
  lead: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
  tile: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  tileTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  tileDesc: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
}))
