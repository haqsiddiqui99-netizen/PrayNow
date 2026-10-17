/**
 * Sky artwork for PrayerHomeCard (sun, moon, clouds, mosque skyline, sun/fasting arcs),
 * drawn with plain Views so the dev build needs no SVG module.
 */
import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GradientFill } from '@/src/components/GradientFill';

/** `k` = cos(2πp): 1 at new moon, 0 at the quarters, -1 at full. Lit limb is on the right unless waning. */
export type MoonShape = { k: number; waning: boolean };

export function moonShape(p: number): MoonShape {
  return { k: Math.cos(2 * Math.PI * p), waning: p >= 0.5 };
}

const disc = (cx: number, cy: number, d: number, color: string): ViewStyle => ({
  position: 'absolute',
  left: cx - d / 2,
  top: cy - d / 2,
  width: d,
  height: d,
  borderRadius: d / 2,
  backgroundColor: color,
});

function mixHex(a: string, b: string, t: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `rgb(${c.join(',')})`;
}

/* -------------------------------------------------------------------------- */
/*  Sun                                                                        */
/* -------------------------------------------------------------------------- */
/** Many faint, closely spaced layers read as a soft radial glow instead of visible rings. */
const GLOW_SIZES = Array.from({ length: 24 }, (_, i) => 170 - i * 4.6);
const BODY_STEPS = Array.from({ length: 16 }, (_, i) => i / 15);

export const SunOrb = memo(function SunOrb({ cx, cy, opacity, c1, c2 }: { cx: number; cy: number; opacity: number; c1: string; c2: string }) {
  const x = useSharedValue(cx);
  const y = useSharedValue(cy);
  const o = useSharedValue(opacity);
  useEffect(() => {
    const cfg = { duration: 1100, easing: Easing.bezier(0.3, 0.7, 0.2, 1) };
    x.value = withTiming(cx, cfg);
    y.value = withTiming(cy, cfg);
    o.value = withTiming(opacity, { duration: 800 });
  }, [cx, cy, opacity, x, y, o]);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value - 85 }, { translateY: y.value - 85 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.orb, st]}>
      {GLOW_SIZES.map((d) => (
        <View key={d} style={[disc(85, 85, d, c2), { opacity: 0.035 }]} />
      ))}
      {BODY_STEPS.map((s) => (
        <View key={s} style={disc(85, 85, 58 - s * 34, mixHex(c1, c2, (1 - s) * (1 - s)))} />
      ))}
    </Animated.View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Moon                                                                       */
/* -------------------------------------------------------------------------- */
const MOON_ROWS = 28;
const CRATERS = [
  [-5, -6, 3.2],
  [6, 4, 4.2],
  [-8, 7, 2.4],
  [3, -11, 2],
  [10, -4, 1.7],
] as const;

/** Moon disc of diameter `size`: dark side plus the lit part for the real phase, built from thin rows. */
export const MoonDisc = memo(function MoonDisc({ shape, size, tiny }: { shape: MoonShape; size: number; tiny?: boolean }) {
  const r = size / 2;
  const lit = (1 - shape.k) / 2;
  const rows = useMemo(() => {
    if (lit < 0.012) return [];
    const h = size / MOON_ROWS;
    return Array.from({ length: MOON_ROWS }, (_, i) => {
      const y = -r + (i + 0.5) * h;
      const w = Math.sqrt(Math.max(0, r * r - y * y));
      const a = lit > 0.985 ? -r : shape.k * w;
      return { top: i * h, height: h + 0.6, left: shape.waning ? 0 : r + a, width: Math.max(0, r - a) };
    });
  }, [lit, r, size, shape.k, shape.waning]);
  const craters = useMemo(() => {
    if (tiny || lit < 0.012) return [];
    const sc = r / 18;
    return CRATERS.filter(([cx, cy]) => {
      const a = shape.k * Math.sqrt(Math.max(0, r * r - (cy * sc) ** 2));
      return shape.waning ? cx * sc < -a : cx * sc > a;
    }).map(([cx, cy, cr]) => disc(r + cx * sc, r + cy * sc, cr * 2 * sc, 'rgba(140,125,90,0.28)'));
  }, [tiny, lit, r, shape.k, shape.waning]);
  return (
    <View style={[styles.moon, { width: size, height: size, borderRadius: r, borderWidth: tiny ? 0.5 : 1 }]}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.moonRow, row]} />
      ))}
      {craters.map((c, i) => (
        <View key={`c${i}`} style={c} />
      ))}
    </View>
  );
});

export const MoonOrb = memo(function MoonOrb({ shape, illumination, opacity, cx }: { shape: MoonShape; illumination: number; opacity: number; cx: number }) {
  const o = useSharedValue(opacity);
  useEffect(() => {
    o.value = withTiming(opacity, { duration: 800 });
  }, [opacity, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.moonOrb,
        { left: cx - 20 },
        { shadowColor: '#FFF3CF', shadowOpacity: 0.25 + 0.5 * illumination, shadowRadius: 5 + 12 * illumination, shadowOffset: { width: 0, height: 0 } },
        st,
      ]}
    >
      <MoonDisc shape={shape} size={30} />
    </Animated.View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Cloud                                                                      */
/* -------------------------------------------------------------------------- */
const PUFFS = [
  [44, 38, 16],
  [72, 28, 22],
  [104, 34, 18],
  [130, 42, 13],
] as const;

export const Cloud = memo(function Cloud({ top, scale, duration, startFrac, width, color }: { top: number; scale: number; duration: number; startFrac: number; width: number; color: string }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(-190);
  useEffect(() => {
    cancelAnimation(x);
    const total = width + 210;
    x.value = -190 + startFrac * total;
    if (reduce) return;
    x.value = withSequence(
      withTiming(width + 20, { duration: duration * (1 - startFrac), easing: Easing.linear }),
      withRepeat(
        withSequence(withTiming(-190, { duration: 0 }), withTiming(width + 20, { duration, easing: Easing.linear })),
        -1,
        false,
      ),
    );
  }, [width, duration, startFrac, reduce, x]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scale }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.cloud, { top }, st]}>
      <View style={[styles.cloudBase, { backgroundColor: color }]} />
      {PUFFS.map(([cx, cy, r]) => (
        <View key={cx} style={disc(cx, cy, r * 2, color)} />
      ))}
    </Animated.View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Skyline (drawn in a 360x110 box, scaled to 84px tall, right-aligned)       */
/* -------------------------------------------------------------------------- */
const SKY_W = 360;
const SKY_H = 110;
const SKY_SCALE = 84 / SKY_H;

const SKY_RECTS = [
  [-400, 96, 760, 14],
  [-400, 86, 550, 14],
  [35, 66, 2, 8],
  [70, 80, 46, 20],
  [92, 62, 2, 8],
  [126, 46, 7, 54],
  [123.5, 62, 12, 3.5],
  [128.5, 26, 1.6, 9],
  [198, 74, 106, 30],
  [250, 12, 2, 18],
  [322, 38, 8, 62],
  [319, 58, 14, 3.5],
  [325.2, 14, 1.6, 12],
  [338, 82, 22, 18],
] as const;
/** [centre x, base y, radius x, radius y] */
const SKY_DOMES = [
  [36, 86, 12, 12],
  [93, 80, 11, 11],
  [251, 74, 47, 44],
  [204, 92, 22, 20],
  [298, 92, 22, 20],
  [349, 82, 9, 9],
] as const;
/** minaret caps: [left x, base y, width, height] */
const SKY_CAPS = [
  [125, 46, 9, 7],
  [321, 38, 10, 8],
] as const;

export const Skyline = memo(function Skyline({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.skyline}>
      {SKY_RECTS.map(([x, y, w, h], i) => (
        <View key={`r${i}`} style={{ position: 'absolute', left: x, top: y, width: w, height: h, backgroundColor: color }} />
      ))}
      {SKY_DOMES.map(([cx, base, rx, ry], i) => (
        <View key={`d${i}`} style={{ position: 'absolute', left: cx - rx, top: base - ry, width: rx * 2, height: ry, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: ry - rx,
              width: rx * 2,
              height: rx * 2,
              borderRadius: rx,
              backgroundColor: color,
              transform: [{ scaleY: ry / rx }],
            }}
          />
        </View>
      ))}
      {SKY_CAPS.map(([x, base, w, h], i) => (
        <View
          key={`c${i}`}
          style={{
            position: 'absolute',
            left: x,
            top: base - h,
            width: w,
            height: h,
            borderTopLeftRadius: w / 2,
            borderTopRightRadius: w / 2,
            backgroundColor: color,
          }}
        />
      ))}
      <View style={disc(251, 11, 6.4, color)} />
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*  Sun & fasting progress (drawn in a 92x42 box, scaled into 80x36)           */
/* -------------------------------------------------------------------------- */
const ARC_SCALE = 36 / 42;
const TRACK_DOTS = 13;

function ArcBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.arcBox}>
      <View style={styles.arcInner}>{children}</View>
    </View>
  );
}

function Knob({ x, y, color, halo, haloOpacity }: { x: number; y: number; color: string; halo: string; haloOpacity: number }) {
  return (
    <>
      <View style={[disc(x, y, 20, halo), { opacity: haloOpacity }]} />
      <View style={[disc(x, y, 10, color), styles.knob]} />
    </>
  );
}

export const SunArc = memo(function SunArc({ progress, line, faint }: { progress: number; line: string; faint: string }) {
  const at = (f: number) => {
    const th = Math.PI * (1 - f);
    return { x: 46 + 42 * Math.cos(th), y: 36 - 32 * Math.sin(th) };
  };
  const knob = at(progress);
  const fillDots = progress > 0.01 ? Math.max(2, Math.round(70 * progress)) : 0;
  return (
    <ArcBox>
      <View style={{ position: 'absolute', left: 0, top: 37.75, width: 92, height: 1.5, backgroundColor: line }} />
      {Array.from({ length: TRACK_DOTS }, (_, i) => {
        const p = at(i / (TRACK_DOTS - 1));
        return <View key={`t${i}`} style={[disc(p.x, p.y, 2, faint), { opacity: 0.6 }]} />;
      })}
      {Array.from({ length: fillDots }, (_, j) => {
        const f = j / (fillDots - 1);
        const p = at(progress * f);
        return <View key={`f${j}`} style={disc(p.x, p.y, 3, mixHex('#FFB020', '#FF6A3D', f))} />;
      })}
      <Knob x={knob.x} y={knob.y} color="#FFB020" halo="#FFB020" haloOpacity={0.25} />
    </ArcBox>
  );
});

export const FastLine = memo(function FastLine({ progress, faint }: { progress: number; faint: string }) {
  const fx = 4 + 84 * progress;
  return (
    <ArcBox>
      {Array.from({ length: TRACK_DOTS }, (_, i) => (
        <View key={i} style={[disc(4 + (84 * i) / (TRACK_DOTS - 1), 21, 2, faint), { opacity: 0.6 }]} />
      ))}
      {progress > 0.01 && (
        <View style={[styles.fastFill, { width: fx - 4 + 3 }]}>
          <GradientFill colors={['#8A94F5', '#4F5BD5']} steps={16} />
        </View>
      )}
      <Knob x={fx} y={21} color="#5B65C9" halo="#6B76E8" haloOpacity={0.22} />
    </ArcBox>
  );
});

const styles = StyleSheet.create({
  orb: { position: 'absolute', left: 0, top: 0, width: 170, height: 170 },
  moon: { overflow: 'hidden', backgroundColor: 'rgba(12,18,52,0.6)', borderColor: 'rgba(255,243,207,0.32)' },
  moonRow: { position: 'absolute', backgroundColor: '#FFF3CF' },
  moonOrb: { position: 'absolute', top: 26, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cloud: { position: 'absolute', left: 0, width: 170, height: 60 },
  cloudBase: { position: 'absolute', left: 22, top: 38, width: 118, height: 16, borderRadius: 8 },
  skyline: {
    position: 'absolute',
    width: SKY_W,
    height: SKY_H,
    right: -(SKY_W * (1 - SKY_SCALE)) / 2,
    bottom: -(SKY_H * (1 - SKY_SCALE)) / 2,
    transform: [{ scale: SKY_SCALE }],
  },
  arcBox: { width: 80, height: 36 },
  arcInner: {
    position: 'absolute',
    width: 92,
    height: 42,
    left: (80 - 92) / 2,
    top: (36 - 42) / 2,
    transform: [{ scale: ARC_SCALE }],
  },
  knob: { borderWidth: 2, borderColor: '#FFFFFF' },
  fastFill: { position: 'absolute', left: 2.5, top: 19.5, height: 3, borderRadius: 1.5, overflow: 'hidden' },
});
