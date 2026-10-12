/**
 * AI Guide page: orb header, slow glow background, question pills, spacious answers
 * (bold / bullets / numbered steps), sources, share, "Ask next" follow-ups, topic chips with a
 * question sheet, and an ask bar with send / stop.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  type KeyboardEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { transcribeQuestion } from '@/src/services/islamicChat'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'

/* ========================================================================== */
/*  Tokens                                                                     */
/* ========================================================================== */
type Palette = {
  bg: string
  card: string
  ink: string
  text: string
  muted: string
  faint: string
  line: string
  soft: string
  v1: string
  v2: string
  v3: string
  badge: string
  warn: string
  chip: string
  chipText: string
  srcText: string
  panel: string
  select: string
  onSelect: string
  userBg: string
  onUser: string
  sendOff: string
  onSendOff: string
  scrim: string
  voice: string
  glowA: string
  glowB: string
  glowC: string
  glowOpacity: number
}

const LIGHT: Palette = {
  bg: '#F5F4F0',
  card: '#FFFFFF',
  ink: '#141414',
  text: '#1A1A1A',
  muted: '#6B7280',
  faint: '#9CA3AF',
  line: '#E6E4DE',
  soft: '#EFEEE9',
  v1: '#B3A7FF',
  v2: '#7D6CF2',
  v3: '#5A47D8',
  badge: '#ECE9FF',
  warn: '#B34100',
  chip: '#FFFFFF',
  chipText: '#33333B',
  srcText: '#3A3A44',
  panel: '#FFFFFF',
  select: '#141414',
  onSelect: '#FFFFFF',
  userBg: '#141414',
  onUser: '#FFFFFF',
  sendOff: '#D6D4CE',
  onSendOff: '#FFFFFF',
  scrim: 'rgba(20, 16, 40, 0.28)',
  voice: '#128C7E',
  glowA: '#9680FF',
  glowB: '#C4B4FF',
  glowC: '#FFD6BE',
  glowOpacity: 0.1,
}

const DARK: Palette = {
  bg: '#0C1020',
  card: '#16182A',
  ink: '#F6F3EC',
  text: '#E7E2F4',
  muted: '#A39BB8',
  faint: '#7E7694',
  line: 'rgba(230,224,255,0.12)',
  soft: '#241F38',
  v1: '#C4B4FF',
  v2: '#C4B6FF',
  v3: '#DDD6FF',
  badge: 'rgba(179,167,255,0.18)',
  warn: '#F0B15A',
  chip: '#1A1830',
  chipText: '#E8E4F4',
  srcText: '#E8E4F4',
  panel: '#141628',
  select: '#E8E0FF',
  onSelect: '#1A1433',
  userBg: '#E8E0FF',
  onUser: '#1A1433',
  sendOff: '#2A2740',
  onSendOff: '#8A84A8',
  scrim: 'rgba(0, 0, 0, 0.55)',
  voice: '#C4B6FF',
  glowA: '#7C5CFF',
  glowB: '#9B86FF',
  glowC: '#C47A62',
  glowOpacity: 0.22,
}

function useColors() {
  const { mode } = useTheme()
  return mode === 'dark' ? DARK : LIGHT
}
const F = {
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  heavy: 'Figtree_800ExtraBold',
  display: 'Newsreader_600SemiBold',
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name']

const WAVE_BARS = 32
const flatWave = () => Array.from({ length: WAVE_BARS }, () => 0.12)

function voiceLevel(metering?: number) {
  if (metering == null) return 0.12
  if (metering <= -50) return 0.12
  return Math.min(1, (metering + 50) / 42)
}

function RecDot() {
  const styles = useStyles()
  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 520 }), withTiming(1, { duration: 520 })),
      -1,
      false,
    )
    return () => cancelAnimation(pulse)
  }, [pulse])
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }))
  return <Animated.View style={[styles.recDot, style]} />
}

function voiceClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */
export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** Resolves with the full answer for the conversation, which ends on the user's question. */
export type AskFn = (messages: ChatTurn[]) => Promise<string>

type Msg = {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: 'thinking' | 'done' | 'error'
}

export type Topic = { key: string; name: string; icon: IconName; questions: string[] }

export const TOPICS: Topic[] = [
  { key: 'quran', name: 'Quran', icon: 'book-open-page-variant-outline', questions: ['What is Surah Al-Fatiha about?', 'How should I start reading the Quran?', 'What is the virtue of Ayat al-Kursi?', 'What are Makki and Madani surahs?'] },
  { key: 'hadith', name: 'Hadees', icon: 'format-quote-close', questions: ['What does “Sahih” mean in Hadith?', 'What are the Six Books of Hadith?', 'What is a Hadith Qudsi?', 'What did the Prophet ﷺ say about kindness?'] },
  { key: 'namaz', name: 'Namaz', icon: 'hands-pray', questions: ['When can I pray Dhuhr after Zawal?', 'How do I make up missed prayers?', 'What breaks wudu?', 'How do I pray while traveling?'] },
  { key: 'roza', name: 'Roza', icon: 'coffee-outline', questions: ['Who is exempt from fasting?', 'What breaks the fast?', 'How do I make up missed fasts?', 'What are the etiquettes of Sehri and Iftar?'] },
  { key: 'zakat', name: 'Zakat', icon: 'heart-outline', questions: ['What is the difference between Zakat and Sadaqah?', 'What is Nisab?', 'Who can receive Zakat?', 'When is Zakat al-Fitr due?'] },
  { key: 'halal', name: 'Halal & Haram', icon: 'check-circle-outline', questions: ['What makes meat halal?', 'How do I check if a product is halal?', 'What is riba?', 'Are alcohol-free products halal?'] },
  { key: 'basics', name: 'Basics', icon: 'star-four-points-outline', questions: ['What are the five pillars of Islam?', 'What is Wudu and how is it done?', 'What are the six articles of faith?', 'What does Islam teach about patience (sabr)?'] },
]

/* ========================================================================== */
/*  Answer parsing + tiny markdown                                             */
/* ========================================================================== */
export function parseAnswer(raw: string): { text: string; sources: string[]; follow: string[] } {
  const f = raw.search(/\n?[ \t]*FOLLOWUPS:/i)
  const s = raw.search(/\n?[ \t]*SOURCES:/i)
  const cuts = [f, s].filter((i) => i >= 0).sort((a, b) => a - b)
  const text = (cuts.length ? raw.slice(0, cuts[0]) : raw).trim()
  const sm = raw.match(/SOURCES:[ \t]*(.+)/i)
  const fm = raw.match(/FOLLOWUPS:[ \t]*(.+)/i)
  const sources = sm && !/^none/i.test(sm[1].trim()) ? sm[1].split(/;\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 3) : []
  const follow = fm ? fm[1].split('|').map((x) => x.trim()).filter(Boolean).slice(0, 2) : []
  return { text, sources, follow }
}

type Block = { t: 'p'; s: string } | { t: 'ul' | 'ol'; items: string[] }

function toBlocks(text: string): Block[] {
  const out: Block[] = []
  let para: string[] = []
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null
  const flushP = () => {
    if (para.length) out.push({ t: 'p', s: para.join(' ') })
    para = []
  }
  const flushL = () => {
    if (list) out.push(list)
    list = null
  }
  text.split('\n').forEach((raw) => {
    const l = raw.trim()
    if (!l) {
      flushP()
      flushL()
      return
    }
    const ul = l.match(/^[-•*]\s+(.*)/)
    const ol = l.match(/^\d+[.)]\s+(.*)/)
    if (ul) {
      flushP()
      if (!list || list.t !== 'ul') {
        flushL()
        list = { t: 'ul', items: [] }
      }
      list.items.push(ul[1])
    } else if (ol) {
      flushP()
      if (!list || list.t !== 'ol') {
        flushL()
        list = { t: 'ol', items: [] }
      }
      list.items.push(ol[1])
    } else {
      flushL()
      para.push(l)
    }
  })
  flushP()
  flushL()
  return out
}

const Inline = ({ s }: { s: string }) => {
  const styles = useStyles()
  return (
  <>
    {s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      ),
    )}
  </>
  )
}

const Rich = memo(function Rich({ text }: { text: string }) {
  const styles = useStyles()
  const blocks = useMemo(() => toBlocks(text), [text])
  return (
    <View>
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1
        if (b.t === 'p') {
          return (
            <Text key={i} style={[styles.ans, !last && styles.gapP]}>
              <Inline s={b.s} />
            </Text>
          )
        }
        return (
          <View key={i} style={!last && styles.gapP}>
            {b.items.map((it, j) => (
              <View key={j} style={[styles.li, j < b.items.length - 1 && styles.gapLi]}>
                {b.t === 'ol' ? (
                  <View style={styles.num}>
                    <Text style={styles.numText}>{j + 1}</Text>
                  </View>
                ) : (
                  <View style={styles.bulletWrap}>
                    <View style={styles.bullet} />
                  </View>
                )}
                <Text style={[styles.ans, { flex: 1 }]}>
                  <Inline s={it} />
                </Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
})

/* ========================================================================== */
/*  Background glow (slow drift)                                               */
/* ========================================================================== */
const GLOW_RINGS = [1, 0.86, 0.72, 0.58, 0.44, 0.3]

const GlowBlob = memo(function GlowBlob({
  size,
  color,
  style,
  dx,
  dy,
  duration,
  opacity = 0.1,
}: {
  size: number
  color: string
  style: object
  dx: number
  dy: number
  duration: number
  opacity?: number
}) {
  const reduce = useReducedMotion()
  const p = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    p.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true)
    return () => cancelAnimation(p)
  }, [duration, p, reduce])
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * dx }, { translateY: p.value * dy }, { scale: 1 + p.value * 0.1 }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, st]}>
      {GLOW_RINGS.map((f) => {
        const d = size * f
        return (
          <View
            key={f}
            style={{
              position: 'absolute',
              left: (size - d) / 2,
              top: (size - d) / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity,
            }}
          />
        )
      })}
    </Animated.View>
  )
})

const Glow = memo(function Glow() {
  const styles = useStyles()
  const colors = useColors()
  return (
    <View pointerEvents="none" style={styles.glow}>
      <GlowBlob size={380} color={colors.glowA} opacity={colors.glowOpacity} style={{ right: -120, top: -130 }} dx={-26} dy={18} duration={10000} />
      <GlowBlob size={330} color={colors.glowB} opacity={colors.glowOpacity} style={{ left: -130, top: -110 }} dx={30} dy={10} duration={13000} />
      <GlowBlob size={260} color={colors.glowC} opacity={colors.glowOpacity} style={{ left: '28%', top: 10 }} dx={20} dy={-14} duration={15000} />
    </View>
  )
})

/* ========================================================================== */
/*  Small pieces                                                               */
/* ========================================================================== */
const Dot = memo(function Dot({ delay }: { delay: number }) {
  const styles = useStyles()
  const reduce = useReducedMotion()
  const v = useSharedValue(0)
  useEffect(() => {
    if (reduce) return
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 500 })), -1, false))
    return () => cancelAnimation(v)
  }, [delay, reduce, v])
  const st = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65, transform: [{ translateY: -5 * v.value }] }))
  return <Animated.View style={[styles.dot, st]} />
})

const Dots = memo(function Dots() {
  const styles = useStyles()
  return (
    <View style={styles.thinking} accessibilityLabel="Thinking">
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
      <Text style={styles.thinkingText}>Thinking…</Text>
    </View>
  )
})

const QuestionLine = memo(function QuestionLine({ q, onPress, last }: { q: string; onPress: (q: string) => void; last?: boolean }) {
  const styles = useStyles()
  const colors = useColors()
  return (
    <Pressable
      onPress={() => onPress(q)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.line, !last && styles.lineBorder, pressed && { opacity: 0.6 }]}>
      <Text style={styles.lineText}>{q}</Text>
      <MaterialCommunityIcons name="arrow-top-right" size={19} color={colors.faint} />
    </Pressable>
  )
})

/* ========================================================================== */
/*  Messages                                                                   */
/* ========================================================================== */
const AssistantMessage = memo(function AssistantMessage({
  msg,
  onAsk,
  onShare,
}: {
  msg: Msg
  onAsk: (q: string) => void
  onShare: (text: string) => void
}) {
  const styles = useStyles()
  const colors = useColors()
  const { text, sources, follow } = useMemo(() => parseAnswer(msg.text), [msg.text])
  if (msg.status === 'thinking') return <Dots />
  const done = msg.status === 'done'
  return (
    <Animated.View entering={FadeInDown.duration(260)}>
      {msg.status === 'error' ? (
        <Text style={[styles.ans, { color: colors.warn, fontFamily: F.semi }]}>{text || 'Sorry, I couldn’t get an answer just now.'}</Text>
      ) : (
        <Rich text={text || '…'} />
      )}

      {done && sources.length > 0 && (
        <View style={styles.srcs}>
          <Text style={styles.lab}>Sources</Text>
          <View style={styles.chips}>
            {sources.map((s) => (
              <View key={s} style={styles.srcChip}>
                <MaterialCommunityIcons name="book-outline" size={15} color={colors.v2} />
                <Text style={styles.srcText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {done && (
        <Pressable onPress={() => onShare(text)} accessibilityRole="button" accessibilityLabel="Share answer" style={styles.copy}>
          <MaterialCommunityIcons name="share-variant-outline" size={16} color={colors.muted} />
          <Text style={styles.copyText}>Share</Text>
        </Pressable>
      )}

      {done && follow.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={[styles.lab, { marginBottom: 2 }]}>Ask next</Text>
          {follow.map((q, i) => (
            <QuestionLine key={q} q={q} onPress={onAsk} last={i === follow.length - 1} />
          ))}
        </View>
      )}
    </Animated.View>
  )
})

/* ========================================================================== */
/*  Screen                                                                     */
/* ========================================================================== */
export type AIGuideScreenProps = {
  ask: AskFn
  topics?: Topic[]
  /** Space under the ask bar for a tab bar that overlaps the screen. */
  bottomInset?: number
}

let idCounter = 0
const nextId = () => `m${++idCounter}`

const CHAT_STORE = 'praynow.ai.chats'
const MAX_SAVED_CHATS = 40

type SavedChat = {
  id: string
  title: string
  updatedAt: number
  msgs: Msg[]
  turns: ChatTurn[]
}

function chatTitle(msgs: Msg[]) {
  const first = msgs.find((m) => m.role === 'user' && m.text.trim())
  const raw = first?.text.replace(/\s+/g, ' ').trim() || 'New chat'
  return raw.length > 46 ? `${raw.slice(0, 46)}\u2026` : raw
}

function chatWhen(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

async function writeChats(chats: SavedChat[]) {
  try {
    await AsyncStorage.setItem(CHAT_STORE, JSON.stringify(chats))
  } catch {
    /* history stays in memory for this session */
  }
}

export function AIGuideScreen({ ask, topics = TOPICS, bottomInset = 0 }: AIGuideScreenProps) {
  const styles = useStyles()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [listening, setListening] = useState(false)
  const [hearing, setHearing] = useState(false)
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true })
  const [wave, setWave] = useState(flatWave)
  const [voiceMs, setVoiceMs] = useState(0)
  const [keyboardPad, setKeyboardPad] = useState(0)
  const [chats, setChats] = useState<SavedChat[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const screenHeight = useRef(Dimensions.get('window').height)

  const scrollRef = useRef<ScrollView>(null)
  const turns = useRef<ChatTurn[]>([])
  const chatIdRef = useRef<string | null>(null)
  const hydrated = useRef(false)
  const requestRef = useRef(0)
  const voiceLock = useRef(false)
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const topic = topics.find((t) => t.key === topicKey) ?? null
  const placeholder = listening
    ? 'Listening… tap the mic to send'
    : hearing
      ? 'Turning your voice into a question…'
      : topic
        ? `Ask more about ${topic.name}…`
        : msgs.length
          ? 'Ask more…'
          : 'Ask about Islam…'

  useEffect(
    () => () => {
      requestRef.current += 1
    },
    [],
  )

  useEffect(() => {
    let live = true
    AsyncStorage.getItem(CHAT_STORE)
      .then((raw) => {
        if (!live) return
        if (raw) {
          const parsed = JSON.parse(raw) as SavedChat[]
          if (Array.isArray(parsed) && parsed.length) {
            const clean = parsed.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.msgs))
            setChats(clean)
            const latest = clean[0]
            if (latest) {
              chatIdRef.current = latest.id
              turns.current = Array.isArray(latest.turns) ? latest.turns : []
              setMsgs(latest.msgs)
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (live) hydrated.current = true
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    const kept = msgs.filter((m) => m.status !== 'thinking')
    if (!kept.some((m) => m.role === 'user' && m.text.trim())) return
    const id = chatIdRef.current ?? `c${Date.now().toString(36)}`
    chatIdRef.current = id
    const saved: SavedChat = {
      id,
      title: chatTitle(kept),
      updatedAt: Date.now(),
      msgs: kept,
      turns: turns.current,
    }
    setChats((prev) => {
      const next = [saved, ...prev.filter((c) => c.id !== id)].slice(0, MAX_SAVED_CHATS)
      void writeChats(next)
      return next
    })
  }, [msgs])

  const patch = useCallback((id: string, p: Partial<Msg>) => {
    setMsgs((cur) => cur.map((m) => (m.id === id ? { ...m, ...p } : m)))
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const q = raw.trim()
      if (!q || busy) return
      setSheet(false)
      setInput('')

      const aiId = nextId()
      const history: ChatTurn[] = [...turns.current, { role: 'user' as const, content: q }].slice(-9)
      turns.current = history
      setMsgs((cur) => [
        ...cur,
        { id: nextId(), role: 'user', text: q, status: 'done' },
        { id: aiId, role: 'assistant', text: '', status: 'thinking' },
      ])
      setBusy(true)

      const request = ++requestRef.current

      try {
        const answer = await ask(history)
        if (request !== requestRef.current) return
        turns.current = [...history, { role: 'assistant', content: answer }]
        patch(aiId, { text: answer, status: 'done' })
      } catch {
        if (request !== requestRef.current) return
        patch(aiId, { text: '', status: 'error' })
      } finally {
        if (request === requestRef.current) setBusy(false)
      }
    },
    [ask, busy, patch],
  )

  const stop = useCallback(() => {
    requestRef.current += 1
    setMsgs((cur) => cur.filter((m) => m.status !== 'thinking'))
    setBusy(false)
  }, [])

  const finishVoice = useCallback(async () => {
    if (voiceLock.current) return
    voiceLock.current = true
    if (voiceTimer.current) {
      clearTimeout(voiceTimer.current)
      voiceTimer.current = null
    }
    setListening(false)
    try {
      const active = recorder.isRecording || recorder.getStatus().isRecording
      if (active) await recorder.stop()
      const uri = recorder.uri
      if (!uri) {
        Alert.alert('Voice', 'No recording was captured. Try again.')
        return
      }
      setHearing(true)
      const text = await transcribeQuestion(uri)
      await send(text)
    } catch (error) {
      Alert.alert('Voice', error instanceof Error ? error.message : 'Could not use that recording.')
    } finally {
      voiceLock.current = false
      setHearing(false)
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
    }
  }, [recorder, send])

  const cancelVoice = useCallback(async () => {
    if (voiceTimer.current) {
      clearTimeout(voiceTimer.current)
      voiceTimer.current = null
    }
    voiceLock.current = true
    setListening(false)
    setWave(flatWave())
    setVoiceMs(0)
    try {
      if (recorder.isRecording || recorder.getStatus().isRecording) await recorder.stop()
    } catch {
      /* already stopped */
    } finally {
      voiceLock.current = false
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
    }
  }, [recorder])

  const toggleVoice = useCallback(async () => {
    if (busy || hearing) return
    if (listening) {
      await finishVoice()
      return
    }
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Microphone', 'Allow the microphone so you can ask by voice.')
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setWave(flatWave())
      setVoiceMs(0)
      setListening(true)
      setSheet(false)
      voiceTimer.current = setTimeout(() => {
        void finishVoice()
      }, 20000)
    } catch {
      Alert.alert('Voice', 'The microphone could not start. Try again.')
    }
  }, [busy, hearing, listening, finishVoice, recorder])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const onShow = (event: KeyboardEvent) => {
      const windowH = Dimensions.get('window').height
      const resized = screenHeight.current - windowH > 80
      const overlap = Math.max(0, Math.round(windowH - event.endCoordinates.screenY))
      setKeyboardPad(resized ? 0 : overlap || Math.round(event.endCoordinates.height))
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    }
    const onHide = () => {
      setKeyboardPad(0)
      screenHeight.current = Dimensions.get('window').height
    }
    const showSub = Keyboard.addListener(showEvent, onShow)
    const hideSub = Keyboard.addListener(hideEvent, onHide)
    const dimSub = Dimensions.addEventListener('change', ({ window }) => {
      if (screenHeight.current - window.height > 80) setKeyboardPad(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
      dimSub.remove()
    }
  }, [])

  useEffect(() => {
    if (!listening) return
    const id = setInterval(() => {
      const status = recorder.getStatus()
      setVoiceMs(status.durationMillis || 0)
      setWave((prev) => [...prev.slice(1), voiceLevel(status.metering)])
    }, 80)
    return () => clearInterval(id)
  }, [listening, recorder])

  const share = useCallback((t: string) => {
    Share.share({ message: t }).catch(() => {})
  }, [])

  const startNewChat = useCallback(() => {
    requestRef.current += 1
    setBusy(false)
    chatIdRef.current = null
    turns.current = []
    setMsgs([])
    setInput('')
    setSheet(false)
    setHistoryOpen(false)
  }, [])

  const openChat = useCallback((chat: SavedChat) => {
    requestRef.current += 1
    setBusy(false)
    chatIdRef.current = chat.id
    turns.current = Array.isArray(chat.turns) ? chat.turns : []
    setMsgs(chat.msgs)
    setInput('')
    setSheet(false)
    setHistoryOpen(false)
  }, [])

  const deleteChat = useCallback((chat: SavedChat) => {
    Alert.alert('Delete chat', 'Remove this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setChats((prev) => {
            const next = prev.filter((c) => c.id !== chat.id)
            void writeChats(next)
            return next
          })
          if (chatIdRef.current === chat.id) {
            requestRef.current += 1
            setBusy(false)
            chatIdRef.current = null
            turns.current = []
            setMsgs([])
            setInput('')
          }
        },
      },
    ])
  }, [])

  const onTopic = useCallback(
    (k: string) => {
      if (topicKey === k && sheet) {
        setTopicKey(null)
        setSheet(false)
      } else {
        setTopicKey(k)
        setSheet(true)
      }
    },
    [topicKey, sheet],
  )

  const canSend = input.trim().length > 0
  const sheetMax = Math.round(Dimensions.get('window').height * 0.46)

  return (
    <View style={styles.screen}>
      <Glow />

      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <View style={styles.hl}>
          <Pressable
            onPress={() => {
              setSheet(false)
              setHistoryOpen((open) => !open)
            }}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
            style={styles.histBtn}>
            <MaterialCommunityIcons name="menu" size={22} color={colors.v2} />
          </Pressable>
          <View>
            <Text style={styles.brand}>PRAYNOW</Text>
            <Text style={styles.title}>AI Guide</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.pad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          onScrollBeginDrag={() => setSheet(false)}>
          {msgs.map((m) =>
            m.role === 'user' ? (
              <Animated.View key={m.id} entering={FadeInDown.duration(220)} style={styles.userRow}>
                <View style={styles.user}>
                  <Text style={styles.userText}>{m.text}</Text>
                </View>
              </Animated.View>
            ) : (
              <View key={m.id}>
                <AssistantMessage msg={m} onAsk={send} onShare={share} />
              </View>
            ),
          )}
        </ScrollView>

        {sheet && <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(false)} accessibilityLabel="Close questions" />}

        <View style={[styles.comp, { paddingBottom: keyboardPad > 0 ? keyboardPad + 8 : 6 + bottomInset }]}>
          {sheet && topic && (
            <Animated.View entering={FadeInDown.duration(180)} style={[styles.sheet, { maxHeight: sheetMax }]}>
              <View style={styles.sheetHead}>
                <View style={styles.sheetTitle}>
                  <MaterialCommunityIcons name={topic.icon} size={18} color={colors.v2} />
                  <Text style={styles.sheetTitleText}>{topic.name}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setSheet(false)
                    setTopicKey(null)
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.sheetX}>
                  <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {topic.questions.map((q, i) => (
                  <QuestionLine key={q} q={q} onPress={send} last={i === topic.questions.length - 1} />
                ))}
              </ScrollView>
            </Animated.View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.topicRow}>
            {topics.map((t) => {
              const on = t.key === topicKey
              return (
                <Pressable
                  key={t.key}
                  onPress={() => onTopic(t.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.tp, on && styles.tpOn]}>
                  <MaterialCommunityIcons name={t.icon} size={17} color={on ? colors.onSelect : colors.v2} />
                  <Text style={[styles.tpText, on && { color: colors.onSelect }]}>{t.name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={styles.bar}>
            <Pressable
              onPress={() => void (listening ? cancelVoice() : toggleVoice())}
              disabled={busy || hearing}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Cancel recording' : 'Ask by voice'}
              style={[styles.mic, (busy || hearing) && styles.sendOff]}>
              {hearing ? (
                <ActivityIndicator color={colors.v2} size="small" />
              ) : (
                <MaterialCommunityIcons
                  name={listening ? 'delete-outline' : 'microphone'}
                  size={22}
                  color={listening ? '#E23B3B' : colors.v2}
                />
              )}
            </Pressable>
            {listening ? (
              <View style={styles.voiceRow}>
                <RecDot />
                <Text style={styles.recTime}>{voiceClock(voiceMs)}</Text>
                <View style={styles.voiceLine}>
                  {wave.map((level, i) => (
                    <View key={i} style={[styles.voiceBar, { height: 4 + level * 22 }]} />
                  ))}
                </View>
              </View>
            ) : (
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={placeholder}
                placeholderTextColor={colors.faint}
                multiline
                editable={!hearing}
                underlineColorAndroid="transparent"
                style={[styles.input, Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null]}
                accessibilityLabel="Ask a question"
                onFocus={() => setSheet(false)}
              />
            )}
            <Pressable
              onPress={listening ? () => void finishVoice() : busy ? stop : () => void send(input)}
              disabled={!listening && !busy && !canSend}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Send voice question' : busy ? 'Stop' : 'Send'}
              style={[styles.send, !listening && !busy && !canSend && styles.sendOff]}>
              <MaterialCommunityIcons name={busy && !listening ? 'stop' : 'arrow-up'} size={busy && !listening ? 20 : 23} color={!listening && !busy && !canSend ? colors.onSendOff : colors.onSelect} />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={historyOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setHistoryOpen(false)}>
        <View style={[styles.histScrim, { marginBottom: bottomInset }]}>
          <View style={[styles.histPanel, { paddingTop: insets.top + 12 }]}>
            <View style={styles.histHead}>
              <Text style={styles.histTitle}>Chats</Text>
              <Pressable
                onPress={() => setHistoryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={styles.sheetX}>
                <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
            <Pressable onPress={startNewChat} accessibilityRole="button" accessibilityLabel="New chat" style={styles.histNew}>
              <MaterialCommunityIcons name="square-edit-outline" size={18} color={colors.v2} />
              <Text style={styles.histNewText}>New chat</Text>
            </Pressable>
            <ScrollView
              horizontal={false}
              showsVerticalScrollIndicator={false}
              style={styles.histScroll}
              contentContainerStyle={styles.histList}>
              {chats.length === 0 ? (
                <Text style={styles.histEmpty}>Saved conversations show up here.</Text>
              ) : (
                chats.map((chat) => {
                  const on = chat.id === chatIdRef.current
                  return (
                    <View key={chat.id} style={[styles.histRow, on && styles.histRowOn]}>
                      <Pressable
                        onPress={() => openChat(chat)}
                        accessibilityRole="button"
                        accessibilityLabel={chat.title}
                        style={styles.histMain}>
                        <Text style={styles.histName} numberOfLines={2}>
                          {chat.title}
                        </Text>
                        <Text style={styles.histTime}>{chatWhen(chat.updatedAt)}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteChat(chat)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${chat.title}`}
                        hitSlop={8}
                        style={styles.histDel}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  )
                })
              )}
            </ScrollView>
          </View>
          <Pressable style={styles.histDim} onPress={() => setHistoryOpen(false)} accessibilityLabel="Close chat history" />
        </View>
      </Modal>
    </View>
  )
}

/* ========================================================================== */
/*  Styles                                                                     */
/* ========================================================================== */
const useStyles = makeStyles(({ mode }) => {
  const C = mode === 'dark' ? DARK : LIGHT
  return {
  screen: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, height: 380 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 14, paddingBottom: 8 },
  hl: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  histBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.badge,
  },
  histScrim: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  histPanel: {
    width: '76%',
    maxWidth: 360,
    height: '100%',
    flexDirection: 'column',
    backgroundColor: C.panel,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  histDim: { flex: 1, backgroundColor: C.scrim },
  histScroll: { flex: 1 },
  histHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  histTitle: { fontFamily: F.display, fontSize: 26, color: C.ink },
  histNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: C.badge,
    marginBottom: 8,
  },
  histNewText: { fontFamily: F.semi, fontSize: 15.5, color: C.v3 },
  histList: { paddingBottom: 12 },
  histEmpty: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.muted, paddingTop: 18, paddingHorizontal: 4 },
  histRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingLeft: 12, paddingVertical: 8, marginTop: 4 },
  histRowOn: { backgroundColor: C.soft },
  histMain: { flex: 1, paddingVertical: 4, paddingRight: 8 },
  histName: { fontFamily: F.semi, fontSize: 15.5, lineHeight: 20, color: C.ink },
  histTime: { fontFamily: F.body, fontSize: 12.5, color: C.faint, marginTop: 2 },
  histDel: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: F.bold, fontSize: 11.5, letterSpacing: 1.6, color: C.muted },
  title: { fontFamily: F.display, fontSize: 23, lineHeight: 26, letterSpacing: -0.2, color: C.ink, marginTop: 1 },
  pad: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30, gap: 34, flexGrow: 1 },
  userRow: { alignItems: 'flex-end' },
  user: { maxWidth: '78%', alignSelf: 'flex-end', backgroundColor: C.userBg, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  userText: { fontFamily: F.medium, fontSize: 16, lineHeight: 21, color: C.onUser },
  ans: { fontFamily: F.body, fontSize: 18.5, lineHeight: 31, color: C.text },
  bold: { fontFamily: F.bold, color: C.ink },
  gapP: { marginBottom: 17 },
  gapLi: { marginBottom: 13 },
  li: { flexDirection: 'row', gap: 10 },
  num: { width: 25, height: 25, borderRadius: 13, backgroundColor: C.badge, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  numText: { fontFamily: F.heavy, fontSize: 13, color: C.v3 },
  bulletWrap: { width: 25, alignItems: 'center', paddingTop: 12 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.v2 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.v2 },
  thinkingText: { fontFamily: F.medium, fontSize: 17, color: C.muted },

  lab: { fontFamily: F.bold, fontSize: 13, letterSpacing: 0.3, color: C.muted },
  srcs: { marginTop: 20, gap: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  srcChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingLeft: 11, paddingRight: 14, borderRadius: 999, backgroundColor: C.chip, borderWidth: 1, borderColor: C.line },
  srcText: { fontFamily: F.semi, fontSize: 14, color: C.srcText },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingRight: 12 },
  copyText: { fontFamily: F.semi, fontSize: 14, color: C.muted },

  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 16 },
  lineBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  lineText: { flex: 1, fontFamily: F.medium, fontSize: 17, lineHeight: 23, color: C.ink },

  comp: { paddingHorizontal: 16, paddingTop: 6 },
  topicRow: { gap: 8, paddingBottom: 10, paddingTop: 2 },
  tp: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingLeft: 12, paddingRight: 15, borderRadius: 999, backgroundColor: C.chip, borderWidth: 1, borderColor: C.line },
  tpOn: { backgroundColor: C.select, borderColor: C.select },
  tpText: { fontFamily: F.semi, fontSize: 14.5, color: C.chipText },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: '100%',
    marginBottom: 2,
    backgroundColor: C.panel,
    borderRadius: 26,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 2,
    shadowColor: '#3C3282',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    zIndex: 5,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitleText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  sheetX: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.badge,
  },
  voiceRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, paddingRight: 4 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E23B3B' },
  recTime: { fontFamily: F.semi, fontSize: 15, color: '#E23B3B', fontVariant: ['tabular-nums'], width: 38 },
  voiceLine: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, height: 28, overflow: 'hidden' },
  voiceBar: { width: 3, borderRadius: 2, backgroundColor: C.voice },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 60,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: 30,
    backgroundColor: C.chip,
    borderWidth: mode === 'dark' ? 1 : 0,
    borderColor: C.line,
    shadowColor: '#46379A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    margin: 0,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    fontFamily: F.body,
    fontSize: 16.5,
    lineHeight: 22,
    color: C.ink,
    backgroundColor: 'transparent',
    borderWidth: 0,
    textAlignVertical: 'center',
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.select, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: C.sendOff },
}})
