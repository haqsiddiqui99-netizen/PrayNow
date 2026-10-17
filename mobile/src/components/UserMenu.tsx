import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { userInitials } from '@/src/components/UserMenu.utils'
import { HEADER_CONTROL_HEIGHT } from '@/src/constants/layout'
import { paperColors, radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { deleteAccount } from '@/src/services/api'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

export { userInitials } from '@/src/components/UserMenu.utils'

/**
 * Header account control. Sign-in lives here. Messages, appearance, and language
 * stay on the More page.
 */
export function UserMenu() {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const router = useRouter()
  const { user, isGuest, logout } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setOpen(false)
    setDeleting(false)
    setPassword('')
    setDeleteError('')
  }

  const onDelete = async () => {
    setBusy(true)
    setDeleteError('')
    try {
      await deleteAccount(password)
      close()
      await logout()
      router.replace('/login')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('userMenu.deleteFailed'))
    } finally {
      setBusy(false)
    }
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
            <Ionicons name="person" size={13} color={paper.ink} />
          )}
        </View>
        <Ionicons name="chevron-down" size={13} color={paper.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.profile}>
              <View style={styles.avatar}>
                {user ? (
                  <Text style={styles.avatarText}>{userInitials(user.name, user.email)}</Text>
                ) : (
                  <Ionicons name="person" size={17} color={paper.ink} />
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

            {user && !deleting ? (
              <Pressable
                style={({ pressed }) => [styles.authBtn, pressed && styles.rowPressed]}
                onPress={() => setDeleting(true)}
                accessibilityRole="button">
                <Text style={styles.deleteText}>{t('userMenu.delete')}</Text>
              </Pressable>
            ) : null}
            {user && deleting ? (
              <View style={styles.deleteBox}>
                <Text style={styles.deleteHint}>{t('userMenu.deleteHint')}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('userMenu.deletePassword')}
                  placeholderTextColor={paper.muted}
                  style={styles.deleteInput}
                  editable={!busy}
                />
                {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.authBtn, pressed && styles.rowPressed]}
                  onPress={() => void onDelete()}
                  disabled={busy || password.length === 0}
                  accessibilityRole="button">
                  <Text style={styles.authTextDanger}>
                    {busy ? t('userMenu.deleteBusy') : t('userMenu.deleteConfirm')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.authBtn, pressed && styles.rowPressed]}
                  onPress={() => {
                    setDeleting(false)
                    setPassword('')
                    setDeleteError('')
                  }}
                  accessibilityRole="button">
                  <Text style={styles.authText}>{t('userMenu.deleteCancel')}</Text>
                </Pressable>
              </View>
            ) : null}
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

const useStyles = makeStyles(({ mode }) => {
  const paper = paperColors(mode)
  return {
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
    backgroundColor: paper.chip,
  },
  triggerOpen: {
    backgroundColor: paper.line,
  },
  triggerAvatar: {
    width: HEADER_CONTROL_HEIGHT - 10,
    height: HEADER_CONTROL_HEIGHT - 10,
    borderRadius: (HEADER_CONTROL_HEIGHT - 10) / 2,
    backgroundColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerInitials: { fontFamily: 'Figtree_700Bold', fontSize: 10, color: paper.onInk },
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
    backgroundColor: paper.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: paper.line,
    overflow: 'hidden',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: paper.line,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: paper.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.onInk },
  profileText: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'Figtree_700Bold', fontSize: 14, color: paper.ink },
  subtitle: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: paper.muted, marginTop: 2 },
  rowPressed: { backgroundColor: paper.chip },
  authBtn: { paddingVertical: 13, alignItems: 'center' },
  authText: { fontFamily: 'Figtree_700Bold', fontSize: 13, color: paper.ink },
  authTextDanger: { color: '#B3261E' },
  deleteText: { fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: paper.muted },
  deleteBox: { paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: paper.line },
  deleteHint: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: paper.muted, lineHeight: 17 },
  deleteInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: paper.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Figtree_500Medium',
    fontSize: 14,
    color: paper.ink,
  },
  deleteError: { fontFamily: 'Figtree_500Medium', fontSize: 12, color: '#B3261E', marginTop: 8 },
  }
})
