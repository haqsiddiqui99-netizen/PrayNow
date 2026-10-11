import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { useEffect } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { useLocation } from '@/src/hooks/useLocation'
import { useQiblaCompass } from '@/src/hooks/useQiblaCompass'
import { formatBearingLabel, formatDistanceKm } from '@/src/utils/qibla'

const SIZE = 292
const TICKS = 72

const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Newsreader_600SemiBold',
}

function DialTicks({ major, minor }: { major: string; minor: string }) {
  return (
    <>
      {Array.from({ length: TICKS }, (_, i) => {
        const big = i % 6 === 0
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[styles.tickArm, { transform: [{ rotate: `${i * 5}deg` }] }]}>
            <View
              style={{
                width: big ? 2.5 : 1,
                height: big ? 18 : 8,
                marginTop: 10,
                borderRadius: 2,
                backgroundColor: big ? major : minor,
              }}
            />
          </View>
        )
      })}
    </>
  )
}

function AlignRing({ active, color }: { active: boolean; color: string }) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    if (!active) {
      cancelAnimation(opacity)
      opacity.value = withTiming(0, { duration: 200 })
      return
    }
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.35, { duration: 700 })),
      -1,
      false,
    )
    return () => cancelAnimation(opacity)
  }, [active, opacity])
  const ring = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View pointerEvents="none" style={[styles.alignRing, { borderColor: color }, ring]} />
}

export default function QiblaScreen() {
  const ui = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { location, loading: locLoading, refresh } = useLocation()
  const { heading, qiblaBearing, distanceKm, isAligned, turnDegrees, turnHint, compassReady, error } =
    useQiblaCompass(location.lat, location.lng)

  const dialRotation = heading != null ? -heading : 0
  const alignment =
    turnDegrees == null ? 0 : Math.max(0, Math.round((1 - Math.min(Math.abs(turnDegrees), 90) / 90) * 100))
  const tone = error ? colors.warning : isAligned ? colors.success : colors.primary

  return (
    <ScrollView
      style={ui.page}
      contentContainerStyle={[ui.content, { paddingTop: insets.top + 8, paddingBottom: tabBarHeight + 28 }]}
      showsVerticalScrollIndicator={false}>
      <View style={ui.header}>
        <Pressable onPress={() => router.back()} style={ui.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={ui.headerText}>
          <Text style={ui.eyebrow}>DIRECTION OF PRAYER</Text>
          <Text style={ui.title}>Qibla</Text>
        </View>
      </View>

      <View style={ui.place}>
        <Ionicons name="location-sharp" size={14} color={colors.primary} />
        <Text style={ui.placeText} numberOfLines={1}>
          {locLoading ? 'Finding your location…' : location.label}
        </Text>
      </View>

      <View style={[ui.status, { borderColor: isAligned ? colors.success : colors.border }]}>
        <View style={ui.statusTop}>
          <View style={[ui.statusDot, { backgroundColor: tone }]} />
          <Text style={[ui.statusText, { color: tone }]}>{error ? 'Compass needs attention' : turnHint}</Text>
        </View>
        <View style={ui.meterTrack}>
          <View style={[ui.meterFill, { width: `${alignment}%`, backgroundColor: tone }]} />
        </View>
        <Text style={ui.statusSub}>
          {isAligned
            ? 'The arrow is straight up. You are facing the Qibla.'
            : 'Hold the phone flat and turn until the arrow points straight up.'}
        </Text>
      </View>

      <View style={ui.stage}>
        <AlignRing active={isAligned} color={colors.success} />
        <View style={[ui.bezel, isAligned && { borderColor: colors.success }]}>
          <View style={ui.notch} />
          <View style={[ui.dial, { transform: [{ rotate: `${dialRotation}deg` }] }]}>
            <View style={ui.innerRing} />
            <DialTicks major={colors.textPrimary} minor={colors.border} />
            {(
              [
                ['N', 0],
                ['E', 90],
                ['S', 180],
                ['W', 270],
              ] as const
            ).map(([letter, deg]) => (
              <View key={letter} pointerEvents="none" style={[styles.tickArm, { transform: [{ rotate: `${deg}deg` }] }]}>
                <Text style={[ui.cardinal, letter === 'N' && ui.north, { transform: [{ rotate: `${-deg}deg` }] }]}>{letter}</Text>
              </View>
            ))}
            <View pointerEvents="none" style={[styles.tickArm, { transform: [{ rotate: `${qiblaBearing}deg` }] }]}>
              <View style={[ui.arrowTip, { borderBottomColor: isAligned ? colors.success : colors.accent }]} />
              <View style={[ui.arrowShaft, { backgroundColor: isAligned ? colors.success : colors.accent }]} />
              <View style={ui.arrowGap} />
              <View style={ui.arrowTail} />
            </View>
          </View>
          <View style={ui.hub}>
            <Text style={ui.hubValue}>{heading == null ? '—' : `${Math.round(heading)}°`}</Text>
            <Text style={ui.hubLabel}>HEADING</Text>
          </View>
          {!compassReady && !error && (
            <View style={ui.overlay}>
              <ActivityIndicator color={colors.primary} />
              <Text style={ui.overlayText}>Starting compass…</Text>
            </View>
          )}
        </View>
      </View>

      <View style={ui.stats}>
        <View style={ui.stat}>
          <Text style={ui.statLabel}>Bearing</Text>
          <Text style={ui.statValue}>{formatBearingLabel(qiblaBearing)}</Text>
        </View>
        <View style={ui.stat}>
          <Text style={ui.statLabel}>To Makkah</Text>
          <Text style={ui.statValue}>{formatDistanceKm(distanceKm)}</Text>
        </View>
        <View style={ui.stat}>
          <Text style={ui.statLabel}>Alignment</Text>
          <Text style={[ui.statValue, { color: tone }]}>{alignment}%</Text>
        </View>
      </View>

      {error ? (
        <View style={ui.errorBox}>
          <Text style={ui.errorText}>{error}</Text>
          <Pressable style={ui.retry} onPress={() => void refresh()} accessibilityRole="button">
            <Text style={ui.retryText}>Refresh location</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={ui.note}>Step away from metal, then move the phone in a figure-8 if the needle drifts.</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  tickArm: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
  },
  alignRing: {
    position: 'absolute',
    width: SIZE + 18,
    height: SIZE + 18,
    borderRadius: (SIZE + 18) / 2,
    borderWidth: 2,
  },
})

const useStyles = makeStyles(({ colors, shadows }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { paddingHorizontal: 18, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerText: { flex: 1 },
  eyebrow: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.4, color: colors.textMuted },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 38, color: colors.textPrimary, marginTop: 1 },
  place: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    maxWidth: '100%',
  },
  placeText: { fontFamily: F.semi, fontSize: 13.5, color: colors.primary, flexShrink: 1 },
  status: {
    width: '100%',
    backgroundColor: colors.surface2,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 18,
    ...shadows.soft,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontFamily: F.bold, fontSize: 16, lineHeight: 21 },
  meterTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surface1,
    marginTop: 10,
    overflow: 'hidden',
  },
  meterFill: { height: 6, borderRadius: 999 },
  statusSub: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 8 },
  stage: { width: SIZE + 18, height: SIZE + 18, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  bezel: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 10,
    borderColor: colors.primary,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  notch: {
    position: 'absolute',
    top: 6,
    zIndex: 5,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primaryDark,
  },
  dial: {
    width: SIZE - 28,
    height: SIZE - 28,
    borderRadius: (SIZE - 28) / 2,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerRing: {
    position: 'absolute',
    width: SIZE - 132,
    height: SIZE - 132,
    borderRadius: (SIZE - 132) / 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardinal: { marginTop: 32, fontFamily: F.bold, fontSize: 16, color: colors.textSecondary },
  north: { color: colors.accent },
  arrowTip: {
    marginTop: 8,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowShaft: { width: 5, height: 86, borderRadius: 3, marginTop: -1 },
  arrowGap: { height: 54 },
  arrowTail: { width: 4, height: 58, borderRadius: 3, backgroundColor: colors.textMuted, opacity: 0.55 },
  hub: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    ...shadows.soft,
  },
  hubValue: { fontFamily: F.bold, fontSize: 18, color: colors.textPrimary },
  hubLabel: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surfaceScrim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 6,
  },
  overlayText: { fontFamily: F.medium, fontSize: 13, color: colors.textSecondary },
  stats: { width: '100%', flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    ...shadows.soft,
  },
  statLabel: { fontFamily: F.medium, fontSize: 11.5, color: colors.textMuted },
  statValue: { fontFamily: F.bold, fontSize: 14, color: colors.textPrimary, marginTop: 4 },
  note: {
    marginTop: 16,
    fontFamily: F.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  errorBox: {
    width: '100%',
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    gap: 10,
  },
  errorText: { fontFamily: F.medium, color: colors.warningText, textAlign: 'center', lineHeight: 20 },
  retry: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: { fontFamily: F.bold, color: '#fff', fontSize: 14 },
}))
