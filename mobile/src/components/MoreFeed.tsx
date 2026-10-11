import { MaterialCommunityIcons } from '@expo/vector-icons'
import { memo, useEffect, useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { GradientFill } from '@/src/components/GradientFill'
import { UserMenu } from '@/src/components/UserMenu'
import { LANGUAGES, type LanguageCode } from '@/src/i18n/translations'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { calculateQiblaBearing } from '@/src/utils/qibla'

const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
  italic: 'Newsreader_500Medium',
} as const

const DIRS = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west']

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name']

export type DailyItem = { arabic?: string; translation: string; source: string }

function direction(deg: number) {
  return DIRS[Math.round(deg / 45) % 8]
}

const IconChip = memo(function IconChip({
  icon,
  size = 40,
  bg,
  fg,
}: {
  icon: IconName
  size?: number
  bg: string
  fg: string
}) {
  return (
    <View style={[chip.box, { width: size, height: size, borderRadius: 13, backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  )
})

const chip = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
})

function Toggle({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  const styles = useStyles()
  const x = useSharedValue(on ? 18 : 0)
  useEffect(() => {
    x.value = withTiming(on ? 18 : 0, { duration: 200, easing: Easing.out(Easing.cubic) })
  }, [on, x])
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[styles.sw, on && styles.swOn]}>
      <Animated.View style={[styles.swKnob, knob]} />
    </Pressable>
  )
}

function Compass({ bearing }: { bearing: number }) {
  const styles = useStyles()
  const reduce = useReducedMotion()
  const sway = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 2250, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    )
    return () => cancelAnimation(sway)
  }, [reduce, sway])
  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${bearing + sway.value * 5}deg` }] }))
  return (
    <View style={styles.compass} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.compassDial}>
        <Text style={styles.compassN}>N</Text>
      </View>
      <Animated.View style={[styles.needle, needle]}>
        <View style={styles.needleNorth} />
        <View style={styles.needleSouth} />
        <View style={styles.needlePivot} />
        <View style={styles.needleTip} />
      </Animated.View>
    </View>
  )
}

function DailyCard({
  verse,
  hadith,
  onToast,
}: {
  verse: DailyItem
  hadith: DailyItem
  onToast: (message: string) => void
}) {
  const styles = useStyles()
  const { mode } = useTheme()
  const dark = mode === 'dark'
  const [kind, setKind] = useState<'verse' | 'hadith'>('verse')
  const item = kind === 'verse' ? verse : hadith
  const opacity = useSharedValue(1)
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const text = [item.arabic, item.translation, item.source].filter(Boolean).join('\n')

  const share = async () => {
    try {
      await Share.share({ message: text })
    } catch {
      onToast('Could not open share')
    }
  }

  return (
    <View style={[styles.card, styles.daily]}>
      <GradientFill colors={dark ? ['#12303A', '#102230', '#1B2142'] : ['#F1FAF7', '#FFFFFF', '#F3F2FF']} />
      <View style={styles.dailyHead}>
        <View style={styles.dailyLabel}>
          <MaterialCommunityIcons name="creation" size={15} color={dark ? '#5BC9B0' : '#1F7A68'} />
          <Text style={styles.dailyLabelText}>TODAY</Text>
        </View>
        <View style={styles.seg}>
          {(['verse', 'hadith'] as const).map((key) => {
            const on = kind === key
            return (
              <Pressable
                key={key}
                onPress={() => {
                  if (key === kind) return
                  opacity.value = withSequence(withTiming(0.35, { duration: 120 }), withTiming(1, { duration: 180 }))
                  setKind(key)
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.segBtn, on && styles.segBtnOn]}>
                <Text style={[styles.segText, on && styles.segTextOn]}>{key === 'verse' ? 'Verse' : 'Hadith'}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <Animated.View style={fade}>
        {item.arabic ? <Text style={styles.arabic}>{item.arabic}</Text> : null}
        <Text style={styles.trans}>{item.translation}</Text>
        <View style={styles.dailyFoot}>
          <Text style={styles.source} numberOfLines={2}>
            {item.source}
          </Text>
          <Pressable onPress={() => void share()} accessibilityRole="button" accessibilityLabel="Share" style={styles.iconBtn}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color={dark ? '#9BAEC0' : '#5F6B7A'} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

export function MoreFeed({
  topInset,
  bottomInset,
  guest,
  showAppAdmin,
  city,
  lat,
  lon,
  verse,
  hadith,
  unread,
  language,
  onLanguage,
  onSignIn,
  onAppAdmin,
  onQibla,
  onAddMosque,
  onMessages,
}: {
  topInset: number
  bottomInset: number
  guest: boolean
  showAppAdmin: boolean
  city: string
  lat: number
  lon: number
  verse: DailyItem
  hadith: DailyItem
  unread: number
  language: LanguageCode
  onLanguage: (code: LanguageCode) => void
  onSignIn: () => void
  onAppAdmin: () => void
  onQibla: () => void
  onAddMosque: () => void
  onMessages: () => void
}) {
  const styles = useStyles()
  const { mode, setMode } = useTheme()
  const dark = mode === 'dark'
  const accent = dark ? '#5BC9B0' : '#1F7A68'
  const muted = dark ? '#9BAEC0' : '#5F6B7A'
  const violet = dark ? '#9C8FFF' : '#6C5CE7'
  const blue = dark ? '#6DB6F5' : '#2E8FD0'
  const [alerts, setAlerts] = useState(true)
  const [notify, setNotify] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const bearing = calculateQiblaBearing(lat, lon)
  const languageLabel = LANGUAGES.find((item) => item.code === language)?.nativeLabel ?? 'English'
  const showAdmin = showAppAdmin

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1900)
    return () => clearTimeout(timer)
  }, [toast])

  const say = (message: string) => setToast(message)

  return (
    <View style={styles.screen}>
      <View style={[styles.head, { paddingTop: topInset + 8 }]}>
        <View>
          <Text style={styles.brand}>PRAYNOW</Text>
          <Text style={styles.title}>More</Text>
        </View>
        <UserMenu />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + 24 }]} showsVerticalScrollIndicator={false}>
        {showAdmin ? (
          <Animated.View entering={FadeInDown.duration(260)} style={styles.card}>
            <View style={styles.adminHead}>
              <MaterialCommunityIcons name="shield-check-outline" size={15} color={accent} />
              <Text style={styles.adminHeadText}>ADMIN TOOLS</Text>
            </View>
            {showAppAdmin ? (
              <Pressable onPress={onAppAdmin} accessibilityRole="button" style={styles.adminRow}>
                <IconChip icon="shield-outline" bg={dark ? 'rgba(109,182,245,0.16)' : 'rgba(46,143,208,0.12)'} fg={blue} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>App Admin</Text>
                  <Text style={styles.rowSub}>Mosques, mosque admins and city schedule</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={muted} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        {guest ? (
          <Animated.View entering={FadeInDown.duration(260)} style={[styles.card, styles.banner]}>
            <IconChip icon="login" size={42} bg={dark ? 'rgba(91,201,176,0.15)' : 'rgba(31,122,104,0.12)'} fg={accent} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Sync your PrayNow</Text>
              <Text style={styles.rowSub}>Sign in to save your mosques and reminders.</Text>
            </View>
            <Pressable onPress={onSignIn} accessibilityRole="button" style={styles.signBtn}>
              <Text style={styles.signText}>Sign in</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(280).delay(40)}>
          <DailyCard verse={verse} hadith={hadith} onToast={say} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(280).delay(80)}>
          <Pressable onPress={onQibla} accessibilityRole="button" accessibilityLabel="Qibla direction" style={[styles.card, styles.qibla]}>
            <Compass bearing={bearing} />
            <View style={styles.flex}>
              <Text style={styles.qiblaTitle}>Qibla Direction</Text>
              <Text style={styles.qiblaSub}>
                Face the Kaaba:{' '}
                <Text style={styles.qiblaEm}>
                  {Math.round(bearing)}° {direction(bearing)}
                </Text>{' '}
                from {city}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={muted} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(280).delay(120)} style={styles.tiles}>
          <Pressable onPress={onAddMosque} accessibilityRole="button" style={[styles.card, styles.tile]}>
            <IconChip icon="plus-circle-outline" size={42} bg={dark ? 'rgba(156,143,255,0.16)' : 'rgba(108,92,231,0.12)'} fg={violet} />
            <View>
              <Text style={styles.tileTitle}>Add a mosque</Text>
              <Text style={styles.tileSub}>Request a missing mosque with photos and contact</Text>
            </View>
          </Pressable>
          <Pressable onPress={onMessages} accessibilityRole="button" accessibilityLabel={`Messages, ${unread} unread`} style={[styles.card, styles.tile]}>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
            <IconChip icon="message-outline" size={42} bg={dark ? 'rgba(109,182,245,0.16)' : 'rgba(46,143,208,0.12)'} fg={blue} />
            <View>
              <Text style={styles.tileTitle}>Messages</Text>
              <Text style={styles.tileSub}>Mosque timing updates and announcements</Text>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(280).delay(160)} style={[styles.card, styles.soon]}>
          <View style={styles.soonHead}>
            <Text style={styles.soonTitle}>Coming soon</Text>
            <Pressable
              onPress={() => {
                const next = !notify
                setNotify(next)
                say(next ? "We'll let you know when these launch" : 'Notification off')
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: notify }}
              style={[styles.notify, notify && styles.notifyOn]}>
              <MaterialCommunityIcons name={notify ? 'bell-ring' : 'bell-outline'} size={15} color={notify ? '#FFFFFF' : muted} />
              <Text style={[styles.notifyText, notify && { color: '#FFFFFF' }]}>{notify ? "You'll be notified" : 'Notify me'}</Text>
            </Pressable>
          </View>
          <View style={styles.soonGrid}>
            {(
              [
                { icon: 'calendar-month-outline' as const, title: 'Calendar', sub: 'Hijri dates and events' },
                { icon: 'checkbox-marked-outline' as const, title: 'Tracker', sub: 'Daily prayers' },
                { icon: 'silverware-fork-knife' as const, title: 'Halal food', sub: 'Restaurants nearby' },
              ]
            ).map((item) => (
              <View key={item.title} style={styles.soonItem}>
                <IconChip icon={item.icon} size={36} bg={dark ? '#102230' : '#FFFFFF'} fg={muted} />
                <Text style={styles.soonItemTitle}>{item.title}</Text>
                <Text style={styles.soonItemSub}>{item.sub}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Text style={styles.section}>SETTINGS</Text>
        <Animated.View entering={FadeInDown.duration(280).delay(200)} style={styles.card}>
          <View style={styles.settingRow}>
            <IconChip icon="bell-outline" size={36} bg={dark ? 'rgba(91,201,176,0.15)' : 'rgba(31,122,104,0.12)'} fg={accent} />
            <Text style={styles.settingTitle}>Azan alerts</Text>
            <Toggle
              on={alerts}
              label="Azan alerts"
              onChange={(value) => {
                setAlerts(value)
                say(value ? 'Azan alerts on' : 'Azan alerts off')
              }}
            />
          </View>
          <View style={[styles.settingRow, styles.rowBorder]}>
            <IconChip icon="weather-night" size={36} bg={dark ? 'rgba(156,143,255,0.16)' : 'rgba(108,92,231,0.12)'} fg={violet} />
            <Text style={styles.settingTitle}>Dark mode</Text>
            <Toggle on={dark} label="Dark mode" onChange={(value) => setMode(value ? 'dark' : 'light')} />
          </View>
          <Pressable onPress={() => setLangOpen((open) => !open)} accessibilityRole="button" style={[styles.settingRow, styles.rowBorder]}>
            <IconChip icon="earth" size={36} bg={dark ? 'rgba(109,182,245,0.16)' : 'rgba(46,143,208,0.12)'} fg={blue} />
            <Text style={styles.settingTitle}>Language</Text>
            <Text style={styles.settingValue}>{languageLabel}</Text>
            <MaterialCommunityIcons name={langOpen ? 'chevron-up' : 'chevron-right'} size={20} color={muted} />
          </Pressable>
          {langOpen
            ? LANGUAGES.map((item) => {
                const selected = item.code === language
                return (
                  <Pressable
                    key={item.code}
                    onPress={() => {
                      onLanguage(item.code)
                      setLangOpen(false)
                    }}
                    style={[styles.langRow, selected && styles.langOn]}>
                    <Text style={[styles.langText, selected && { color: accent }]}>{item.nativeLabel}</Text>
                    <Text style={styles.langSub}>{item.label}</Text>
                  </Pressable>
                )
              })
            : null}
        </Animated.View>

        <View style={styles.links}>
          {(['Help and feedback', 'Privacy', 'About'] as const).map((label, index) => (
            <View key={label} style={styles.linkWrap}>
              {index > 0 ? <Text style={styles.linkDot}>·</Text> : null}
              <Pressable onPress={() => say('Coming soon')} accessibilityRole="button" style={styles.link}>
                <Text style={styles.linkText}>{label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Text style={styles.version}>PrayNow v1.0.0</Text>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: bottomInset + 16 }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const dark = mode === 'dark'
  const page = dark ? '#0A1620' : '#F1F3F7'
  const card = dark ? '#102230' : '#FFFFFF'
  const ink = dark ? '#EAF1F7' : '#0F1F2E'
  const muted = dark ? '#9BAEC0' : '#5F6B7A'
  const faint = dark ? '#6C8196' : '#9AA5B3'
  const line = dark ? '#1C3346' : '#E7EBF1'
  const tile = dark ? '#15293A' : '#F5F7FA'
  const accent = dark ? '#5BC9B0' : '#1F7A68'
  return {
    screen: { flex: 1, backgroundColor: page },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16,
      paddingRight: 12,
      paddingBottom: 8,
    },
    brand: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.6, color: muted },
    title: { fontFamily: F.display, fontSize: 23, lineHeight: 26, color: ink, marginTop: 1 },
    scroll: { paddingHorizontal: 12, paddingTop: 4 },
    card: { backgroundColor: card, borderRadius: 24, borderWidth: 1, borderColor: line, marginBottom: 10, overflow: 'hidden' },
    flex: { flex: 1, minWidth: 0 },
    adminHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 },
    adminHeadText: { fontFamily: F.heavy, fontSize: 12, letterSpacing: 0.6, color: accent },
    adminRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    rowBorder: { borderTopWidth: 1, borderTopColor: line },
    rowTitle: { fontFamily: F.bold, fontSize: 15, color: ink },
    rowSub: { fontFamily: F.body, fontSize: 12.5, lineHeight: 17, color: muted, marginTop: 2 },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingLeft: 14, paddingRight: 12 },
    signBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: dark ? '#EAF1F7' : '#14232F' },
    signText: { fontFamily: F.bold, fontSize: 13, color: dark ? '#0F1F2E' : '#FFFFFF' },
    daily: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14 },
    dailyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dailyLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dailyLabelText: { fontFamily: F.heavy, fontSize: 12, letterSpacing: 0.4, color: accent },
    seg: { flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: tile, borderWidth: 1, borderColor: line },
    segBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
    segBtnOn: { backgroundColor: card },
    segText: { fontFamily: F.bold, fontSize: 12.5, color: muted },
    segTextOn: { color: ink },
    arabic: { marginTop: 14, fontSize: 26, lineHeight: 44, color: ink, textAlign: 'right', writingDirection: 'rtl' },
    trans: { marginTop: 8, fontFamily: F.italic, fontSize: 17, lineHeight: 25, color: muted },
    dailyFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
    source: { flex: 1, fontFamily: F.bold, fontSize: 13, color: muted },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: card,
      borderWidth: 1,
      borderColor: line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qibla: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
    compass: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
    compassDial: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 2,
      borderColor: line,
      backgroundColor: tile,
      alignItems: 'center',
    },
    compassN: { marginTop: 6, fontFamily: F.heavy, fontSize: 10, color: muted },
    needle: { position: 'absolute', width: 68, height: 68, alignItems: 'center' },
    needleNorth: { position: 'absolute', top: 10, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: accent },
    needleSouth: { position: 'absolute', bottom: 10, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: line },
    needlePivot: { position: 'absolute', top: 30, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: accent },
    needleTip: { position: 'absolute', top: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5B83D' },
    qiblaTitle: { fontFamily: F.display, fontSize: 20, color: ink },
    qiblaSub: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: muted, marginTop: 3 },
    qiblaEm: { fontFamily: F.heavy, color: accent },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: { flex: 1, minHeight: 112, padding: 14, gap: 10, marginBottom: 0 },
    tileTitle: { fontFamily: F.bold, fontSize: 15, color: ink },
    tileSub: { fontFamily: F.body, fontSize: 12, lineHeight: 16, color: muted, marginTop: 2 },
    badge: {
      position: 'absolute',
      top: 10,
      right: 10,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: '#FF4D3D',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    badgeText: { fontFamily: F.heavy, fontSize: 11, color: '#FFFFFF' },
    soon: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14 },
    soonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    soonTitle: { fontFamily: F.display, fontSize: 18, color: ink },
    notify: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingLeft: 10, paddingRight: 12, borderRadius: 999, backgroundColor: tile },
    notifyOn: { backgroundColor: accent },
    notifyText: { fontFamily: F.bold, fontSize: 12, color: muted },
    soonGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
    soonItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: tile },
    soonItemTitle: { fontFamily: F.bold, fontSize: 13, color: ink },
    soonItemSub: { fontFamily: F.body, fontSize: 11, lineHeight: 14, color: muted, textAlign: 'center' },
    section: { marginTop: 8, marginBottom: 8, marginHorizontal: 6, fontFamily: F.bold, fontSize: 12, letterSpacing: 0.4, color: muted },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    settingTitle: { flex: 1, fontFamily: F.semi, fontSize: 15, color: ink },
    settingValue: { fontFamily: F.semi, fontSize: 13, color: muted },
    sw: { width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: 'rgba(95,107,122,0.35)' },
    swOn: { backgroundColor: accent },
    swKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: line },
    langOn: { backgroundColor: dark ? 'rgba(91,201,176,0.12)' : 'rgba(31,122,104,0.08)' },
    langText: { fontFamily: F.bold, fontSize: 14, color: ink },
    langSub: { flex: 1, fontFamily: F.body, fontSize: 12, color: muted },
    links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 },
    linkWrap: { flexDirection: 'row', alignItems: 'center' },
    link: { paddingVertical: 6, paddingHorizontal: 6 },
    linkText: { fontFamily: F.semi, fontSize: 13, color: muted },
    linkDot: { fontFamily: F.semi, fontSize: 13, color: muted },
    version: { textAlign: 'center', fontFamily: F.body, fontSize: 12, color: faint, marginTop: 2 },
    toast: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
    toastText: {
      overflow: 'hidden',
      fontFamily: F.semi,
      fontSize: 13,
      color: dark ? '#0F1F2E' : '#FFFFFF',
      backgroundColor: dark ? '#EAF1F7' : '#14232F',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 14,
      textAlign: 'center',
    },
  }
})
