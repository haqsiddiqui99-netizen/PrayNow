import { useRouter } from 'expo-router'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon } from '@/src/components/AppIcon'
import { ScreenHeader } from '@/src/components/AppHeader'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles } from '@/src/context/ThemeContext'
import type { AppIconName } from '@/src/constants/appIcons'
import { DAILY_VERSE } from '@/src/data/mockData'
import { formatHijriDate } from '@/src/utils/hijriDate'
import { canManageMosques, isAppAdmin, roleLabel } from '@/src/utils/roles'

type MenuItem = {
  label: string
  desc: string
  comingSoon?: boolean
  route?: string
  emoji?: string
  iconName?: AppIconName
  /** When set, only this role check may open the route. */
  require?: 'app_admin' | 'mosque_admin'
}

const DEMO_MOSQUE_ADMIN = '7777777777 / Khairul12345'
const DEMO_APP_ADMIN = '9999999999 / Admin@12345'

export default function MoreScreen() {
  const styles = useStyles()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { user, isGuest, logout } = useAuth()
  const { t } = useLanguage()

  const adminItems: MenuItem[] = [
    {
      route: '/admin/my-mosques',
      emoji: '🕌',
      label: 'Mosque Admin',
      desc: 'Start azan & update mosque timings',
      require: 'mosque_admin',
    },
    {
      route: '/admin',
      emoji: '🛡️',
      label: 'App Admin',
      desc: 'Mosques, mosque admins & city schedule',
      require: 'app_admin',
    },
  ]

  const menuItems: MenuItem[] = [
    {
      route: '/submit-mosque',
      emoji: '➕',
      label: 'Add a Mosque',
      desc: 'Request a missing mosque with photos & contact',
    },
    { route: '/notifications', emoji: '💬', label: 'Messages', desc: 'Mosque timing updates & announcements' },
    { route: '/(tabs)/live-azan', emoji: '🔊', label: 'Live Azan', desc: 'Hear azan from mosque broadcasts' },
    { route: '/(tabs)/qibla', iconName: 'compass', label: 'Qibla Direction', desc: 'Find direction to the Kaaba' },
    { route: '/(tabs)/hadith', iconName: 'hadees', label: 'Hadith', desc: 'Daily wisdom from the Sunnah' },
    { emoji: '📅', label: 'Islamic Calendar', desc: formatHijriDate(new Date()), comingSoon: true },
    { emoji: '🍽️', label: 'Halal Restaurants', desc: 'Find halal food nearby', comingSoon: true },
    { emoji: '✅', label: 'Prayer Tracker', desc: 'Track your daily prayers', comingSoon: true },
  ]

  const openAdminItem = (item: MenuItem) => {
    if (!item.route) return

    if (item.require === 'app_admin') {
      if (!isAppAdmin(user)) {
        Alert.alert(
          'App Admin sign-in required',
          `Sign out, then sign in with:\n${DEMO_APP_ADMIN}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Sign in',
              onPress: () => {
                void (async () => {
                  if (user || isGuest) await logout()
                  router.replace('/login')
                })()
              },
            },
          ],
        )
        return
      }
    }

    if (item.require === 'mosque_admin') {
      if (!canManageMosques(user)) {
        Alert.alert(
          'Mosque Admin sign-in required',
          `Sign out, then sign in with:\n${DEMO_MOSQUE_ADMIN}\n\n(App Admin ${DEMO_APP_ADMIN} also works.)`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Go to Sign in',
              onPress: () => {
                void (async () => {
                  if (user || isGuest) await logout()
                  router.replace('/login')
                })()
              },
            },
          ],
        )
        return
      }
    }

    router.push(item.route as never)
  }

  const renderMenuItem = (item: MenuItem) => (
    <Pressable
      key={item.label}
      style={styles.menuItem}
      disabled={item.comingSoon}
      onPress={() => {
        if (item.require) openAdminItem(item)
        else if (item.route) router.push(item.route as never)
      }}>
      {item.iconName ? (
        <AppIcon name={item.iconName} size={32} variant="menu" />
      ) : (
        <Text style={styles.menuIcon}>{item.emoji}</Text>
      )}
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Text style={styles.menuDesc}>
          {item.desc}
          {item.comingSoon ? ' — coming soon' : ''}
        </Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  )

  const onAccountAction = async () => {
    if (user) {
      await logout()
      router.replace('/login')
    } else {
      router.replace('/login')
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}>
      <ScreenHeader
        icon="more"
        title={t('screens.moreTitle')}
        subtitle={t('screens.moreSubtitle')}
        topInset={insets.top}
      />

      <View style={styles.content}>
        {/* Always first — visible for guests too (tap prompts sign-in) */}
        <Text style={styles.sectionLabel}>Admin</Text>
        {adminItems.map(renderMenuItem)}

        {(user || isGuest) && (
          <View style={styles.accountCard}>
            <Text style={styles.accountLabel}>Account</Text>
            <Text style={styles.accountName}>{user ? user.name : 'Guest user'}</Text>
            {user ? (
              <>
                <Text style={styles.accountEmail}>{user.mobile || user.email}</Text>
                <Text style={styles.roleBadge}>{roleLabel(user)}</Text>
                {canManageMosques(user) ? (
                  <Pressable
                    style={styles.accountBtn}
                    onPress={() =>
                      router.push(isAppAdmin(user) ? '/admin' : '/admin/my-mosques')
                    }>
                    <Text style={styles.accountBtnText}>
                      {isAppAdmin(user) ? 'Open App Admin' : 'Open Azan & Prayer Timings'}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Text style={styles.roleHint}>
                Guest can open Mosque Admin / App Admin above — you will be asked to sign in.
              </Text>
            )}
            <Pressable style={styles.accountBtn} onPress={() => void onAccountAction()}>
              <Text style={styles.accountBtnText}>{user ? 'Sign out' : 'Sign in'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.verseCard}>
          <Text style={styles.verseLabel}>Daily Verse</Text>
          <Text style={styles.verseArabic}>{DAILY_VERSE.arabic}</Text>
          <Text style={styles.verseTranslation}>"{DAILY_VERSE.translation}"</Text>
          <Text style={styles.verseRef}>— {DAILY_VERSE.reference}</Text>
        </View>

        <Text style={styles.sectionLabel}>More</Text>
        {menuItems.map(renderMenuItem)}

        <Text style={styles.version}>PrayNow React Native v1.0.1</Text>
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { padding: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  accountCard: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  accountLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  accountName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  accountEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roleBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
  },
  roleHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  accountBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface0,
    borderRadius: 8,
  },
  accountBtnText: { fontWeight: '700', color: colors.primary, fontSize: 13 },
  verseCard: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  verseLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  verseArabic: { fontSize: 18, textAlign: 'right', lineHeight: 28, marginBottom: 8 },
  verseTranslation: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  verseRef: { fontSize: 11, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 12,
  },
  menuIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontWeight: '700', fontSize: 14 },
  menuDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  menuArrow: { fontSize: 20, color: colors.textMuted },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 12 },
}))
