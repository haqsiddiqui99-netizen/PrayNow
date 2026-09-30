import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeToggle } from '@/src/components/ThemeToggle'
import { userInitials } from '@/src/components/UserMenu.utils'
import { HEADER_CONTROL_HEIGHT } from '@/src/constants/layout'
import { radius } from '@/src/constants/theme'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { LANGUAGES } from '@/src/i18n/translations'

export { userInitials } from '@/src/components/UserMenu.utils'

/**
 * Header account control. It owns the app-wide switches that used to sit loose in
 * the header — messages, appearance and language — so the header itself carries
 * only the brand, the account and the city.
 */
export function UserMenu({ greetingName }: { greetingName?: string }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { user, isGuest, logout } = useAuth()
  const { unreadCount } = useInbox()
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)

  const displayName = greetingName ?? user?.name?.trim().split(/\s+/)[0] ?? t('common.guest')
  const activeLanguage = LANGUAGES.find((lang) => lang.code === language) ?? LANGUAGES[0]
  const unread = user ? unreadCount : 0

  const close = () => {
    setOpen(false)
    setLanguageOpen(false)
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

  const onMessages = () => {
    close()
    router.push('/notifications')
  }

  return (
    <>
      <Pressable
        style={[styles.trigger, open && styles.triggerOpen]}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0
            ? `${t('userMenu.account')}, ${t('userMenu.unread', { count: unread })}`
            : t('userMenu.account')
        }>
        <View style={styles.triggerAvatar}>
          {user ? (
            <Text style={styles.triggerInitials}>{userInitials(user.name, user.email)}</Text>
          ) : (
            <Ionicons name="person" size={13} color={colors.primary} />
          )}
        </View>
        <Text style={styles.triggerName} numberOfLines={1}>
          {displayName}
        </Text>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        {/* Keeps the unread count glanceable now that the bell lives in the menu. */}
        {unread > 0 ? (
          <View style={styles.triggerBadge}>
            <Text style={styles.triggerBadgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
          </View>
        ) : null}
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
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={onMessages}
              accessibilityRole="button">
              <Ionicons name="notifications-outline" size={17} color={colors.primary} />
              <Text style={styles.rowLabel}>{t('userMenu.messages')}</Text>
              {unread > 0 ? (
                <View style={styles.rowBadge}>
                  <Text style={styles.rowBadgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>

            <View style={styles.row}>
              <Ionicons name="contrast-outline" size={17} color={colors.primary} />
              <Text style={styles.rowLabel}>{t('theme.button')}</Text>
              <ThemeToggle />
            </View>

            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => setLanguageOpen((previous) => !previous)}
              accessibilityRole="button"
              accessibilityState={{ expanded: languageOpen }}>
              <Ionicons name="language-outline" size={17} color={colors.primary} />
              <Text style={styles.rowLabel}>{t('lang.button')}</Text>
              <Text style={styles.rowValue}>{activeLanguage.nativeLabel}</Text>
              <Ionicons
                name={languageOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.textMuted}
              />
            </Pressable>

            {languageOpen
              ? LANGUAGES.map((lang) => {
                  const selected = lang.code === language
                  return (
                    <Pressable
                      key={lang.code}
                      style={({ pressed }) => [
                        styles.languageRow,
                        selected && styles.languageRowSelected,
                        pressed && styles.rowPressed,
                      ]}
                      onPress={() => {
                        setLanguage(lang.code)
                        setLanguageOpen(false)
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}>
                      <Text
                        style={[styles.languageLabel, selected && styles.languageLabelSelected]}>
                        {lang.nativeLabel}
                      </Text>
                      {lang.nativeLabel !== lang.label ? (
                        <Text style={styles.languageSub}>{lang.label}</Text>
                      ) : null}
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  )
                })
              : null}

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
  triggerName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  triggerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
  /**
   * The appearance row holds a full-height control while the others hold only an
   * icon, so a shared height keeps every row on the same rhythm.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: HEADER_CONTROL_HEIGHT + 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surface1 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  rowValue: { fontSize: 12, fontWeight: '700', color: colors.primary },
  rowBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 41,
    paddingRight: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  languageRowSelected: { backgroundColor: colors.primarySoft },
  languageLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  languageLabelSelected: { color: colors.primary },
  languageSub: { flex: 1, fontSize: 11, color: colors.textMuted },
  authBtn: { paddingVertical: 13, alignItems: 'center' },
  authText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  authTextDanger: { color: colors.accent },
}))
