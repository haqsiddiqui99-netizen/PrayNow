import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { userInitials } from '@/src/components/UserMenu.utils'
import { HEADER_CONTROL_HEIGHT } from '@/src/constants/layout'
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

export { userInitials } from '@/src/components/UserMenu.utils'

/**
 * Header account control. Sign-in lives here. Messages, appearance, and language
 * stay on the More page.
 */
export function UserMenu() {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { user, isGuest, logout } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  const close = () => {
    setOpen(false)
  }

  const onLogout = async () => {
    close()
    await logout()
    router.replace('/login')
  }

  const onSignIn = () => {
    close()
    router.replace('/login')
  }

  return (
    <>
      <Pressable
        style={[styles.trigger, open && styles.triggerOpen]}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('userMenu.account')}>
        <View style={styles.triggerAvatar}>
          {user ? (
            <Text style={styles.triggerInitials}>{userInitials(user.name, user.email)}</Text>
          ) : (
            <Ionicons name="person" size={13} color={colors.primary} />
          )}
        </View>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.profile}>
              <View style={styles.avatar}>
                {user ? (
                  <Text style={styles.avatarText}>{userInitials(user.name, user.email)}</Text>
                ) : (
                  <Ionicons name="person" size={17} color={colors.primary} />
                )}
              </View>
              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>
                  {user
                    ? user.name
                    : isGuest
                      ? t('userMenu.guestTitle')
                      : t('userMenu.welcome')}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {user
                    ? user.mobile || user.email
                    : isGuest
                      ? t('userMenu.guestSub')
                      : t('userMenu.welcomeSub')}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.authBtn, pressed && styles.rowPressed]}
              onPress={user ? () => void onLogout() : onSignIn}
              accessibilityRole="button">
              <Text style={[styles.authText, user && styles.authTextDanger]}>
                {user ? t('userMenu.signOut') : t('userMenu.signIn')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  trigger: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: HEADER_CONTROL_HEIGHT,
    paddingLeft: 3,
    paddingRight: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerOpen: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.pillBorder,
  },
  triggerAvatar: {
    width: HEADER_CONTROL_HEIGHT - 10,
    height: HEADER_CONTROL_HEIGHT - 10,
    borderRadius: (HEADER_CONTROL_HEIGHT - 10) / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerInitials: { fontSize: 10, fontWeight: '800', color: colors.primary },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: 16,
  },
  panel: {
    width: 268,
    maxWidth: '92%',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  profileText: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  rowPressed: { backgroundColor: colors.surface1 },
  authBtn: { paddingVertical: 13, alignItems: 'center' },
  authText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  authTextDanger: { color: colors.accent },
}))
