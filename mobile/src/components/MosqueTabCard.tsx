import { Ionicons } from '@expo/vector-icons'
import { showToast } from '@/src/components/AppToast'
import { GradientFill } from '@/src/components/GradientFill'
import { ScrollRevealRow } from '@/src/components/ScrollRevealRow'
import { memo, useCallback, useEffect, useState } from 'react'
import {
  Alert,
  LayoutAnimation,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { MosqueEventsList } from '@/src/components/MosqueEventsList'
import { MosqueReminderSheet } from '@/src/components/MosqueReminderSheet'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { hasActiveReminders, useMosqueNotify } from '@/src/context/MosqueNotifyContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLiveSession, useMosqueLive } from '@/src/hooks/useLiveAzanSession'
import type { Mosque, PrayerName, TravelMode } from '@/src/types'
import { getAzanState, subscribeAzan, toggleLiveAzan } from '@/src/utils/azanAudio'
import { renderFacilityIcon } from '@/src/utils/facilities'
import { getJumaSessions } from '@/src/utils/jumaTimings'
import { openGoogleMaps } from '@/src/utils/maps'
import {
  getCurrentPrayerForMosques,
  getLivePrayerInfo,
  isFriday,
  isMosqueAzanLive,
} from '@/src/utils/prayerSchedule'


const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const BC = {
  live: '#FF4D3D',
  amber: '#FFB020',
  pink: '#FF5CAA',
  aqua: '#35C6E8',
  mint: '#7DF0C6',
}

const WAVE_HEIGHTS = [8, 14, 22, 12, 18, 26, 10, 16, 7]

const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
  displayLight: 'Newsreader_500Medium',
} as const

const formatIN = (n: number): string => {
  const s = Math.round(n).toString()
  if (s.length <= 3) return s
  const last = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${rest},${last}`
}

const formatElapsed = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

function clockParts(value: string) {
  const match = (value || '').trim().match(/^(.*?)\s*(AM|PM)$/i)
  if (!match) return { time: value || '\u2014', mer: '' }
  return { time: match[1], mer: match[2].toUpperCase() }
}

function slotTimes(mosque: Mosque, name: PrayerName, now: Date) {
  const juma = name === 'Dhuhr' && isFriday(now)
  const slot = mosque.timings[name]
  return {
    azan: juma && mosque.jumaTimings?.khutba ? mosque.jumaTimings.khutba : slot?.azan || '\u2014',
    jamat: juma && mosque.jumaTimings?.namaz ? mosque.jumaTimings.namaz : slot?.jamat || '\u2014',
  }
}

function prayerIcon(name: PrayerName) {
  if (name === 'Fajr') return 'cloudy-night-outline' as const
  if (name === 'Dhuhr') return 'sunny-outline' as const
  if (name === 'Asr') return 'partly-sunny-outline' as const
  if (name === 'Maghrib') return 'moon-outline' as const
  return 'moon' as const
}

const WaveBar = memo(function WaveBar({
  base,
  index,
  active,
}: {
  base: number
  index: number
  active: boolean
}) {
  const h = useSharedValue(base)
  useEffect(() => {
    if (active) {
      const d = 450 + ((index * 83) % 350)
      h.value = withDelay(
        (index * 57) % 400,
        withRepeat(
          withSequence(
            withTiming(26, { duration: d, easing: Easing.inOut(Easing.quad) }),
            withTiming(5, { duration: d, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      )
    } else {
      cancelAnimation(h)
      h.value = withTiming(base, { duration: 200 })
    }
  }, [active, base, index, h])
  const style = useAnimatedStyle(() => ({ height: h.value }))
  return <Animated.View style={[btn.bar, style]} />
})

export const TabLiveButton = memo(function TabLiveButton({
  isLive,
  isPlaying,
  onPress,
  listeners = 0,
  azanTime = '',
  title: titleOverride,
  icon,
  actionLabel,
}: {
  isLive: boolean
  isPlaying: boolean
  onPress: () => void
  listeners?: number
  azanTime?: string
  title?: string
  icon?: 'play' | 'pause' | 'mic' | 'stop'
  actionLabel?: string
}) {
  const { t, digits } = useLanguage()
  const reduce = useReducedMotion()
  const playing = isPlaying
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [elapsed, setElapsed] = useState(0)
  const spin = useSharedValue(0)
  const sheenX = useSharedValue(-120)
  const pulse = useSharedValue(1)
  const ring = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(spin)
    spin.value = 0
    if (reduce) return
    spin.value = withRepeat(
      withTiming(360, { duration: playing ? 1600 : 3200, easing: Easing.linear }),
      -1,
      false,
    )
  }, [playing, reduce, spin])

  useEffect(() => {
    cancelAnimation(sheenX)
    sheenX.value = -120
    if (reduce || box.w <= 0) return
    sheenX.value = withRepeat(
      withSequence(
        withTiming(-120, { duration: 0 }),
        withDelay(2200, withTiming(box.w + 120, { duration: 1400, easing: Easing.inOut(Easing.quad) })),
      ),
      -1,
      false,
    )
  }, [reduce, box.w, sheenX])

  useEffect(() => {
    cancelAnimation(pulse)
    cancelAnimation(ring)
    pulse.value = 1
    ring.value = 0
    if (reduce) return
    if (playing) {
      ring.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false)
    } else {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    }
  }, [playing, reduce, pulse, ring])

  useEffect(() => {
    if (!playing) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [playing])

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheenX.value }, { skewX: '-20deg' }],
  }))
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - ring.value),
    transform: [{ scale: 1 + 0.5 * ring.value }],
  }))

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }))
  }, [])

  const handlePress = useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.()
      onPress()
    },
    [onPress],
  )

  const diag = Math.ceil(Math.hypot(box.w, box.h)) + 4
  const title = titleOverride ?? (playing ? t('live.listening') : t('live.listen'))
  const knobIcon = icon ?? (playing ? 'pause' : 'play')

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={actionLabel ?? (playing ? t('live.pause') : t('live.listenA11y'))}
      accessibilityState={{ selected: playing }}
      style={({ pressed }) => [btn.shadowWrap, pressed && { transform: [{ scale: 0.982 }] }]}>
      <View style={btn.pill} onLayout={onLayout}>
        {box.w > 0 && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  width: diag,
                  height: diag,
                  left: (box.w - diag) / 2,
                  top: (box.h - diag) / 2,
                },
                spinStyle,
              ]}>
              <GradientFill colors={[BC.live, BC.amber, BC.pink, BC.aqua, BC.live]} steps={140} />
            </Animated.View>
            {!reduce && (
              <Animated.View pointerEvents="none" style={[btn.sheen, sheenStyle]}>
                <GradientFill colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} steps={24} />
              </Animated.View>
            )}
          </>
        )}
        <View style={btn.row}>
          <View style={btn.knobSlot}>
            {playing && <Animated.View style={[btn.knobRing, ringStyle]} />}
            <Animated.View style={[btn.knob, knobStyle]}>
              <Ionicons
                name={knobIcon}
                size={24}
                color="#0C1D3B"
                style={knobIcon === 'play' ? { marginLeft: 2 } : undefined}
              />
            </Animated.View>
          </View>
          <View style={btn.textCol}>
            <Text numberOfLines={1} style={btn.title}>
              {title}
            </Text>
            <View style={btn.chip}>
              <Ionicons name="headset" size={14} color={BC.mint} />
              {playing && <Text style={btn.chipElapsed}>{digits(formatElapsed(elapsed))} ·</Text>}
              <Text style={btn.chipCount}>{digits(formatIN(listeners))}</Text>
              <Text style={btn.chipLabel}>{t('live.chip')}</Text>
            </View>
          </View>
          <View style={btn.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WAVE_HEIGHTS.map((h, i) => (
              <WaveBar key={i} base={h} index={i} active={playing && !reduce} />
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  )
})

const btn = StyleSheet.create({
  shadowWrap: {
    borderRadius: 999,
    shadowColor: BC.live,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  pill: {
    minHeight: 68,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#14305A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    gap: 12,
  },
  knobSlot: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 60 },
  knobRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textCol: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    fontFamily: F.bold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(9,20,44,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chipElapsed: { fontFamily: F.semi, color: '#FFD79A', fontSize: 12.5 },
  chipCount: { fontFamily: F.heavy, color: '#FFFFFF', fontSize: 13.5 },
  chipLabel: { fontFamily: F.semi, color: '#FFFFFF', fontSize: 12.5 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26 },
  bar: { width: 3.5, borderRadius: 2, backgroundColor: '#FF9A3D' },
})

function PulseDot({ color, active }: { color: string; active: boolean }) {
  const reduce = useReducedMotion()
  const o = useSharedValue(1)
  useEffect(() => {
    if (active && !reduce) {
      o.value = withRepeat(
        withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        false,
      )
    } else {
      cancelAnimation(o)
      o.value = 1
    }
  }, [active, reduce, o])
  const style = useAnimatedStyle(() => ({ opacity: o.value }))
  return <Animated.View style={[dotStyle, { backgroundColor: color }, style]} />
}

const dotStyle = { width: 8, height: 8, borderRadius: 4 }

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(timer)
  }, [ms])
  return now
}

export function MosqueTabCard({
  mosque,
  travelMode,
}: {
  mosque: Mosque
  travelMode: TravelMode
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const router = useRouter()
  const { t, prayerName, formatDistance, placeName, facilityName, digits } = useLanguage()
  const merLabel = (mer: string) => (mer === 'PM' ? t('time.pm') : mer === 'AM' ? t('time.am') : mer)
  const { user } = useAuth()
  const { isSubscribed, remindersFor } = useMosqueNotify()
  const [sheetOpen, setSheetOpen] = useState(false)
  const now = useNow()
  const broadcast = useMosqueLive(mosque.id)
  const listeners = useLiveSession(mosque.id)?.listeners ?? 0
  const [playing, setPlaying] = useState(
    () => getAzanState().id === `${mosque.id}-live` && getAzanState().playing,
  )
  const [showAll, setShowAll] = useState(false)
  const subscribed = isSubscribed(mosque.id)
  const savedReminders = remindersFor(mosque.id)
  const reminding = subscribed && hasActiveReminders(savedReminders)

  useEffect(
    () => subscribeAzan(() => setPlaying(getAzanState().id === `${mosque.id}-live` && getAzanState().playing)),
    [mosque.id],
  )

  const current = getCurrentPrayerForMosques(now)
  const next = getLivePrayerInfo(now).next.name
  const focus: PrayerName = current?.name ?? next
  const { azan, jamat } = slotTimes(mosque, focus, now)
  const isLive = broadcast || Boolean(current && isMosqueAzanLive(mosque, current.name, now))
  const azanClock = clockParts(azan)
  const jamatClock = clockParts(jamat)
  const azanLabel = [azanClock.time, azanClock.mer].filter(Boolean).join(' ')
  const jumaSessions = getJumaSessions(mosque.jumaTimings, mosque.timings?.Dhuhr?.azan || '').filter((session) =>
    [session.azan, session.khutba, session.namaz].some((value) => value?.trim()),
  )
  const facilities = Array.isArray(mosque.facilities)
    ? mosque.facilities.filter((name) => typeof name === 'string' && name.trim())
    : []
  const dark = mode === 'dark'
  const iconInk = dark ? '#EAF3F0' : '#0F1F2E'
  const liveText = dark ? '#FF8A7A' : '#D93A2B'
  const accent = iconInk
  const chipInk = dark ? '#8ED4C4' : '#1B5E52'
  const panelTop = dark ? '#16302C' : '#FBFBFC'
  const panelBottom = dark ? '#102421' : '#F2F3F6'
  const panelMuted = dark ? '#9DBAB4' : '#5A6676'

  const onOpenAlerts = (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.()
    if (!user) {
      Alert.alert(t('mosque.signInTitle'), t('mosque.signInBody'), [
        { text: t('mosque.cancel'), style: 'cancel' },
        { text: t('mosque.logIn'), onPress: () => router.push('/login') },
      ])
      return
    }
    setSheetOpen(true)
  }

  const onLive = () => {
    void toggleLiveAzan(mosque.id, `${mosque.id}-live`).catch((error) => {
      Alert.alert(t('mosque.liveTitle'), error instanceof Error ? error.message : t('mosque.liveFail'))
    })
  }

  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'))
    setShowAll((value) => !value)
  }

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {placeName(mosque.name)}
        </Text>
        <Pressable
          onPress={onOpenAlerts}
          accessibilityRole="button"
          accessibilityState={{ checked: subscribed }}
          accessibilityLabel={t('mosque.alertsFor', { name: placeName(mosque.name) })}
          hitSlop={6}
          style={[styles.bell, subscribed && styles.bellOn]}>
          <Ionicons
            name={reminding ? 'alarm' : subscribed ? 'notifications' : 'notifications-outline'}
            size={15}
            color={subscribed ? accent : chipInk}
          />
          <View style={[styles.sw, subscribed && styles.swOn]}>
            <View style={[styles.swKnob, subscribed && styles.swKnobOn]} />
          </View>
        </Pressable>
      </View>
      <MosqueReminderSheet
        mosque={mosque}
        travelMode={travelMode}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onFailed={() => showToast(t('mosque.updateFailBody'), 'cloud-offline-outline')}
      />

      <Pressable
        onPress={(event) => {
          event.stopPropagation?.()
          void openGoogleMaps(mosque, travelMode)
        }}
        accessibilityRole="link"
        accessibilityLabel={t('mosque.directionsAway', { distance: formatDistance(mosque.distance) })}
        style={({ pressed }) => [styles.route, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={styles.pin}>
          <Ionicons name="location-sharp" size={14} color="#EA4335" />
        </View>
        <Text style={styles.routeLine} numberOfLines={1}>
          <Text style={styles.dist}>{formatDistance(mosque.distance)}</Text>
          <Text style={styles.addr}>{`  ·  ${placeName(mosque.address)}`}</Text>
        </Text>
        <View style={styles.go}>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={styles.feats}>
        <ScrollRevealRow label="facilities">
          {mosque.capacity > 0 ? (
            <View style={styles.feat}>
              <Ionicons name="people-outline" size={14} color={chipInk} />
              <Text style={styles.featText}>{digits(formatIN(mosque.capacity))} {t('mosque.capacity')}</Text>
            </View>
          ) : null}
          {facilities.map((name) => (
            <View key={name} style={styles.feat}>
              {renderFacilityIcon(name, 14, chipInk)}
              <Text style={styles.featText}>{facilityName(name)}</Text>
            </View>
          ))}
          {!facilities.length && !(mosque.capacity > 0) ? (
            <View style={styles.feat}>
              <Ionicons name="information-circle-outline" size={14} color={panelMuted} />
              <Text style={[styles.featText, { color: panelMuted }]}>{t('mosque.facilitiesEmpty')}</Text>
            </View>
          ) : null}
        </ScrollRevealRow>
      </View>

      <MosqueEventsList mosque={mosque} />

      <View style={[styles.panel, { backgroundColor: panelBottom }]}>
        <GradientFill colors={[panelTop, panelBottom]} vertical />
        <View style={styles.pTop}>
          <View style={[styles.pIcon, isLive && styles.pIconLive]}>
            <Ionicons name={prayerIcon(focus)} size={18} color={isLive ? liveText : iconInk} />
          </View>
          <View style={styles.pTitle}>
            <Text style={styles.pName} numberOfLines={1}>
              {prayerName(focus)}
            </Text>
            {isLive ? (
              <View style={styles.badgeLive}>
                <PulseDot color="#FFFFFF" active />
                <Text style={styles.badgeLiveText}>LIVE</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.pTimes}>
            <View style={styles.pTime}>
              <Text style={[styles.pTimeLabel, isLive && { color: liveText }]}>{t('mosque.azan')}</Text>
              <Text style={[styles.pTimeValue, isLive && { color: liveText }]}>
                {digits(azanClock.time)}
                {azanClock.mer ? <Text style={styles.pMer}> {merLabel(azanClock.mer)}</Text> : null}
              </Text>
            </View>
            <View style={styles.pSplit} />
            <View style={styles.pTime}>
              <Text style={styles.pTimeLabel}>{t('mosque.namaz')}</Text>
              <Text style={styles.pTimeValue}>
                {digits(jamatClock.time)}
                {jamatClock.mer ? <Text style={styles.pMer}> {merLabel(jamatClock.mer)}</Text> : null}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.liveWrap}>
          <TabLiveButton
            isLive={isLive}
            isPlaying={playing}
            onPress={onLive}
            listeners={listeners}
            azanTime={azanLabel}
          />
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation?.()
            toggleAll()
          }}
          style={styles.more}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}>
          <Text style={styles.moreText}>{t('mosque.allToday')}</Text>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={panelMuted} />
        </Pressable>

        {showAll ? (
          <View style={styles.rowHead}>
            <Text style={styles.rowHeadName}>{t('mosque.prayer')}</Text>
            <Text style={styles.rowHeadTime}>{t('mosque.azan')}</Text>
            <Text style={styles.rowHeadTime}>{t('mosque.namaz')}</Text>
          </View>
        ) : null}
        {showAll
          ? PRAYERS.map((name) => {
              const times = slotTimes(mosque, name, now)
              const active = name === focus
              return (
                <View key={name} style={styles.row}>
                  <Text style={[styles.rowName, active && styles.rowNow]}>{prayerName(name)}</Text>
                  <Text style={[styles.rowTime, active && styles.rowNow]}>{digits(times.azan)}</Text>
                  <Text style={[styles.rowTime, active && styles.rowNow]}>{digits(times.jamat)}</Text>
                </View>
              )
            })
          : null}
        {showAll && jumaSessions.length > 0 ? (
          <>
            <View style={styles.fridayHead}>
              <Text style={styles.rowHeadName}>{t('admin.friday')}</Text>
              <Text style={styles.jumaHead}>{t('mosque.azan')}</Text>
              <Text style={styles.jumaHead}>{t('mosque.khutbah')}</Text>
              <Text style={styles.jumaHead}>{t('mosque.namaz')}</Text>
            </View>
            {jumaSessions.map((session, index) => (
              <View key={`juma-${index}`} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {jumaSessions.length > 1 ? `${prayerName('Juma')} ${digits(index + 1)}` : prayerName('Juma')}
                </Text>
                <Text style={styles.jumaTime} numberOfLines={1}>
                  {digits(session.azan.trim() || '\u2014')}
                </Text>
                <Text style={styles.jumaTime} numberOfLines={1}>
                  {digits(session.khutba.trim() || '\u2014')}
                </Text>
                <Text style={styles.jumaTime} numberOfLines={1}>
                  {digits(session.namaz.trim() || '\u2014')}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const ink = dark ? '#EAF3F0' : '#0E2A2A'
  const muted = dark ? '#9DBAB4' : '#5B7170'
  const chip = dark ? '#1C3330' : '#EEF1F6'
  const chipInk = dark ? '#8ED4C4' : '#1B5E52'
  const panelTop = dark ? '#16302C' : '#FBFBFC'
  const panelBottom = dark ? '#102421' : '#F2F3F6'
  const panelInk = dark ? '#EAF3F0' : '#0F1F2E'
  const panelMuted = dark ? '#9DBAB4' : '#5A6676'
  const tile = dark ? '#1A3330' : '#FFFFFF'
  const line = dark ? '#24343A' : '#E3E8EF'
  const tileLine = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.08)'
  return {
    card: {
      backgroundColor: dark ? '#122027' : '#FFFFFF',
      borderWidth: 1,
      borderColor: line,
      borderRadius: 28,
      overflow: 'hidden',
    },
    cardSelected: { borderColor: '#1F7A68', borderWidth: 1.5 },
    cardSelectedLive: { borderColor: '#FF4D3D', borderWidth: 1.5 },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 14,
      paddingHorizontal: 16,
    },
    name: {
      flex: 1,
      fontFamily: F.display,
      fontSize: 22,
      lineHeight: 26,
      color: ink,
      letterSpacing: -0.3,
    },
    bell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 3,
      paddingLeft: 7,
      paddingRight: 3,
      borderRadius: 999,
      backgroundColor: chip,
    },
    bellOn: { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,31,46,0.1)' },
    sw: {
      width: 32,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'rgba(91,113,112,0.35)',
      padding: 2,
    },
    swOn: { backgroundColor: dark ? '#EAF3F0' : '#0F1F2E' },
    swKnob: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#FFFFFF',
    },
    swKnobOn: { marginLeft: 14, backgroundColor: dark ? '#122027' : '#FFFFFF' },
    route: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginHorizontal: 12,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: 6,
      borderRadius: 14,
      backgroundColor: chip,
    },
    pin: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: tile,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    routeLine: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
    dist: { fontFamily: F.bold, fontSize: 13, color: ink },
    addr: { fontFamily: F.medium, fontSize: 13, color: muted },
    go: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: dark ? '#EAF3F0' : '#0F1F2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    feats: {
      paddingTop: 10,
      paddingBottom: 12,
    },
    feat: {
      flexDirection: 'row',
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 0,
      gap: 5,
      paddingVertical: 6,
      paddingLeft: 9,
      paddingRight: 11,
      borderRadius: 999,
      backgroundColor: chip,
    },
    featIcon: { color: chipInk },
    featText: { fontFamily: F.semi, fontSize: 12.5, color: chipInk },
    panelTop: { backgroundColor: panelTop },
    panelBottom: { backgroundColor: panelBottom },
    panel: {
      marginHorizontal: 10,
      marginBottom: 10,
      paddingTop: 14,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: tileLine,
      overflow: 'hidden',
    },
    pTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chip,
    },
    pIconLive: { backgroundColor: dark ? '#3A2422' : '#FDECEA' },
    pTitle: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4 },
    pName: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: panelInk, letterSpacing: -0.3 },
    pTimes: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
    pSplit: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: tileLine, marginVertical: 2 },
    pTime: { alignItems: 'flex-end' },
    pTimeLabel: {
      fontFamily: F.semi,
      fontSize: 10,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: panelMuted,
    },
    pTimeValue: { fontFamily: F.bold, fontSize: 15, lineHeight: 19, color: panelInk, marginTop: 1, letterSpacing: -0.2 },
    pMer: { fontFamily: F.semi, fontSize: 10, color: panelMuted },
    badgeLive: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingVertical: 2,
      paddingLeft: 7,
      paddingRight: 8,
      borderRadius: 999,
      backgroundColor: '#FF4D3D',
    },
    badgeLiveText: { fontFamily: F.heavy, fontSize: 10, color: '#FFFFFF', letterSpacing: 0.6 },
    liveWrap: { marginTop: 14 },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
      paddingVertical: 8,
    },
    moreText: { fontFamily: F.semi, fontSize: 13, color: panelMuted },
    rowHead: {
      flexDirection: 'row',
      paddingTop: 4,
      paddingBottom: 2,
      paddingHorizontal: 4,
    },
    rowHeadName: { flex: 1, fontFamily: F.semi, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: panelMuted },
    rowHeadTime: { width: 88, textAlign: 'right', fontFamily: F.semi, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: panelMuted },
    fridayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 10,
      paddingBottom: 2,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)',
    },
    jumaHead: { width: 72, textAlign: 'right', fontFamily: F.semi, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: panelMuted },
    jumaTime: { width: 72, textAlign: 'right', fontFamily: F.medium, fontSize: 12, color: panelMuted },
    row: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)',
    },
    rowName: { flex: 1, fontFamily: F.semi, fontSize: 14, color: panelInk },
    rowTime: { width: 88, textAlign: 'right', fontFamily: F.medium, fontSize: 14, color: panelMuted },
    rowNow: { color: '#9A5B00', fontFamily: F.bold },
  }
})
