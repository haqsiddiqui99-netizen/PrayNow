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
 * Neutral time-left chip, the same dark pill as the home radius control.
 */
export function CountdownPill({
  secondsLeft,
  label,
  accessibilityLabel,
}: {
  secondsLeft: number
  /** Optional trailing word, e.g. "left". Omit for a bare digital readout. */
  label?: string
  accessibilityLabel: string
}) {
  const styles = useStyles()

  return (
    <View style={styles.pill} accessibilityRole="timer" accessibilityLabel={accessibilityLabel}>
      <Text style={styles.time} numberOfLines={1}>
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
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.selectedBg,
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.selectedText,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.selectedText,
  },
}))
