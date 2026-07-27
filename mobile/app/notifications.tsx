import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { colors, radius } from '@/src/constants/theme'

function formatWhen(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { notifications, loading, reload, markRead, markAllRead, unreadCount } = useInbox()

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see messages</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/login')}>
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <Text style={styles.hint}>
          {unreadCount ? `${unreadCount} unread` : 'All caught up'}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {loading && !notifications.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => void reload()}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No messages yet. Turn on the notify switch on a mosque to get timing updates and announcements.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => {
                void markRead(item.id)
                if (item.mosqueId) router.push(`/mosque/${item.mosqueId}`)
              }}>
              <View style={styles.rowTop}>
                <Text style={styles.mosque} numberOfLines={1}>
                  {item.mosqueName || 'Mosque'}
                </Text>
                <Text style={styles.time}>{formatWhen(item.createdAt)}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {item.body ? (
                <Text style={styles.body} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              <Text style={styles.type}>
                {item.type === 'announcement' ? 'Announcement' : 'Timings update'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface2,
  },
  hint: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  markAll: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  list: { padding: 12, paddingBottom: 40 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, lineHeight: 20, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '800' },
  row: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rowUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  mosque: { flex: 1, fontWeight: '800', color: colors.primary, fontSize: 13 },
  time: { fontSize: 11, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  type: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})
