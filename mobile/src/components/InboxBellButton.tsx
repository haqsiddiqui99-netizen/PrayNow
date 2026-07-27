import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { colors } from '@/src/constants/theme'

/** Bell entry to Messages inbox with unread badge. */
export function InboxBellButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const router = useRouter()
  const { user } = useAuth()
  const { unreadCount } = useInbox()
  const dark = tone === 'dark'
  const badge = user ? unreadCount : 0

  return (
    <Pressable
      style={[styles.btn, dark && styles.btnDark]}
      onPress={() => router.push('/notifications')}
      accessibilityLabel={badge ? `Messages, ${badge} unread` : 'Messages'}
      hitSlop={8}>
      <Ionicons name="notifications-outline" size={22} color={dark ? '#fff' : colors.primary} />
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
})
