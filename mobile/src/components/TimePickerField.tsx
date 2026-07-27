import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { colors } from '@/src/constants/theme'
import {
  formatClockTime,
  HOURS_12,
  MINUTES_60,
  parseClockTime,
  type ClockParts,
  type Meridiem,
} from '@/src/utils/clockTime'

const ITEM_H = 36
const VISIBLE = 5
const PAD = ((VISIBLE - 1) / 2) * ITEM_H
/** How many copies of the list — enough to feel endless while scrolling. */
const LOOPS = 50
const PERIODS: Meridiem[] = ['AM', 'PM']

type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** half = 2-up, third = 3-up, inline = compact cell in a single-line row */
  layout?: 'half' | 'third' | 'inline'
  /** Hide field label (use column header instead). */
  hideLabel?: boolean
}

function buildLoopData<T>(data: T[]): T[] {
  const out: T[] = []
  for (let i = 0; i < LOOPS; i += 1) out.push(...data)
  return out
}

function midOffset(dataLength: number, indexInCycle: number) {
  const midLoop = Math.floor(LOOPS / 2)
  return (midLoop * dataLength + indexInCycle) * ITEM_H
}

function WheelColumn<T extends string | number>({
  data,
  selected,
  onSelect,
  format = String,
  width = 56,
  loop = true,
}: {
  data: T[]
  selected: T
  onSelect: (v: T) => void
  format?: (v: T) => string
  width?: number
  loop?: boolean
}) {
  const ref = useRef<ScrollView>(null)
  const ready = useRef(false)
  const lastEmitted = useRef<T>(selected)
  const cycleLen = data.length
  const items = loop ? buildLoopData(data) : data
  const selectedIndex = Math.max(0, data.indexOf(selected))

  const scrollToY = useCallback((y: number, animated: boolean) => {
    ref.current?.scrollTo({ y, animated })
  }, [])

  // Place in the middle copy so user can roll either direction forever.
  useEffect(() => {
    const y = loop ? midOffset(cycleLen, selectedIndex) : selectedIndex * ITEM_H
    const id = requestAnimationFrame(() => {
      scrollToY(y, false)
      ready.current = true
      lastEmitted.current = selected
    })
    return () => cancelAnimationFrame(id)
    // Only re-center when picker opens / selected jumps from outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready.current) return
    if (selected === lastEmitted.current) return
    // External value change (rare) — re-center quietly
    const y = loop ? midOffset(cycleLen, Math.max(0, data.indexOf(selected))) : selectedIndex * ITEM_H
    scrollToY(y, false)
    lastEmitted.current = selected
  }, [selected, cycleLen, data, loop, scrollToY, selectedIndex])

  const settle = (rawY: number) => {
    const maxY = (items.length - 1) * ITEM_H
    const y = Math.min(maxY, Math.max(0, rawY))
    const absIndex = Math.round(y / ITEM_H)
    const cycleIndex = ((absIndex % cycleLen) + cycleLen) % cycleLen
    const value = data[cycleIndex]!

    if (loop) {
      // Snap to nearest item, then if near either end jump back to middle copy (no animation).
      const snappedY = absIndex * ITEM_H
      scrollToY(snappedY, true)

      const loopIndex = Math.floor(absIndex / cycleLen)
      const nearEdge = loopIndex <= 1 || loopIndex >= LOOPS - 2
      if (nearEdge) {
        const recenterY = midOffset(cycleLen, cycleIndex)
        // After snap settles, teleport to middle so rolling never hits a wall.
        setTimeout(() => scrollToY(recenterY, false), 160)
      }
    } else {
      scrollToY(absIndex * ITEM_H, true)
    }

    if (value !== lastEmitted.current) {
      lastEmitted.current = value
      onSelect(value)
    }
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(e.nativeEvent.contentOffset.y)
  }

  const onDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // If velocity is ~0, momentum end may not fire — settle here too.
    const vy = e.nativeEvent.velocity?.y ?? 0
    if (Math.abs(vy) < 0.15) settle(e.nativeEvent.contentOffset.y)
  }

  return (
    <View style={[styles.wheelCol, { width }]}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 0.998 : 0.985}
        nestedScrollEnabled
        bounces
        overScrollMode="never"
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onDragEnd}
        contentContainerStyle={{ paddingVertical: PAD }}>
        {items.map((item, i) => (
          <View key={`${String(item)}-${i}`} style={styles.wheelItem} pointerEvents="none">
            <Text style={styles.wheelText}>{format(item)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

/**
 * Compact iPhone-alarm style rolling time picker with infinite hour/minute wheels.
 */
export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  layout = 'half',
  hideLabel = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ClockParts>(() => parseClockTime(value))
  const [pickerKey, setPickerKey] = useState(0)

  const openPicker = () => {
    setDraft(parseClockTime(value))
    setPickerKey((k) => k + 1) // remount wheels centered on current value
    setOpen(true)
  }

  const confirm = () => {
    onChange(formatClockTime(draft))
    setOpen(false)
  }

  return (
    <View
      style={[
        styles.field,
        layout === 'third' && styles.fieldThird,
        layout === 'inline' && styles.fieldInline,
      ]}>
      {!hideLabel && layout !== 'inline' ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.trigger, layout === 'inline' && styles.triggerInline]}
        onPress={openPicker}>
        <Text
          style={[
            styles.triggerText,
            layout === 'inline' && styles.triggerTextInline,
            !value && styles.placeholder,
          ]}
          numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.dismiss} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.toolbar}>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Text style={styles.toolbarCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.toolbarTitle}>{label}</Text>
              <Pressable onPress={confirm} hitSlop={10}>
                <Text style={styles.toolbarDone}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.pickerCard}>
              <View style={styles.fadeTop} pointerEvents="none" />
              <View style={styles.fadeBottom} pointerEvents="none" />
              <View style={styles.hairlineTop} pointerEvents="none" />
              <View style={styles.hairlineBottom} pointerEvents="none" />
              <View style={styles.wheels} key={pickerKey}>
                <WheelColumn
                  data={HOURS_12}
                  selected={draft.hour}
                  onSelect={(hour) => setDraft((d) => ({ ...d, hour }))}
                  width={64}
                  loop
                />
                <WheelColumn
                  data={MINUTES_60}
                  selected={draft.minute}
                  onSelect={(minute) => setDraft((d) => ({ ...d, minute }))}
                  format={(m) => String(m).padStart(2, '0')}
                  width={64}
                  loop
                />
                <WheelColumn
                  data={PERIODS}
                  selected={draft.period}
                  onSelect={(period) => setDraft((d) => ({ ...d, period }))}
                  width={72}
                  loop={false}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { width: '47%', flexGrow: 1 },
  fieldThird: { width: '31%', flexGrow: 1, flexBasis: '30%' },
  fieldInline: { width: undefined, flex: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 },
  label: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  trigger: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 11,
    backgroundColor: colors.surface0,
  },
  triggerInline: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  triggerTextInline: {
    fontSize: 12,
    fontWeight: '700',
  },
  placeholder: { color: colors.textMuted, fontWeight: '500' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#f2f2f7',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 10,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
    backgroundColor: '#f9f9fb',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  toolbarCancel: { fontSize: 16, color: colors.primary, fontWeight: '400' },
  toolbarTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  toolbarDone: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  pickerCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
  },
  wheels: {
    height: ITEM_H * VISIBLE,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  hairlineTop: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: PAD,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.29)',
    zIndex: 3,
  },
  hairlineBottom: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: PAD + ITEM_H,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,60,67,0.29)',
    zIndex: 3,
  },
  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: PAD,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PAD,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  wheelCol: {
    height: ITEM_H * VISIBLE,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 22,
    fontWeight: '400',
    color: '#000',
    fontVariant: ['tabular-nums'],
  },
})
