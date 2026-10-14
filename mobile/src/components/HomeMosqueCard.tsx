import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Alert, Image, Pressable, Text, View } from 'react-native'
import { LiveAzanButton } from '@/src/components/LiveAzanButton'
import { useRouter } from 'expo-router'
import { FacilitiesLine } from '@/src/components/FacilitiesLine'
import { MosqueNotifyToggle } from '@/src/components/MosqueNotifyToggle'
import { radius } from '@/src/constants/theme'
import { useLanguage } from '@/src/context/LanguageContext'
import { useMosqueNotify } from '@/src/context/MosqueNotifyContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLiveSession, useMosqueLive } from '@/src/hooks/useLiveAzanSession'
import type { Mosque, PrayerName, TravelMode } from '@/src/types'
import { getAzanState, subscribeAzan, toggleLiveAzan } from '@/src/utils/azanAudio'
import { openGoogleMaps } from '@/src/utils/maps'
import {
  getCurrentPrayerForMosques,
  getLivePrayerInfo,
  getMinutesUntilTime,
  isFriday,
  isMosqueAzanLive,
} from '@/src/utils/prayerSchedule'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const mapsPin = require('../../assets/images/google_maps_pin.png')

type Phase = 'before' | 'live' | 'after'

function clockParts(value: string) {
  const match = (value || '').trim().match(/^(.*?)\s*(AM|PM)$/i)
  if (!match) return { time: value || '—', mer: '' }
  return { time: match[1], mer: match[2].toUpperCase() }
}

function slotTimes(mosque: Mosque, name: PrayerName, now: Date) {
  const juma = name === 'Dhuhr' && isFriday(now)
  const slot = mosque.timings[name]
  return {
    azan: juma && mosque.jumaTimings?.khutba ? mosque.jumaTimings.khutba : slot?.azan || '—',
    jamat: juma && mosque.jumaTimings?.namaz ? mosque.jumaTimings.namaz : slot?.jamat || '—',
  }
}

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

export function HomeMosqueCard({
  mosque,
  travelMode,
}: {
  mosque: Mosque
  travelMode: TravelMode
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const { t, prayerName, formatDistance, formatDuration, placeName, digits } = useLanguage()
  const merLabel = (mer: string) => (mer === 'PM' ? t('time.pm') : mer === 'AM' ? t('time.am') : mer)
  const { isSubscribed, toggle } = useMosqueNotify()
  const now = useNow()
  const broadcast = useMosqueLive(mosque.id)
  const liveSession = useLiveSession(mosque.id)
  const listenerCount = liveSession?.listeners ?? 0
  const [playing, setPlaying] = useState(
    () => getAzanState().id === `${mosque.id}-live` && getAzanState().playing,
  )
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeAzan(() => setPlaying(getAzanState().id === `${mosque.id}-live` && getAzanState().playing)), [mosque.id])

  const current = getCurrentPrayerForMosques(now)
  const next = getLivePrayerInfo(now).next.name
  const focus: PrayerName = current?.name ?? next
  const { azan, jamat } = slotTimes(mosque, focus, now)
  const azanLive = Boolean(current && isMosqueAzanLive(mosque, current.name, now))
  const phase: Phase = broadcast || azanLive ? 'live' : current ? 'after' : 'before'
  const minsToAzan = getMinutesUntilTime(azan, now)
  const minsToJamat = getMinutesUntilTime(jamat, now)
  const subscribed = isSubscribed(mosque.id)
  const azanClock = clockParts(azan)
  const jamatClock = clockParts(jamat)

  const onNotify = async () => {
    const result = await toggle(mosque.id)
    if (result === 'need_login') {
      Alert.alert(t('mosque.signInTitle'), t('mosque.signInBody'), [
        { text: t('admin.cancel'), style: 'cancel' },
        { text: t('mosque.logIn'), onPress: () => router.push('/login') },
      ])
    }
  }

  const onLive = () => {
    void toggleLiveAzan(mosque.id, `${mosque.id}-live`).catch((error) => {
      Alert.alert(t('mosque.liveTitle'), error instanceof Error ? error.message : t('mosque.liveFail'))
    })
  }

  const status =
    phase === 'live'
      ? t('mosque.liveNow')
      : phase === 'after'
        ? t('mosque.namazAt', { time: jamat })
        : t('mosque.azanIn', { name: prayerName(focus), duration: formatDuration(minsToAzan) })

  const subtitle =
    phase === 'live'
      ? t('mosque.begun', { duration: formatDuration(minsToJamat) })
      : phase === 'after'
        ? minsToJamat > 0
          ? t('mosque.endedWait', { duration: formatDuration(minsToJamat) })
          : t('mosque.passed')
        : t('mosque.jamaatIn', { duration: formatDuration(minsToJamat) })

  return (
    <View>
      <View style={styles.head}>
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={2}>
            {placeName(mosque.name)}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, phase === 'live' && styles.dotLive, phase === 'before' && styles.dotSoon]} />
            <Text style={[styles.status, phase === 'live' && styles.statusLive, phase === 'before' && styles.statusSoon]} numberOfLines={1}>
              {status}
            </Text>
          </View>
        </View>
        <View style={styles.bell}>
          <Ionicons name="notifications-outline" size={16} color={subscribed ? '#1F7A68' : colors.textSecondary} />
          <MosqueNotifyToggle mosqueId={mosque.id} />
        </View>
      </View>

      <Pressable
        style={styles.route}
        onPress={(event) => {
          event.stopPropagation?.()
          void openGoogleMaps(mosque, travelMode)
        }}>
        <View style={styles.pin}>
          <Image source={mapsPin} style={styles.pinImage} resizeMode="contain" />
        </View>
        <View style={styles.routeText}>
          <Text style={styles.dist}>{formatDistance(mosque.distance)}</Text>
          <Text style={styles.addr} numberOfLines={2}>
            {placeName(mosque.address)}
          </Text>
        </View>
        <View style={styles.go}>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </View>
      </Pressable>

      <FacilitiesLine facilities={mosque.facilities} capacity={mosque.capacity} bare />

      <View style={styles.panel}>
        <View style={styles.panelTop}>
          <View style={styles.panelCopy}>
            <Text style={styles.prayer}>{prayerName(focus)}</Text>
            <Text style={styles.sub}>{subtitle}</Text>
          </View>
          <View style={[styles.badge, phase === 'live' && styles.badgeLive]}>
            {phase === 'live' ? <View style={styles.badgeDot} /> : null}
            <Text style={[styles.badgeText, phase === 'live' && styles.badgeTextLive]}>
              {phase === 'live' ? t('mosque.liveBadge') : phase === 'after' ? t('mosque.ended') : t('mosque.upcoming')}
            </Text>
          </View>
        </View>

        <View style={styles.ctaWrap}>
          <LiveAzanButton
            state={phase}
            isPlaying={playing}
            onPress={() => {
              if (phase === 'before') void onNotify()
              else if (phase === 'live') onLive()
            }}
            listeners={listenerCount}
            minutesToAzan={Math.max(0, minsToAzan)}
            azanTime={azan}
            prayerLabel={prayerName(focus)}
          />
        </View>

        <View style={styles.times}>
          <View style={[styles.tile, phase === 'live' && styles.tileLive, phase === 'before' && styles.tileSoon]}>
            <Text style={styles.tileLabel}>{phase === 'live' ? t('mosque.azanLive') : t('mosque.azan')}</Text>
            <Text style={styles.tileTime}>
              {digits(azanClock.time)}
              {azanClock.mer ? <Text style={styles.mer}> {merLabel(azanClock.mer)}</Text> : null}
            </Text>
          </View>
          <View style={[styles.tile, phase === 'after' && styles.tileSoon]}>
            <Text style={styles.tileLabel}>{t('mosque.namaz')}</Text>
            <Text style={styles.tileTime}>
              {digits(jamatClock.time)}
              {jamatClock.mer ? <Text style={styles.mer}> {merLabel(jamatClock.mer)}</Text> : null}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.more}
          onPress={(event) => {
            event.stopPropagation?.()
            setOpen((value) => !value)
          }}>
          <Text style={styles.moreText}>{open ? t('mosque.hidePrayers') : t('mosque.allToday')}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#4B6662" />
        </Pressable>
        {open
          ? PRAYERS.map((name) => {
              const times = slotTimes(mosque, name, now)
              const active = name === focus
              return (
                <View key={name} style={styles.row}>
                  <Text style={[styles.rowName, active && styles.rowOn]}>{prayerName(name)}</Text>
                  <Text style={[styles.rowTime, active && styles.rowOn]}>{digits(times.azan)}</Text>
                  <Text style={[styles.rowTime, active && styles.rowOn]}>{digits(times.jamat)}</Text>
                </View>
              )
            })
          : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, mode }) => {
  const chip = mode === 'dark' ? '#12302F' : '#EEF4F2'
  const ink = mode === 'dark' ? '#EAF3F0' : '#0E2A2A'
  const muted = mode === 'dark' ? '#9DBAB4' : '#4B6662'
  const panel = mode === 'dark' ? '#0F2B2A' : '#E1EEE9'
  return {
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    title: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '600',
      fontFamily: 'Poppins_500Medium',
      color: ink,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: muted },
    dotLive: { backgroundColor: '#FF5B4A' },
    dotSoon: { backgroundColor: '#1F7A68' },
    status: { flex: 1, fontSize: 13, fontWeight: '600', color: muted },
    statusLive: { color: '#D93A2B', fontWeight: '700' },
    statusSoon: { color: '#1F7A68' },
    bell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 10,
      paddingRight: 6,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: chip,
    },
    route: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
      padding: 12,
      borderRadius: 18,
      backgroundColor: chip,
    },
    pin: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface2,
      overflow: 'hidden',
    },
    pinImage: { width: 26, height: 26 },
    routeText: { flex: 1, minWidth: 0 },
    dist: { fontSize: 18, fontWeight: '700', color: ink },
    addr: { marginTop: 2, fontSize: 13, fontWeight: '500', color: colors.textSecondary, lineHeight: 17 },
    go: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1F7A68',
    },
    panel: {
      marginTop: 8,
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 8,
      borderRadius: 26,
      backgroundColor: panel,
    },
    panelTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    panelCopy: { flex: 1, minWidth: 0 },
    prayer: {
      fontSize: 32,
      fontWeight: '500',
      fontFamily: 'Poppins_500Medium',
      color: ink,
    },
    sub: { marginTop: 6, fontSize: 13, fontWeight: '500', color: muted, lineHeight: 18 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface2,
    },
    badgeLive: { backgroundColor: '#FF5B4A' },
    badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
    badgeText: { fontSize: 12, fontWeight: '700', color: muted },
    badgeTextLive: { color: '#fff', fontWeight: '800', letterSpacing: 0.4 },
    ctaWrap: { marginTop: 16 },
        times: { flexDirection: 'row', gap: 10, marginTop: 14 },
    tile: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: colors.surface2,
    },
    tileLive: { backgroundColor: '#FDE8E6' },
    tileSoon: { backgroundColor: '#F8EED6' },
    tileLabel: { fontSize: 12, fontWeight: '600', color: muted },
    tileTime: { marginTop: 4, fontSize: 22, fontWeight: '700', color: ink },
    mer: { fontSize: 13, fontWeight: '600', color: muted },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    moreText: { fontSize: 13, fontWeight: '600', color: muted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: 'rgba(14,42,42,0.08)',
    },
    rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: ink },
    rowTime: { width: 78, textAlign: 'right', fontSize: 13, color: muted },
    rowOn: { color: '#9A5B00', fontWeight: '700' },
  }
})
