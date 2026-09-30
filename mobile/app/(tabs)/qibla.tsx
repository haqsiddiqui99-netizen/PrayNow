import { useRouter } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useBottomTabBarHeight } from "expo-router/js-tabs"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon } from '@/src/components/AppIcon'
import { useLocation } from '@/src/hooks/useLocation'
import { useQiblaCompass } from '@/src/hooks/useQiblaCompass'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { formatBearingLabel, formatDistanceKm } from '@/src/utils/qibla'

const COMPASS_SIZE = 280

function Cardinal({ label, style, accent }: { label: string; style: object; accent?: boolean }) {
  const styles = useStyles()
  return (
    <Text style={[styles.cardinal, accent && styles.cardinalAccent, style]}>{label}</Text>
  )
}

export default function QiblaScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { location, loading: locLoading, refresh } = useLocation()
  const { heading, qiblaBearing, distanceKm, isAligned, turnHint, compassReady, error } =
    useQiblaCompass(location.lat, location.lng)

  const dialRotation = heading != null ? -heading : 0

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: tabBarHeight + 24 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <AppIcon name="compass" size={32} variant="menu" />
          <Text style={styles.title}>Qibla Direction</Text>
        </View>
      </View>

      <Text style={styles.intro}>Hold your phone flat and turn until the Kaaba marker aligns with the top notch.</Text>

      <View style={[styles.compassFrame, isAligned && styles.compassFrameAligned]}>
        <View style={styles.topNotch} />
        <View style={[styles.compassDial, { transform: [{ rotate: `${dialRotation}deg` }] }]}>
          <Cardinal label="N" style={styles.cardinalN} accent />
          <Cardinal label="E" style={styles.cardinalE} />
          <Cardinal label="S" style={styles.cardinalS} />
          <Cardinal label="W" style={styles.cardinalW} />

          <View style={styles.centerDot} />

          <View style={[styles.qiblaArm, { transform: [{ rotate: `${qiblaBearing}deg` }] }]}>
            <View style={styles.qiblaMarker}>
              <Text style={styles.kaabaEmoji}>🕋</Text>
              <View style={styles.qiblaLine} />
            </View>
          </View>
        </View>

        {!compassReady && !error && (
          <View style={styles.compassOverlay}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.overlayText}>Starting compass…</Text>
          </View>
        )}
      </View>

      <Text style={[styles.turnHint, isAligned && styles.turnHintAligned]}>{turnHint}</Text>

      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Qibla bearing</Text>
          <Text style={styles.statValue}>{formatBearingLabel(qiblaBearing)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Distance to Kaaba</Text>
          <Text style={styles.statValue}>{formatDistanceKm(distanceKm)}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Your location</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {locLoading ? 'Detecting…' : location.label}
          </Text>
        </View>
        {heading != null && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Device heading</Text>
            <Text style={styles.statValue}>{formatBearingLabel(heading)}</Text>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Refresh location</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>
          Move away from metal objects and figure‑8 calibrate your phone if the compass drifts.
        </Text>
      )}
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors, shadows }) => ({
  page: { flex: 1, backgroundColor: colors.surface0 },
  content: { paddingHorizontal: 20, alignItems: 'center' },
  headerRow: { width: '100%', marginBottom: 8 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  intro: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  compassFrame: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadows.card,
  },
  compassFrameAligned: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  topNotch: {
    position: 'absolute',
    top: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.accent,
    zIndex: 3,
  },
  compassDial: {
    width: COMPASS_SIZE - 16,
    height: COMPASS_SIZE - 16,
    borderRadius: (COMPASS_SIZE - 16) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardinal: {
    position: 'absolute',
    fontSize: 15,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  cardinalAccent: { color: colors.accent, fontSize: 17 },
  cardinalN: { top: 6, alignSelf: 'center' },
  cardinalE: { right: 8, top: '50%', marginTop: -10 },
  cardinalS: { bottom: 6, alignSelf: 'center' },
  cardinalW: { left: 8, top: '50%', marginTop: -10 },
  centerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    zIndex: 2,
  },
  qiblaArm: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  qiblaMarker: {
    alignItems: 'center',
    paddingTop: 18,
  },
  kaabaEmoji: { fontSize: 26, marginBottom: 2 },
  qiblaLine: {
    width: 5,
    height: 88,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  compassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceScrim,
    borderRadius: COMPASS_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 4,
  },
  overlayText: { color: colors.textSecondary, fontSize: 13 },
  turnHint: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  turnHintAligned: { color: colors.success },
  card: {
    width: '100%',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.soft,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statLabel: { color: colors.textSecondary, fontSize: 14, flexShrink: 0 },
  statValue: { fontWeight: '700', fontSize: 14, color: colors.textPrimary, flex: 1, textAlign: 'right' },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    width: '100%',
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: 10,
  },
  errorText: { color: colors.textPrimary, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
}))
