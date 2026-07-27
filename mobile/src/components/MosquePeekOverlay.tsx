import { useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FacilitiesLine } from '@/src/components/FacilitiesLine'
import { GoogleMapsButton } from '@/src/components/GoogleMapsButton'
import { MosqueTimingsGrid } from '@/src/components/MosqueTimingsGrid'
import { colors, radius } from '@/src/constants/theme'
import type { Mosque, TravelMode } from '@/src/types'
import { getCurrentPrayerForMosques } from '@/src/utils/prayerSchedule'
import { formatCapacity } from '@/src/utils/mosqueSort'
import { getTravelMinutes } from '@/src/utils/travelTime'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export function MosquePeekOverlay({
  mosque,
  travelMode,
  visible,
  onClose,
  onViewFull,
}: {
  mosque: Mosque | null
  travelMode: TravelMode
  visible: boolean
  onClose: () => void
  onViewFull?: (mosque: Mosque) => void
}) {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const dragY = useRef(new Animated.Value(0)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const closingRef = useRef(false)

  const dismiss = () => {
    if (closingRef.current) return
    closingRef.current = true
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      closingRef.current = false
      onClose()
    })
  }

  useEffect(() => {
    if (visible && mosque) {
      dragY.setValue(0)
      slideAnim.setValue(SCREEN_HEIGHT)
      backdropOpacity.setValue(0)
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start()
    }
  }, [visible, mosque, slideAnim, backdropOpacity, dragY])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.75) {
          dismiss()
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start()
        }
      },
    }),
  ).current

  if (!mosque) return null

  const currentPrayer = getCurrentPrayerForMosques()
  const travelMinutes = getTravelMinutes(mosque, travelMode)
  const sheetTranslate = Animated.add(slideAnim, dragY)

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropWrap, { opacity: backdropOpacity }]}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close preview" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY: sheetTranslate }],
            },
          ]}>
          <View {...panResponder.panHandlers} style={styles.handleZone}>
            <View style={styles.handle} />
          </View>

          <View style={styles.hero}>
            <Ionicons name="moon" size={56} color="#fff" />
            <View style={styles.heroGlow} />
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.name}>{mosque.name}</Text>
            <Text style={styles.address}>{mosque.address}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="star" size={11} color="#f59e0b" />
                <Text style={styles.metaChipText}>{mosque.rating.toFixed(1)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{mosque.distance} km</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{formatCapacity(mosque.capacity)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="car-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{travelMinutes} min</Text>
              </View>
            </View>

            <FacilitiesLine facilities={mosque.facilities} max={6} />

            <Text style={styles.sectionLabel}>Prayer times</Text>
            <MosqueTimingsGrid mosque={mosque} currentPrayer={currentPrayer?.name ?? null} />

            {mosque.imam ? (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.detailLine}>Imam: {mosque.imam}</Text>
              </View>
            ) : null}
            {mosque.phone ? (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.detailLine}>{mosque.phone}</Text>
              </View>
            ) : null}

            {mosque.events.slice(0, 2).map((event) => (
              <View key={event} style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.eventLine}>{event}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            {onViewFull ? (
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  onViewFull(mosque)
                  dismiss()
                }}>
                <Text style={styles.primaryBtnText}>View full details</Text>
              </Pressable>
            ) : null}
            <GoogleMapsButton mosque={mosque} travelMode={travelMode} variant="button" />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdropWrap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  handleZone: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  hero: {
    height: 140,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  body: { paddingHorizontal: 18, paddingTop: 16, maxHeight: SCREEN_HEIGHT * 0.42 },
  name: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4 },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  detailLine: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', flexShrink: 1 },
  eventLine: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  actions: { paddingHorizontal: 18, paddingTop: 12, gap: 8 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
