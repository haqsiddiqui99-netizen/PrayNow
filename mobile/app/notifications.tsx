import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PageHeader, pageBackground } from '@/src/components/PageHeader'
import { VoiceNotePlayer } from '@/src/components/VoiceNotePlayer'
import { useAuth } from '@/src/context/AuthContext'
import { useInbox } from '@/src/context/InboxContext'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import type { TranslationKey } from '@/src/i18n/translations'
import type { AppNotification } from '@/src/services/api'
import { isAppAdmin, isMosqueAdmin } from '@/src/utils/roles'

const TYPE_LABEL: Record<AppNotification['type'], TranslationKey> = {
  announcement: 'inbox.typeAnnouncement',
  azan_alert: 'inbox.typeAzan',
  facilities: 'inbox.typeFacilities',
  timings: 'inbox.typeTimings',
  correction: 'inbox.typeCorrection',
  janaza: 'inbox.typeJanaza',
}

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
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { notifications, loading, reload, markRead, markAllRead, unreadCount } = useInbox()

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  if (!user) {
    return (
      <View style={styles.page}>
        <PageHeader title={t('more.notifications')} topInset={insets.top} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{t('inbox.signInTitle')}</Text>
          <Pressable style={styles.btn} onPress={() => router.push('/login')}>
            <Text style={styles.btnText}>{t('inbox.signIn')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <PageHeader title={t('more.notifications')} topInset={insets.top} />
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
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
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
                if (item.type === 'correction' && isAppAdmin(user)) router.push('/admin/corrections')
                else if (item.type === 'correction' && isMosqueAdmin(user)) router.push('/(tabs)/my-mosque')
                else if (item.mosqueId) router.push(`/mosque/${item.mosqueId}`)
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
              <Text style={styles.type}>{t(TYPE_LABEL[item.type] ?? 'inbox.typeTimings')}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, mode }) => ({
  page: { flex: 1, backgroundColor: pageBackground(mode) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hint: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  markAll: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  list: { padding: 12 },
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
