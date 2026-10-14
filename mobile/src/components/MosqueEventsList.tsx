import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { showToast } from '@/src/components/AppToast'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useEventWhen, useMosqueEvents } from '@/src/hooks/useMosqueEvents'
import type { MosqueEvent } from '@/src/services/api'
import { EVENT_LEAD } from '@/src/services/mosqueEvents'
import type { Mosque } from '@/src/types'

const F = {
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const

const PREVIEW = 2

/** Classes and talks a mosque has announced, each with its own reminder bell. */
export function MosqueEventsList({ mosque }: { mosque: Mosque }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t, placeName } = useLanguage()
  const when = useEventWhen()
  const { upcoming, reminding, toggle } = useMosqueEvents(mosque.id)
  const [open, setOpen] = useState(false)
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'

  if (!upcoming.length) return null
  const shown = open ? upcoming : upcoming.slice(0, PREVIEW)

  const onBell = async (event: MosqueEvent) => {
    const { on, result } = await toggle(event, placeName(mosque.name))
    if (!on) showToast(t('mevent.off', { title: event.title }), 'notifications-off-outline')
    else if (result === 'denied') showToast(t('home.allowNotifications'), 'notifications-off-outline')
    else if (result === 'unsupported') showToast(t('reminder.phoneOnly'), 'phone-portrait-outline')
    else showToast(t('mevent.on', { lead: EVENT_LEAD }), 'alarm-outline')
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{t('mevent.title')}</Text>
      {shown.map(({ event, next }) => {
        const on = reminding(event.id)
        return (
          <View key={event.id} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={event.weekly ? 'repeat' : 'calendar-outline'} size={15} color={ink} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.when} numberOfLines={1}>
                {when(next)}
                {event.weekly ? ` · ${t('mevent.weekly')}` : ''}
              </Text>
              {event.details ? (
                <Text style={styles.details} numberOfLines={2}>
                  {event.details}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={(press) => {
                press.stopPropagation?.()
                void onBell(event)
              }}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t('mevent.a11y', { title: event.title })}
              style={[styles.bell, on && styles.bellOn]}>
              <Ionicons
                name={on ? 'notifications' : 'notifications-outline'}
                size={15}
                color={on ? (dark ? '#0F1F2E' : '#FFFFFF') : ink}
              />
            </Pressable>
          </View>
        )
      })}
      {upcoming.length > PREVIEW ? (
        <Pressable onPress={() => setOpen((value) => !value)} hitSlop={6} style={styles.more}>
          <Text style={styles.moreText}>
            {open ? t('mevent.less') : t('mevent.more', { n: upcoming.length - PREVIEW })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0F1F2E'
  const muted = dark ? '#9DBAB4' : '#5A6676'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const line = dark ? '#24343A' : '#E3E8EF'
  return {
    wrap: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: line, gap: 10 },
    kicker: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    copy: { flex: 1, minWidth: 0 },
    name: { fontFamily: F.bold, fontSize: 14, color: ink },
    when: { fontFamily: F.semi, fontSize: 12, color: muted, marginTop: 1 },
    details: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: muted, marginTop: 3 },
    bell: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: chip },
    bellOn: { backgroundColor: ink },
    more: { alignSelf: 'flex-start' },
    moreText: { fontFamily: F.bold, fontSize: 12.5, color: ink },
  }
})
