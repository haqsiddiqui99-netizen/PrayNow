import { Text, View } from 'react-native'
import { radius } from '@/src/constants/theme'
import { makeStyles } from '@/src/context/ThemeContext'

/** Clock-style h:mm:ss, padded so the width holds steady as seconds tick. */
function digital(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = String(totalSeconds % 60).padStart(2, '0')
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${secs}`
  return `${mins}:${secs}`
}

/**
 * Time left in the running prayer window, sized to sit inline with the other
 * chips instead of taking a column of its own. The pill is its own progress
 * track: the fill drains from full to empty as the window closes.
 */
export function CountdownPill({
  progress,
  secondsLeft,
  label,
  urgent = false,
  accessibilityLabel,
}: {
  /** Share (0–1) of the window already elapsed. */
  progress: number
  secondsLeft: number
  /** Optional trailing word, e.g. "left". Omit for a bare digital readout. */
  label?: string
  urgent?: boolean
  accessibilityLabel: string
}) {
  const styles = useStyles()

  const remaining = Math.max(0, Math.min(1, 1 - progress))

  return (
    <View
      style={styles.pill}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <View
        style={[styles.fill, urgent && styles.fillUrgent, { width: `${remaining * 100}%` }]}
      />
      <Text style={[styles.time, urgent && styles.timeUrgent]} numberOfLines={1}>
        {digital(secondsLeft)}
      </Text>
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentSoft,
  },
  // The drained track stays readable behind the text, so urgency is carried by a
  // solid fill rather than by recolouring the label.
  fillUrgent: { backgroundColor: colors.accent },
  time: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  timeUrgent: { fontWeight: '700' },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.accent,
  },
}))
