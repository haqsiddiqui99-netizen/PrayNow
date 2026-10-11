import { memo, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba {
  const v = value.trim()
  if (v.startsWith('#')) {
    const hex = v.slice(1)
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
    const n = parseInt(full.slice(0, 6), 16)
    const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
  }
  const m = v.match(/rgba?\(([^)]+)\)/i)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  return [0, 0, 0, 1]
}

function mix(a: Rgba, b: Rgba, t: number): string {
  const c = a.map((x, i) => x + (b[i] - x) * t)
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`
}

/**
 * Linear gradient drawn with plain Views, so it needs no native module and runs
 * in any existing dev build. `vertical` stacks bands top to bottom; otherwise
 * they run left to right.
 */
export const GradientFill = memo(function GradientFill({
  colors,
  vertical = false,
  steps = 28,
  style,
}: {
  colors: readonly string[]
  vertical?: boolean
  steps?: number
  style?: StyleProp<ViewStyle>
}) {
  const bands = useMemo(() => {
    const stops = colors.map(parseColor)
    if (stops.length === 1) return [mix(stops[0], stops[0], 0)]
    const out: string[] = []
    for (let i = 0; i < steps; i++) {
      const pos = (i / (steps - 1)) * (stops.length - 1)
      const idx = Math.min(stops.length - 2, Math.floor(pos))
      out.push(mix(stops[idx], stops[idx + 1], pos - idx))
    }
    return out
  }, [colors, steps])

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { flexDirection: vertical ? 'column' : 'row' }, style]}>
      {bands.map((color, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: color,
            marginLeft: !vertical && i > 0 ? -1 : 0,
            marginTop: vertical && i > 0 ? -1 : 0,
          }}
        />
      ))}
    </View>
  )
})
