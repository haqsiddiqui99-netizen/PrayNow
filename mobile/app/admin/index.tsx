import { Redirect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { colors, radius } from '@/src/constants/theme'
import { isAppAdmin, isMosqueAdmin } from '@/src/utils/roles'

export default function AdminIndex() {
  const { user } = useAuth()
  const router = useRouter()

  if (isMosqueAdmin(user) && !isAppAdmin(user)) {
    return <Redirect href="/admin/my-mosques" />
  }

  if (!isAppAdmin(user)) {
    return <Redirect href="/(tabs)/more" />
  }

  const tiles = [
    { title: 'Mosques', desc: 'Add or edit any mosque', href: '/admin/mosques' as const },
    { title: 'Mosque Admins', desc: 'Create login & assign mosques', href: '/admin/managers' as const },
    { title: 'City Schedule', desc: 'Defaults, Tahajjud/Sehri & 365-day calendar', href: '/admin/city' as const },
    { title: 'Broadcast / My Mosques', desc: 'Start azan on any mosque', href: '/admin/my-mosques' as const },
  ]

  return (
    <View style={styles.page}>
      <Text style={styles.lead}>App owner controls. Mosque admins get mobile + password from here.</Text>
      {tiles.map((t) => (
        <Pressable key={t.href} style={styles.tile} onPress={() => router.push(t.href)}>
          <Text style={styles.tileTitle}>{t.title}</Text>
          <Text style={styles.tileDesc}>{t.desc}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
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
})
