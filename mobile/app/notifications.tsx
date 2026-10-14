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
import { VoiceNotePlayer } from '@/src/components/VoiceNotePlayer'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

function formatWhen(iso: string, locale: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(locale, {
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
  const styles = useStyles()
  const { t, language, digits } = useLanguage()
  const locale = language === 'hi' ? 'hi-IN' : language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar' : 'en-US'
  const { colors } = useTheme()
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
        <Text style={styles.emptyTitle}>{t('inbox.signInTitle')}</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/login')}>
          <Text style={styles.btnText}>{t('inbox.signIn')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <Text style={styles.hint}>
          {unreadCount ? t('inbox.unread', { count: unreadCount }) : t('inbox.caughtUp')}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={() => void markAllRead()}>
            <Text style={styles.markAll}>{t('inbox.markAll')}</Text>
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
              {t('inbox.empty')}
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
                  {item.mosqueName || t('inbox.mosque')}
                </Text>
                <Text style={styles.time}>{digits(formatWhen(item.createdAt, locale))}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              {item.body && !(item.voiceNotePath && item.body === 'Voice note') ? (
                <Text style={styles.body} numberOfLines={3}>
                  {item.body}
                </Text>
              ) : null}
              {item.voiceNotePath ? <VoiceNotePlayer source={item.voiceNotePath} /> : null}
              <Text style={styles.type}>
                {item.type === 'announcement'
                  ? 'Announcement'
                  : item.type === 'azan_alert'
                    ? 'Azan alert'
                    : item.type === 'facilities'
                      ? 'Facilities update'
                      : 'Timings update'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
}))
