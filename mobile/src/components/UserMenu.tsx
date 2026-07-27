import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { colors } from '@/src/constants/theme'
import { userInitials } from '@/src/components/UserMenu.utils'

export { userInitials } from '@/src/components/UserMenu.utils'

export function UserMenu({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const router = useRouter()
  const { user, isGuest, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const dark = tone === 'dark'

  const close = () => setOpen(false)

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
        style={[styles.trigger, dark && styles.triggerDark, open && (dark ? styles.triggerDarkOpen : styles.triggerOpen)]}
        onPress={() => setOpen(true)}
        accessibilityLabel={user ? 'Account menu' : 'Sign in'}
        accessibilityRole="button">
        {user ? (
          <Text style={[styles.initials, dark && styles.initialsDark]}>
            {userInitials(user.name, user.email)}
          </Text>
        ) : (
          <Text style={styles.icon}>👤</Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={[styles.backdrop, dark && styles.backdropLeft]} onPress={close}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            {user ? (
              <>
                <View style={styles.profile}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{userInitials(user.name, user.email)}</Text>
                  </View>
                  <Text style={styles.name}>{user.name}</Text>
                  <Text style={styles.email}>{user.email}</Text>
                </View>
                <Pressable style={styles.dangerBtn} onPress={() => void onLogout()}>
                  <Text style={styles.dangerBtnText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.guest}>
                  <Text style={styles.guestTitle}>
                    {isGuest ? 'Browsing as guest' : 'Welcome to PrayNow'}
                  </Text>
                  <Text style={styles.guestSub}>
                    {isGuest ? 'Sign in to save preferences' : 'Sign in to your account'}
                  </Text>
                </View>
                <Pressable style={styles.primaryBtn} onPress={onSignIn}>
                  <Text style={styles.primaryBtnText}>Sign in</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerOpen: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: '#fff',
  },
  triggerDark: {
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  triggerDarkOpen: {
    backgroundColor: colors.surface2,
    borderColor: colors.textPrimary,
  },
  icon: { fontSize: 16 },
  initials: { fontSize: 11, fontWeight: '800', color: '#fff' },
  initialsDark: { color: colors.textPrimary },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  backdropLeft: {
    alignItems: 'flex-start',
    paddingRight: 0,
    paddingLeft: 16,
  },
  panel: {
    width: 240,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  profile: { padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  name: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  email: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  guest: { padding: 14, paddingBottom: 8, gap: 2 },
  guestTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  guestSub: { fontSize: 11, color: colors.textMuted },
  primaryBtn: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  dangerBtn: { padding: 14 },
  dangerBtnText: { fontSize: 13, fontWeight: '700', color: colors.accent, textAlign: 'center' },
})
