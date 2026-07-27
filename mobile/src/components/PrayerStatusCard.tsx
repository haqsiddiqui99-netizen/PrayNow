import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, shadows, timingTextStyle } from '@/src/constants/theme'
import type { LivePrayerInfo, PrayerStatusExtras } from '@/src/utils/prayerSchedule'
import {
  formatPrayerRakats,
  getPrayerRakats,
  shouldShowZawalUnderCurrent,
  shouldShowZawalUnderNext,
} from '@/src/utils/prayerSchedule'

type ExtraItem = PrayerStatusExtras['items'][number]
type NightTimings = NonNullable<PrayerStatusExtras['nightTimings']>

type ZawalInfo = { start: string; end: string }

const TIME_KEY_WIDTH = 36

function CompactTimeRow({ label, time }: { label: string; time: string }) {
  return (
    <View style={styles.compactTimeRow}>
      <Text style={styles.compactTimeKey}>{label}</Text>
      <Text style={styles.compactTimeDash}>-</Text>
      <Text style={styles.compactTimeVal} numberOfLines={1}>
        {time}
      </Text>
    </View>
  )
}

function NightTimeRow({ label, time }: { label: string; time: string }) {
  return (
    <View style={styles.nightTimeRow}>
      <Text style={styles.nightTimeLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.nightTimeDash}>-</Text>
      <Text style={styles.nightTimeVal} numberOfLines={1}>
        {time}
      </Text>
    </View>
  )
}

function NightTimingsBlock({ tahajjud, sehri }: NightTimings) {
  return (
    <View style={styles.nightTimingsRow}>
      <View style={styles.nightCol}>
        <NightTimeRow label="Tahajjud Start" time={tahajjud.start} />
        <NightTimeRow label="Tahajjud End" time={tahajjud.end} />
      </View>
      <View style={styles.nightCol}>
        <NightTimeRow label="Sehri Start" time={sehri.start} />
        <NightTimeRow label="Sehri End" time={sehri.end} />
      </View>
    </View>
  )
}

function TimingExtraItem({ item, compact = true }: { item: ExtraItem; compact?: boolean }) {
  return (
    <Text style={compact ? styles.timingText : styles.timingTextFull} numberOfLines={2}>
      {item.label} {item.value}
      {item.noPrayer ? <Text style={styles.noPrayer}> — No Prayer</Text> : null}
    </Text>
  )
}

function TimingExtrasLine({ items, compact = true }: { items: ExtraItem[]; compact?: boolean }) {
  return (
    <Text style={compact ? styles.timingText : styles.timingTextFull} numberOfLines={3}>
      {items.map((item, index) => (
        <Text key={item.id}>
          {index > 0 ? ' · ' : ''}
          {item.label} {item.value}
          {item.noPrayer ? <Text style={styles.noPrayer}> — No Prayer</Text> : null}
        </Text>
      ))}
    </Text>
  )
}

function CompactPrayerFooter({
  info,
  extras,
  zawal,
  compact = true,
}: {
  info: LivePrayerInfo
  extras: PrayerStatusExtras | null
  zawal: ZawalInfo
  compact?: boolean
}) {
  const zawalItem: ExtraItem = {
    id: 'zawal',
    label: 'Zawal',
    value: `${zawal.start} — ${zawal.end}`,
    noPrayer: info.inZawal,
  }
  const zawalLeft = shouldShowZawalUnderCurrent(info)
  const zawalRight = shouldShowZawalUnderNext(info)
  const extraItems = extras?.items ?? []
  const nightTimings = extras?.nightTimings ?? null
  const hasLeft = Boolean(nightTimings) || extraItems.length > 0 || zawalLeft
  const hasRight = zawalRight

  if (!hasLeft && !hasRight) return null

  return (
    <View style={styles.compactExtras}>
      {nightTimings ? <NightTimingsBlock {...nightTimings} /> : null}
      <View style={styles.compactExtrasRow}>
        <View style={styles.compactExtrasCol}>
          {extraItems.length > 0 ? <TimingExtrasLine items={extraItems} compact={compact} /> : null}
          {zawalLeft ? <TimingExtraItem item={zawalItem} compact={compact} /> : null}
        </View>
        <View style={styles.compactExtrasCol}>
          {zawalRight ? <TimingExtraItem item={zawalItem} compact={compact} /> : null}
        </View>
      </View>
    </View>
  )
}

function AlignedPrayerGrid({
  info,
  sunsetTime,
  showRakats = false,
}: {
  info: LivePrayerInfo
  sunsetTime?: string
  showRakats?: boolean
}) {
  const showSunset = info.current?.name === 'Asr' && Boolean(sunsetTime)

  return (
    <View style={styles.compactMain}>
      <View style={styles.countdownOverlay}>
        <Text style={styles.countdownText} numberOfLines={1}>
          ({info.next.countdown})
        </Text>
      </View>

      <View style={styles.compactCol}>
        {info.current ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.sectionLabel}>NOW</Text>
              <Text
                style={[styles.prayerName, styles.prayerNameCurrent]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}>
                {info.current.displayName.toUpperCase()}
              </Text>
            </View>
            <View style={styles.timesBlock}>
              <CompactTimeRow label="START" time={info.current.start} />
              <CompactTimeRow label="END" time={info.current.end} />
            </View>
            {showSunset && sunsetTime ? (
              <View style={styles.sunsetRow}>
                <NightTimeRow label="Sunset time" time={sunsetTime} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.sectionLabel}>NOW</Text>
            </View>
            <Text style={styles.compactIdle}>No active prayer</Text>
          </>
        )}

        {showRakats && info.current ? (
          <>
            <Text style={styles.rakats}>{formatPrayerRakats(getPrayerRakats(info.current.name))}</Text>
            {info.current.name === 'Fajr' ? (
              <Text style={styles.fajrNote}>(Namaz ends at End time)</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.compactDivider} />

      <View style={styles.compactCol}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionLabel}>NEXT</Text>
          <Text
            style={[styles.prayerName, styles.prayerNameNext]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {info.next.displayName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.timesBlock}>
          <CompactTimeRow label="START" time={info.next.start} />
          <CompactTimeRow label="END" time={info.next.end} />
        </View>

        {showSunset ? <View style={styles.sunsetSpacer} /> : null}
      </View>
    </View>
  )
}

export function PrayerStatusCard({
  info,
  extras,
  zawal,
  hijriDate,
  englishDate,
  sunsetTime,
  compact = false,
}: {
  info: LivePrayerInfo
  extras: PrayerStatusExtras | null
  zawal: ZawalInfo
  hijriDate?: string
  englishDate?: string
  sunsetTime?: string
  compact?: boolean
}) {
  const dateRow =
    hijriDate || englishDate ? (
      <View style={styles.dateRow}>
        {hijriDate ? <Text style={styles.dateHijri}>{hijriDate}</Text> : null}
        {hijriDate && englishDate ? <Text style={styles.dateDot}> · </Text> : null}
        {englishDate ? <Text style={styles.dateGregorian}>{englishDate}</Text> : null}
      </View>
    ) : null

  const cardStyle = compact ? styles.compactCard : styles.card

  return (
    <View style={cardStyle}>
      {dateRow}
      <AlignedPrayerGrid info={info} sunsetTime={sunsetTime} showRakats={!compact} />
      <CompactPrayerFooter info={info} extras={extras} zawal={zawal} compact={compact} />
    </View>
  )
}

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...shadows.soft,
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...shadows.card,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dateHijri: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  dateDot: {
    fontSize: 11,
    color: colors.textMuted,
  },
  dateGregorian: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  compactMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: -4,
    paddingTop: 12,
    position: 'relative',
  },
  compactCol: { flex: 1, minWidth: 0, alignItems: 'center' },
  compactDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: '50%',
    paddingLeft: 10,
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 20,
    marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prayerName: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  prayerNameCurrent: { color: colors.primary },
  prayerNameNext: { color: colors.textPrimary },
  countdownText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    alignSelf: 'flex-end',
    width: '100%',
  },
  timesBlock: { gap: 2, alignSelf: 'center' },
  compactTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 14,
  },
  compactTimeKey: {
    width: TIME_KEY_WIDTH,
    ...timingTextStyle,
    letterSpacing: 0.2,
    textAlign: 'left',
  },
  compactTimeDash: {
    width: 8,
    ...timingTextStyle,
    textAlign: 'center',
  },
  compactTimeVal: {
    ...timingTextStyle,
    textAlign: 'left',
  },
  sunsetRow: {
    marginTop: 4,
  },
  sunsetSpacer: {
    minHeight: 14,
    marginTop: 4,
  },
  compactIdle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  timingText: timingTextStyle,
  timingTextFull: timingTextStyle,
  noPrayer: {
    color: colors.accent,
    fontWeight: '800',
  },
  compactExtras: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  compactExtrasRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  compactExtrasCol: { flex: 1, minWidth: 0 },
  nightTimingsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  nightCol: { flex: 1, minWidth: 0, gap: 2 },
  nightTimeRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  nightTimeLabel: {
    flex: 1,
    minWidth: 0,
    ...timingTextStyle,
    textAlign: 'left',
  },
  nightTimeDash: {
    width: 8,
    ...timingTextStyle,
    textAlign: 'center',
  },
  nightTimeVal: {
    flexShrink: 0,
    ...timingTextStyle,
    textAlign: 'right',
    paddingLeft: 4,
  },
  rakats: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 6 },
  fajrNote: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
})
