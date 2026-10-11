import { Ionicons } from '@expo/vector-icons'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Pressable, Text, View } from 'react-native'
import { getApiBaseUrl } from '@/src/config/api'
import { makeStyles } from '@/src/context/ThemeContext'

function formatSeconds(value: number) {
  const total = Math.max(0, Math.round(value || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Plays a mosque voice note. `source` is an API path or a local recording uri. */
export function VoiceNotePlayer({ source, tone = 'light' }: { source: string; tone?: 'light' | 'dark' }) {
  const styles = useStyles()
  const uri = source.startsWith('/') ? `${getApiBaseUrl()}${source}` : source
  const player = useAudioPlayer({ uri })
  const status = useAudioPlayerStatus(player)
  const playing = status.playing
  const duration = status.duration || 0
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0

  const toggle = async () => {
    if (playing) {
      player.pause()
      return
    }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
    if (duration > 0 && status.currentTime >= duration - 0.2) await player.seekTo(0).catch(() => {})
    player.play()
  }

  return (
    <Pressable
      style={[styles.wrap, tone === 'dark' && styles.wrapDark]}
      onPress={(event) => {
        event.stopPropagation?.()
        void toggle()
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}>
      <View style={styles.knob}>
        <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#fff" style={playing ? undefined : { marginLeft: 2 }} />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>{formatSeconds(playing ? status.currentTime : duration)}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ mode }) => ({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: mode === 'dark' ? '#1C3330' : '#EEF1F6',
    marginTop: 8,
  },
  wrapDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  knob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0F1F2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,31,46,0.15)',
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: '#0F1F2E' },
  time: { fontFamily: 'Figtree_600SemiBold', fontSize: 12, color: mode === 'dark' ? '#9DBAB4' : '#1B5E52' },
}))
