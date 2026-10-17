import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CityUnavailableBanner } from '@/src/components/CityUnavailableBanner'
import { GradientFill } from '@/src/components/GradientFill'
import { UserMenu } from '@/src/components/UserMenu'
import { CITY_RADIUS_KM, MOSQUE_RADIUS_STOPS, type MosqueRadiusKm } from '@/src/constants/mosqueRadius'
import { paperColors } from '@/src/constants/theme'
import { useMosqueNotify } from '@/src/context/MosqueNotifyContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { getLiveSession, isMosqueLive, subscribeLiveSessions } from '@/src/store/liveAzanSessions'
import type { Mosque, PrayerName } from '@/src/types'
import { getAzanState, subscribeAzan, toggleLiveAzan } from '@/src/utils/azanAudio'
import {
  formatMinutesAsTime,
  getCurrentPrayerForMosques,
  isFriday,
  isMosqueAzanLive,
  parseTime,
} from '@/src/utils/prayerSchedule'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
const RAINBOW = ['#FF4D3D', '#FFB020', '#FF5CAA', '#35C6E8', '#FF4D3D'] as const
const WAVE = [8, 14, 22, 12, 18, 24, 10, 16, 7]

const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
} as const

function formatCount(n: number): string {
  const s = String(Math.round(n))
  if (s.length <= 3) return s
  return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`
}

function clockText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function slotTimes(mosque: Mosque, name: PrayerName, now: Date) {
  const juma = name === 'Dhuhr' && isFriday(now)
  const slot = mosque.timings[name]
  return {
    azan: juma && mosque.jumaTimings?.khutba ? mosque.jumaTimings.khutba : slot?.azan || '',
    jamat: juma && mosque.jumaTimings?.namaz ? mosque.jumaTimings.namaz : slot?.jamat || '',
  }
}

function safeMinutes(value: string): number {
  if (!value?.trim()) return 0
  const minutes = parseTime(value)
  return Number.isFinite(minutes) ? minutes : 0
}

function nextAzan(mosque: Mosque, now: Date) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  for (const name of PRAYERS) {
    const azanMin = safeMinutes(slotTimes(mosque, name, now).azan)
    if (azanMin > nowMin) return { prayer: name, azanMin, wait: azanMin - nowMin }
  }
  const fajr = safeMinutes(slotTimes(mosque, 'Fajr', now).azan)
  return { prayer: 'Fajr' as PrayerName, azanMin: fajr, wait: 1440 - nowMin + fajr }
}

function focusSlot(mosque: Mosque, now: Date) {
  const current = getCurrentPrayerForMosques(now)
  const upcoming = nextAzan(mosque, now)
  const name = current?.name ?? upcoming.prayer
  const times = slotTimes(mosque, name, now)
  return {
    name,
    azanMin: safeMinutes(times.azan),
    jamatMin: safeMinutes(times.jamat),
    azanLabel: times.azan,
    jamatLabel: times.jamat,
  }
}

function mosqueOnAir(mosque: Mosque, now: Date) {
  if (isMosqueLive(mosque.id)) return true
  const current = getCurrentPrayerForMosques(now)
  return Boolean(current && isMosqueAzanLive(mosque, current.name, now))
}

const BlinkDot = memo(function BlinkDot({ color, size = 7 }: { color: string; size?: number }) {
  const reduce = useReducedMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (reduce) return
    opacity.value = withRepeat(
      withSequence(withTiming(0.25, { duration: 550 }), withTiming(1, { duration: 550 })),
      -1,
      false,
    )
    return () => cancelAnimation(opacity)
  }, [reduce, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />
})

const Ripple = memo(function Ripple({ delay }: { delay: number }) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false),
    )
    return () => cancelAnimation(progress)
  }, [delay, reduce, progress])
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 0.6 + 1.3 * progress.value }],
  }))
  return <Animated.View pointerEvents="none" style={[air.ripple, style]} />
})

const OnAir = memo(function OnAir({ active }: { active: boolean }) {
  return (
    <View style={air.wrap}>
      {active ? (
        <>
          <Ripple delay={0} />
          <Ripple delay={1100} />
        </>
      ) : null}
      <View style={air.badge}>
        <GradientFill colors={active ? ['#FF7A5C', '#FF4D3D'] : ['#B8C2CF', '#9AA5B3']} />
        <Ionicons name="radio" size={22} color="#FFFFFF" />
      </View>
    </View>
  )
})

const WaveBar = memo(function WaveBar({ base, index, active }: { base: number; index: number; active: boolean }) {
  const height = useSharedValue(base)
  useEffect(() => {
    if (active) {
      const duration = 450 + ((index * 83) % 350)
      height.value = withDelay(
        (index * 57) % 400,
        withRepeat(
          withSequence(
            withTiming(24, { duration, easing: Easing.inOut(Easing.quad) }),
            withTiming(5, { duration, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      )
    } else {
      cancelAnimation(height)
      height.value = withTiming(base, { duration: 200 })
    }
    return () => cancelAnimation(height)
  }, [active, base, index, height])
  const style = useAnimatedStyle(() => ({ height: height.value }))
  return <Animated.View style={[btn.bar, style]} />
})

const ListenButton = memo(function ListenButton({
  playing,
  listeners,
  elapsed,
  azanLabel,
  label,
  onPress,
}: {
  playing: boolean
  listeners: number
  elapsed: number
  azanLabel: string
  label: string
  onPress: () => void
}) {
  const { t, digits, formatClock } = useLanguage()
  const reduce = useReducedMotion()
  const [box, setBox] = useState({ w: 0, h: 0 })
  const spin = useSharedValue(0)
  const sheen = useSharedValue(-120)
  const pulse = useSharedValue(1)
  const ring = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(spin)
    spin.value = 0
    if (!reduce) spin.value = withRepeat(withTiming(360, { duration: playing ? 1600 : 3200, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(spin)
  }, [playing, reduce, spin])

  useEffect(() => {
    cancelAnimation(sheen)
    sheen.value = -120
    if (!reduce && box.w > 0) {
      sheen.value = withRepeat(
        withSequence(
          withTiming(-120, { duration: 0 }),
          withDelay(2200, withTiming(box.w + 120, { duration: 1400, easing: Easing.inOut(Easing.quad) })),
        ),
        -1,
        false,
      )
    }
    return () => cancelAnimation(sheen)
  }, [box.w, reduce, sheen])

  useEffect(() => {
    cancelAnimation(pulse)
    cancelAnimation(ring)
    pulse.value = 1
    ring.value = 0
    if (reduce) return
    if (playing) ring.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false)
    else pulse.value = withRepeat(withSequence(withTiming(1.06, { duration: 1200 }), withTiming(1, { duration: 1200 })), -1, false)
    return () => {
      cancelAnimation(pulse)
      cancelAnimation(ring)
    }
  }, [playing, reduce, pulse, ring])

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))
  const sheenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sheen.value }, { skewX: '-20deg' }] }))
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - ring.value), transform: [{ scale: 1 + 0.5 * ring.value }] }))
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setBox((current) => (current.w === width && current.h === height ? current : { w: width, h: height }))
  }
  const diag = Math.ceil(Math.hypot(box.w, box.h)) + 4
  const knownListeners = listeners > 0

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: playing }}
      style={({ pressed }) => [btn.shadow, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={btn.pill} onLayout={onLayout}>
        {box.w > 0 ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', width: diag, height: diag, left: (box.w - diag) / 2, top: (box.h - diag) / 2 }, spinStyle]}>
              <GradientFill colors={RAINBOW} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[btn.sheen, sheenStyle]}>
              <GradientFill colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} />
            </Animated.View>
          </>
        ) : null}
        <View style={btn.row}>
          <View style={btn.knobSlot}>
            {playing ? <Animated.View style={[btn.knobRing, ringStyle]} /> : null}
            <Animated.View style={[btn.knob, knobStyle]}>
              <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#0C1D3B" style={playing ? undefined : { marginLeft: 2 }} />
            </Animated.View>
          </View>
          <View style={btn.textCol}>
            <Text numberOfLines={1} style={btn.title}>
              {playing ? t('live.listening') : t('live.listen')}
            </Text>
            <View style={btn.chip}>
              <Ionicons name={knownListeners || playing ? 'headset' : 'time-outline'} size={14} color="#7DF0C6" />
              {playing ? <Text style={btn.chipElapsed}>{digits(clockText(elapsed))}</Text> : null}
              {knownListeners ? (
                <>
                  <Text style={btn.chipCount}>{digits(formatCount(listeners))}</Text>
                  <Text style={btn.chipLabel}>{t('live.chip')}</Text>
                </>
              ) : (
                <Text style={btn.chipLabel}>
                  {playing
                    ? t('feed.chipLive')
                    : azanLabel
                      ? t('feed.azanAt', { time: formatClock(azanLabel) })
                      : t('mosque.liveTitle')}
                </Text>
              )}
            </View>
          </View>
          <View style={btn.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {WAVE.map((height, index) => (
              <WaveBar key={index} base={height} index={index} active={playing && !reduce} />
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  )
})

function useFeedData(nearby: Mosque[], catalog: Mosque[], now: Date, radiusKm: number, revision: number) {
  const { subscribedIds } = useMosqueNotify()
  return useMemo(() => {
    const inRange = nearby
      .filter((mosque) => mosque.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
    const live = inRange.filter((mosque) => mosqueOnAir(mosque, now))
    const soon = inRange
      .filter((mosque) => !mosqueOnAir(mosque, now))
      .sort((a, b) => nextAzan(a, now).wait - nextAzan(b, now).wait || a.distance - b.distance)
    const followed = catalog.filter((mosque) => subscribedIds.has(String(mosque.id)))
    const followedLive = followed.filter((mosque) => mosqueOnAir(mosque, now)).sort((a, b) => a.distance - b.distance)
    const followedOff = followed
      .filter((mosque) => !mosqueOnAir(mosque, now))
      .sort((a, b) => nextAzan(a, now).wait - nextAzan(b, now).wait)
    return { live, soon, followed, followedLive, followedOff }
  }, [nearby, catalog, now, radiusKm, subscribedIds, revision])
}

export function LiveAzanFeed({
  nearby,
  catalog,
  city,
  bottomInset,
  loading,
  onPressLocation,
  onRefresh,
  refreshing,
  citySupported = true,
  detectedCity = '',
  country,
}: {
  nearby: Mosque[]
  catalog: Mosque[]
  city: string
  bottomInset: number
  loading: boolean
  onPressLocation: () => void
  onRefresh: () => void
  refreshing: boolean
  citySupported?: boolean
  detectedCity?: string
  country?: string
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const ink = paper.ink
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, placeName, prayerName, formatDistance, formatRadius, digits } = useLanguage()
  const { isSubscribed, toggle } = useMosqueNotify()
  const [view, setView] = useState<'all' | 'sub'>('all')
  const [radiusKm, setRadiusKm] = useState<MosqueRadiusKm>(5)
  const [now, setNow] = useState(() => new Date())
  const [sessionTick, setSessionTick] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playStart, setPlayStart] = useState(0)
  const [playSec, setPlaySec] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => subscribeLiveSessions(() => setSessionTick((tick) => tick + 1)), [])
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(
    () =>
      subscribeAzan(() => {
        const state = getAzanState()
        setPlayingId(state.playing ? state.mosqueId : null)
        if (state.playing) setPlayStart((start) => start || Date.now())
        else setPlayStart(0)
      }),
    [],
  )
  useEffect(() => {
    if (!playingId) return
    const timer = setInterval(() => setPlaySec(Math.max(0, Math.floor((Date.now() - playStart) / 1000))), 1000)
    return () => clearInterval(timer)
  }, [playingId, playStart])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const lists = useFeedData(nearby, catalog, now, radiusKm, sessionTick)

  const onToggleSub = useCallback(
    async (mosque: Mosque) => {
      const wasOn = isSubscribed(mosque.id)
      const result = await toggle(mosque.id)
      if (result === 'need_login') {
        Alert.alert(t('mosque.signInTitle'), t('feed.signInBody'), [
          { text: t('mosque.cancel'), style: 'cancel' },
          { text: t('mosque.logIn'), onPress: () => router.push('/login') },
        ])
        return
      }
      if (result === 'error') {
        Alert.alert(t('mosque.updateFailTitle'), t('mosque.updateFailBody'))
        return
      }
      const name = placeName(mosque.name)
      setToast(wasOn ? t('mosque.unsubscribed', { name }) : t('feed.subscribedToast', { name }))
    },
    [isSubscribed, toggle, router, t, placeName],
  )

  const onPlay = useCallback((mosque: Mosque) => {
    const starting = !(getAzanState().playing && getAzanState().mosqueId === mosque.id)
    if (starting) setPlayStart(Date.now())
    void toggleLiveAzan(mosque.id, `${mosque.id}-live`).catch((error) => {
      Alert.alert(t('mosque.liveTitle'), error instanceof Error ? error.message : t('mosque.liveFail'))
    })
  }, [t])

  const rangeLabel = radiusKm >= CITY_RADIUS_KM ? t('feed.theCity') : formatRadius(radiusKm)
  const playing = playingId ? catalog.find((mosque) => mosque.id === playingId) ?? nearby.find((mosque) => mosque.id === playingId) : null
  const liveCount = view === 'all' ? lists.live.length : lists.followedLive.length

  return (
    <View style={styles.screen}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.brand}>PRAYNOW</Text>
          <Text style={styles.title}>{t('feed.title')}</Text>
        </View>
        <View style={styles.headSide}>
          <Pressable onPress={onPressLocation} accessibilityRole="button" accessibilityLabel={t('common.changeLocation')} style={styles.cityPill}>
            <Ionicons name="location-outline" size={15} color={paper.onInk} />
            <Text style={styles.cityText} numberOfLines={1}>
              {city}
            </Text>
            <Ionicons name="chevron-down" size={14} color={paper.onInk} />
          </Pressable>
          <UserMenu />
        </View>
      </View>

      <View style={styles.seg} accessibilityRole="tablist">
        {(
          [
            { key: 'all' as const, label: t('feed.all'), count: lists.live.length, live: lists.live.length > 0 },
            {
              key: 'sub' as const,
              label: t('feed.subscribed'),
              count: lists.followedLive.length || lists.followed.length,
              live: lists.followedLive.length > 0,
            },
          ]
        ).map((tab) => {
          const on = view === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => setView(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segBtn, on && styles.segBtnOn]}>
              <Text style={[styles.segText, on && { color: paper.onInk }]}>{tab.label}</Text>
              <View style={[styles.segN, on && styles.segNOn, tab.live && styles.segLive]}>
                <Text style={[styles.segNText, on && { color: paper.onInk }, tab.live && { color: '#FFFFFF' }]}>{digits(tab.count)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + bottomInset + (playing ? 76 : 0) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink} colors={[ink]} progressBackgroundColor={paper.card} />
        }>
        {!citySupported && !loading ? (
          <CityUnavailableBanner detectedCity={detectedCity} country={country} />
        ) : null}
        <View style={styles.air}>
          <OnAir active={liveCount > 0} />
          <View style={styles.airText}>
            <Text style={styles.airTitle}>
              {view === 'sub' && lists.followed.length === 0
                ? t('feed.subscribed')
                : liveCount > 0
                  ? t('feed.liveCount', { count: liveCount })
                  : t('feed.nothingLive')}
            </Text>
            <Text style={styles.airSub}>
              {view === 'all'
                ? liveCount > 0
                  ? t('feed.airNear', { range: rangeLabel })
                  : t('feed.airNone', { range: rangeLabel })
                : lists.followed.length > 1
                  ? t('feed.fromMany', { count: lists.followed.length })
                  : lists.followed.length === 1
                    ? t('feed.fromOne')
                    : t('feed.followHint')}
            </Text>
          </View>
          {view === 'sub' ? (
            <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={t('feed.addMosque')} style={styles.addBtn}>
              <Ionicons name="add" size={16} color={paper.onInk} />
              <Text style={styles.addText}>{t('feed.add')}</Text>
            </Pressable>
          ) : null}
        </View>

        {view === 'all' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges}>
            {MOSQUE_RADIUS_STOPS.map((stop) => {
              const on = stop.value === radiusKm
              return (
                <Pressable
                  key={stop.label}
                  onPress={() => setRadiusKm(stop.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.range, on && styles.rangeOn]}>
                  <Text style={[styles.rangeText, on && { color: paper.onInk }]}>{formatRadius(stop.value)}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {loading && nearby.length === 0 ? <ActivityIndicator color={ink} style={styles.loader} /> : null}

        {view === 'all' ? (
          <>
            {lists.live.length > 0 ? (
              lists.live.map((mosque) => (
                <LiveCard
                  key={mosque.id}
                  mosque={mosque}
                  now={now}
                  playing={playingId === mosque.id}
                  elapsed={playSec}
                  subscribed={isSubscribed(mosque.id)}
                  onPlay={onPlay}
                  onToggle={onToggleSub}
                  placeName={placeName}
                  prayerName={prayerName}
                  formatDistance={formatDistance}
                  revision={sessionTick}
                />
              ))
            ) : loading ? null : (
              <Empty
                title={t('feed.emptyLiveTitle')}
                text={t('feed.emptyLiveText')}
              />
            )}
            {lists.soon.length > 0 ? (
              <>
                <SectionTitle title={lists.live.length ? t('feed.startingSoon') : t('feed.nextAzans')} count={lists.soon.length} />
                <View style={styles.soon}>
                  {lists.soon.slice(0, 5).map((mosque, index) => (
                    <View key={mosque.id} style={index > 0 ? styles.rowBorder : undefined}>
                      <MosqueRow
                        mosque={mosque}
                        now={now}
                        subscribed={isSubscribed(mosque.id)}
                        icon="time-outline"
                        onToggle={onToggleSub}
                        placeName={placeName}
                        prayerName={prayerName}
                        formatDistance={formatDistance}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : lists.followed.length === 0 ? (
          <Empty
            title={t('feed.emptySubTitle')}
            text={t('feed.emptySubText')}
            cta={t('feed.findMosque')}
            onCta={() => setSheet(true)}
          />
        ) : (
          <>
            {lists.followedLive.length > 0 ? (
              lists.followedLive.map((mosque) => (
                <LiveCard
                  key={mosque.id}
                  mosque={mosque}
                  now={now}
                  playing={playingId === mosque.id}
                  elapsed={playSec}
                  subscribed={isSubscribed(mosque.id)}
                  onPlay={onPlay}
                  onToggle={onToggleSub}
                  placeName={placeName}
                  prayerName={prayerName}
                  formatDistance={formatDistance}
                  revision={sessionTick}
                />
              ))
            ) : (
              <Empty
                title={t('feed.noneLiveTitle')}
                text={t('feed.noneLiveText')}
              />
            )}
            {lists.followedOff.length > 0 ? (
              <>
                <SectionTitle title={t('feed.notLive')} count={lists.followedOff.length} />
                <View style={styles.soon}>
                  {lists.followedOff.map((mosque, index) => (
                    <View key={mosque.id} style={index > 0 ? styles.rowBorder : undefined}>
                      <MosqueRow
                        mosque={mosque}
                        now={now}
                        subscribed={isSubscribed(mosque.id)}
                        icon="time-outline"
                        onToggle={onToggleSub}
                        placeName={placeName}
                        prayerName={prayerName}
                        formatDistance={formatDistance}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {playing ? (
        <MiniPlayer
          mosque={playing}
          seconds={playSec}
          bottom={8 + bottomInset}
          onStop={() => onPlay(playing)}
          placeName={placeName}
        />
      ) : null}

      <AddSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        mosques={catalog}
        now={now}
        isSubscribed={isSubscribed}
        onToggle={onToggleSub}
        placeName={placeName}
      />

      {toast ? (
        <View style={[styles.toast, { bottom: 90 + bottomInset }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  )
}

const LiveCard = memo(function LiveCard({
  mosque,
  now,
  playing,
  elapsed,
  subscribed,
  onPlay,
  onToggle,
  placeName,
  prayerName,
  formatDistance,
  revision,
}: {
  mosque: Mosque
  now: Date
  playing: boolean
  elapsed: number
  subscribed: boolean
  onPlay: (mosque: Mosque) => void
  onToggle: (mosque: Mosque) => void
  placeName: (value: string) => string
  prayerName: (value: string) => string
  formatDistance: (km: number) => string
  revision: number
}) {
  void revision
  const styles = useStyles()
  const { t, formatDuration, formatClock } = useLanguage()
  const slot = focusSlot(mosque, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const ago = Math.max(1, nowMin - slot.azanMin)
  let left = slot.jamatMin - nowMin
  if (left < 0 && slot.jamatMin < slot.azanMin) left += 1440
  const status =
    left > 0 ? t('feed.began', { ago: formatDuration(ago), left: formatDuration(left) }) : t('feed.jamatTime')
  const listeners = getLiveSession(mosque.id)?.listeners ?? 0

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={[styles.card, playing && styles.cardPlaying]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitle}>
          <Text style={styles.name} numberOfLines={2}>
            {placeName(mosque.name)}
          </Text>
          <View style={styles.subline}>
            <Ionicons name="location-sharp" size={14} color="#EA4335" />
            <Text style={styles.sublineText} numberOfLines={1}>
              <Text style={styles.sublineBold}>{formatDistance(mosque.distance)}</Text>
              {` · ${placeName(mosque.area || mosque.address)}`}
            </Text>
          </View>
        </View>
        <View style={styles.badge}>
          <BlinkDot color="#FFFFFF" />
          <Text style={styles.badgeText}>{t('mosque.liveBadge')}</Text>
        </View>
      </View>
      <View style={styles.times}>
        <View style={styles.timeTile}>
          <Text style={styles.timeLabel}>{t('feed.prayerAzan', { name: prayerName(slot.name) })}</Text>
          <Text style={styles.timeValue}>{slot.azanLabel ? formatClock(slot.azanLabel) : '—'}</Text>
        </View>
        <View style={styles.timeTile}>
          <Text style={styles.timeLabel}>{t('mosque.jamat')}</Text>
          <Text style={styles.timeValue}>{slot.jamatLabel ? formatClock(slot.jamatLabel) : '—'}</Text>
        </View>
      </View>
      <View style={styles.stat}>
        <View style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText} numberOfLines={1}>
            {status}
          </Text>
        </View>
        <SubPill on={subscribed} name={mosque.name} onPress={() => onToggle(mosque)} />
      </View>
      <ListenButton
        playing={playing}
        listeners={listeners}
        elapsed={elapsed}
        azanLabel={slot.azanLabel}
        label={t(playing ? 'feed.pauseA11y' : 'feed.listenA11y', { name: placeName(mosque.name) })}
        onPress={() => onPlay(mosque)}
      />
    </Animated.View>
  )
})

const MosqueRow = memo(function MosqueRow({
  mosque,
  now,
  subscribed,
  icon,
  onToggle,
  placeName,
  prayerName,
  formatDistance,
}: {
  mosque: Mosque
  now: Date
  subscribed: boolean
  icon: 'time-outline' | 'globe-outline'
  onToggle: (mosque: Mosque) => void
  placeName: (value: string) => string
  prayerName: (value: string) => string
  formatDistance: (km: number) => string
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const { t, formatDuration, formatClock } = useLanguage()
  const next = nextAzan(mosque, now)
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={paperColors(mode).ink} />
      </View>
      <View style={styles.cardTitle}>
        <Text style={styles.rowName} numberOfLines={1}>
          {placeName(mosque.name)}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {t('feed.nextRow', {
            name: prayerName(next.prayer),
            time: formatClock(formatMinutesAsTime(next.azanMin)),
            wait: formatDuration(next.wait),
          })}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {placeName(mosque.area || mosque.city)} · {formatDistance(mosque.distance)}
        </Text>
      </View>
      <SubPill on={subscribed} name={mosque.name} onPress={() => onToggle(mosque)} />
    </View>
  )
})

function SubPill({ on, name, onPress }: { on: boolean; name: string; onPress: () => void }) {
  const styles = useStyles()
  const { mode } = useTheme()
  const paper = paperColors(mode)
  const { t, placeName } = useLanguage()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t(on ? 'feed.unsubA11y' : 'feed.subA11y', { name: placeName(name) })}
      style={[styles.sub, on && styles.subOn]}>
      <Ionicons name={on ? 'notifications' : 'notifications-outline'} size={14} color={on ? paper.onInk : paper.muted} />
      <Text style={[styles.subText, on && { color: paper.onInk }]}>{on ? t('feed.subscribed') : t('feed.subscribe')}</Text>
    </Pressable>
  )
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  const styles = useStyles()
  const { t } = useLanguage()
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count === 1 ? t('feed.countOne') : t('feed.countMany', { count })}</Text>
    </View>
  )
}

function Empty({ title, text, cta, onCta }: { title: string; text: string; cta?: string; onCta?: () => void }) {
  const styles = useStyles()
  const paper = paperColors(useTheme().mode)
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.empty}>
      <View style={styles.emptyMark}>
        <Ionicons name="radio-outline" size={36} color="#FF6A4D" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {cta && onCta ? (
        <Pressable onPress={onCta} accessibilityRole="button" style={styles.cta}>
          <Ionicons name="search" size={16} color={paper.onInk} />
          <Text style={styles.ctaText}>{cta}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  )
}

function AddSheet({
  visible,
  onClose,
  mosques,
  now,
  isSubscribed,
  onToggle,
  placeName,
}: {
  visible: boolean
  onClose: () => void
  mosques: Mosque[]
  now: Date
  isSubscribed: (id: string) => boolean
  onToggle: (mosque: Mosque) => void
  placeName: (value: string) => string
}) {
  const styles = useStyles()
  const { t, formatDistance } = useLanguage()
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (visible) setQuery('')
  }, [visible])

  const { list, label } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return {
        list: [...mosques].sort((a, b) => a.distance - b.distance).slice(0, 40),
        label: t('feed.mosques'),
      }
    }
    const matches = mosques
      .filter((mosque) => `${mosque.name} ${mosque.city} ${mosque.area} ${mosque.address}`.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(!a.name.toLowerCase().startsWith(needle)) - Number(!b.name.toLowerCase().startsWith(needle)) ||
          a.distance - b.distance,
      )
    return {
      list: matches,
      label: matches.length === 1 ? t('feed.resultOne') : t('feed.results', { count: matches.length }),
    }
  }, [query, mosques, t])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.sheetFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <View style={styles.sheetHead}>
            <View style={styles.cardTitle}>
              <Text style={styles.sheetTitle}>{t('feed.addMosque')}</Text>
              <Text style={styles.sheetSub}>{t('feed.sheetSub')}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.close}>
              <Ionicons name="close" size={18} color="#5F6B7A" />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color="#5F6B7A" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('feed.searchPh')}
              placeholderTextColor="#9AA5B3"
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('feed.searchA11y')}
            />
          </View>
          <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {list.length === 0 ? (
              <Text style={styles.none}>{t('feed.noMatch', { query: query.trim() })}</Text>
            ) : (
              <>
                <Text style={styles.resultLabel}>{label}</Text>
                {list.map((mosque) => {
                  const live = mosqueOnAir(mosque, now)
                  return (
                    <View key={mosque.id} style={styles.resultRow}>
                      <View style={styles.rowIcon}>
                        <Ionicons name="location-outline" size={18} color="#1F7A68" />
                      </View>
                      <View style={styles.cardTitle}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {placeName(mosque.name)}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {placeName(mosque.city || mosque.area)} · {t('feed.away', { distance: formatDistance(mosque.distance) })}
                        </Text>
                        {live ? <Text style={styles.liveNote}>{t('feed.liveNow')}</Text> : null}
                      </View>
                      <SubPill on={isSubscribed(mosque.id)} name={mosque.name} onPress={() => onToggle(mosque)} />
                    </View>
                  )
                })}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function MiniPlayer({
  mosque,
  seconds,
  bottom,
  onStop,
  placeName,
}: {
  mosque: Mosque
  seconds: number
  bottom: number
  onStop: () => void
  placeName: (value: string) => string
}) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()
  const spin = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    spin.value = withRepeat(withTiming(360, { duration: 2000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(spin)
  }, [reduce, spin])
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }))
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={[mini.bar, { bottom }]}>
      <View style={mini.mark}>
        <Animated.View style={[mini.spin, spinStyle]}>
          <GradientFill colors={RAINBOW} />
        </Animated.View>
        <Ionicons name="radio" size={16} color="#FFFFFF" />
      </View>
      <View style={mini.text}>
        <Text style={mini.name} numberOfLines={1}>
          {placeName(mosque.name)}
        </Text>
        <View style={mini.sub}>
          <BlinkDot color="#FF4D3D" size={6} />
          <Text style={mini.time}>{t('feed.miniLive', { time: clockText(seconds) })}</Text>
        </View>
      </View>
      <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel={t('feed.pause')} style={mini.stop}>
        <Ionicons name="pause" size={18} color="#0C1D3B" />
      </Pressable>
    </Animated.View>
  )
}

const air = StyleSheet.create({
  wrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ripple: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,77,61,0.6)',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const btn = StyleSheet.create({
  shadow: {
    marginTop: 12,
    borderRadius: 999,
    shadowColor: '#FF4D3D',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  pill: { minHeight: 60, borderRadius: 999, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#14305A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 6, paddingRight: 14 },
  knobSlot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  knobRing: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#FFFFFF' },
  textCol: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(9,20,44,0.72)',
  },
  chipElapsed: { fontFamily: F.semi, fontSize: 12, color: '#FFD79A' },
  chipCount: { fontFamily: F.heavy, fontSize: 13, color: '#FFFFFF' },
  chipLabel: { fontFamily: F.semi, fontSize: 12, color: '#FFFFFF' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 24 },
  bar: { width: 3.5, borderRadius: 2, backgroundColor: '#FF9A3D' },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 60 },
})

const mini = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#14232F',
  },
  mark: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  spin: { position: 'absolute', width: 52, height: 52 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  time: { fontFamily: F.semi, fontSize: 12, color: '#C9D4E0' },
  stop: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
})

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const paper = paperColors(mode)
  const page = paper.page
  const card = paper.card
  const ink = paper.ink
  const muted = paper.muted
  const line = paper.line
  const tile = paper.chip
  const onInk = paper.onInk
  return {
    screen: { flex: 1, backgroundColor: page },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingLeft: 16,
      paddingRight: 12,
      paddingBottom: 8,
    },
    brand: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: muted },
    title: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: ink, letterSpacing: -0.3, marginTop: 1 },
    cityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 150,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: ink,
    },
    headSide: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, justifyContent: 'flex-end' },
    cityText: { flexShrink: 1, fontFamily: F.bold, fontSize: 13, color: onInk },
    seg: {
      flexDirection: 'row',
      gap: 4,
      marginHorizontal: 12,
      marginBottom: 6,
      padding: 4,
      borderRadius: 18,
      backgroundColor: tile,
    },
    segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 14 },
    segBtnOn: { backgroundColor: ink },
    segText: { fontFamily: F.bold, fontSize: 14, color: muted },
    segNOn: { backgroundColor: 'rgba(255,255,255,0.18)' },
    segN: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,31,46,0.09)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    segLive: { backgroundColor: '#FF4D3D' },
    segNText: { fontFamily: F.heavy, fontSize: 11, color: muted },
    scroll: { paddingHorizontal: 12, paddingTop: 4 },
    air: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 12 },
    airText: { flex: 1, minWidth: 0 },
    airTitle: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: ink },
    airSub: { fontFamily: F.medium, fontSize: 13, color: muted, marginTop: 2 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingLeft: 10,
      paddingRight: 12,
      borderRadius: 999,
      backgroundColor: ink,
    },
    addText: { fontFamily: F.bold, fontSize: 13, color: onInk },
    ranges: { gap: 8, paddingBottom: 12 },
    range: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: tile },
    rangeOn: { backgroundColor: ink },
    rangeText: { fontFamily: F.bold, fontSize: 13, color: muted },
    loader: { marginVertical: 24 },
    card: {
      backgroundColor: card,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: line,
      padding: 14,
      marginBottom: 10,
    },
    cardPlaying: { borderColor: '#FF4D3D' },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTitle: { flex: 1, minWidth: 0 },
    name: { fontFamily: F.display, fontSize: 20, lineHeight: 24, color: ink },
    subline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    sublineText: { flex: 1, fontFamily: F.medium, fontSize: 13, color: muted },
    sublineBold: { fontFamily: F.bold, color: ink },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingLeft: 8,
      paddingRight: 10,
      borderRadius: 999,
      backgroundColor: '#FF4D3D',
    },
    badgeText: { fontFamily: F.heavy, fontSize: 11, letterSpacing: 0.6, color: '#FFFFFF' },
    times: { flexDirection: 'row', gap: 8, marginTop: 12 },
    timeTile: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: tile,
    },
    timeLabel: { fontFamily: F.semi, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: muted },
    timeValue: { fontFamily: F.heavy, fontSize: 16, color: ink, marginTop: 2 },
    stat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
    status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4D3D' },
    statusText: { flexShrink: 1, fontFamily: F.semi, fontSize: 12.5, color: dark ? '#FF8A7A' : '#D93A2B' },
    sub: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingLeft: 10,
      paddingRight: 12,
      borderRadius: 999,
      backgroundColor: tile,
    },
    subOn: { backgroundColor: ink },
    subText: { fontFamily: F.bold, fontSize: 12.5, color: muted },
    section: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 8,
      marginHorizontal: 4,
    },
    sectionTitle: { fontFamily: F.display, fontSize: 20, color: ink },
    sectionCount: { fontFamily: F.semi, fontSize: 12.5, color: muted },
    soon: { backgroundColor: card, borderRadius: 24, borderWidth: 1, borderColor: line, overflow: 'hidden', marginBottom: 10 },
    rowBorder: { borderTopWidth: 1, borderTopColor: line },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 12, paddingRight: 10 },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: tile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowName: { fontFamily: F.bold, fontSize: 15, color: ink },
    rowSub: { fontFamily: F.medium, fontSize: 12.5, color: muted, marginTop: 2 },
    empty: {
      alignItems: 'center',
      backgroundColor: card,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: line,
      paddingVertical: 22,
      paddingHorizontal: 18,
      marginBottom: 10,
    },
    emptyMark: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? '#3A2422' : '#FDECEA',
    },
    emptyTitle: { fontFamily: F.display, fontSize: 22, color: ink, marginTop: 10, textAlign: 'center' },
    emptyText: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: muted, marginTop: 6, textAlign: 'center' },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      paddingVertical: 10,
      paddingLeft: 14,
      paddingRight: 16,
      borderRadius: 999,
      backgroundColor: ink,
    },
    ctaText: { fontFamily: F.bold, fontSize: 14, color: onInk },
    sheetFlex: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: 'rgba(15,31,46,0.42)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '88%',
      backgroundColor: card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 10,
    },
    grab: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: dark ? '#34504A' : '#D5DAE2', marginBottom: 12 },
    sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18 },
    sheetTitle: { fontFamily: F.display, fontSize: 22, color: ink },
    sheetSub: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: muted, marginTop: 4 },
    close: { width: 34, height: 34, borderRadius: 17, backgroundColor: tile, alignItems: 'center', justifyContent: 'center' },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 14,
      paddingHorizontal: 12,
      height: 44,
      borderRadius: 16,
      backgroundColor: tile,
      borderWidth: 1,
      borderColor: line,
    },
    searchInput: { flex: 1, fontFamily: F.body, fontSize: 15, color: ink, paddingVertical: 0 },
    results: { paddingHorizontal: 8, paddingBottom: 28 },
    resultLabel: { fontFamily: F.bold, fontSize: 12, color: muted, marginTop: 12, marginBottom: 2, marginHorizontal: 10 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 8 },
    liveNote: { fontFamily: F.bold, fontSize: 12, color: dark ? '#FF8A7A' : '#D93A2B', marginTop: 2 },
    none: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: muted, textAlign: 'center', paddingVertical: 26, paddingHorizontal: 14 },
    toast: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
    toastText: {
      fontFamily: F.semi,
      fontSize: 13,
      color: onInk,
      backgroundColor: ink,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      overflow: 'hidden',
      textAlign: 'center',
    },
  }
})
