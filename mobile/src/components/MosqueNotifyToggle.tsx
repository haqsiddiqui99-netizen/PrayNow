import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, View } from 'react-native'
import { useAuth } from '@/src/context/AuthContext'
import { useMosqueNotify } from '@/src/context/MosqueNotifyContext'
import { makeStyles } from '@/src/context/ThemeContext'

type Props = {
  mosqueId: string
  /** Stop parent card press when toggling */
  stopPropagation?: boolean
}

/** Slim green ON / gray OFF switch — mosque timings & announcements. */
export function MosqueNotifyToggle({ mosqueId }: Props) {
  const styles = useStyles()
  const router = useRouter()
  const { user } = useAuth()
  const { isSubscribed, toggle } = useMosqueNotify()
  const [busy, setBusy] = useState(false)
  const on = user ? isSubscribed(mosqueId) : false

  const onPress = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await toggle(mosqueId)
      if (result === 'need_login') {
        Alert.alert('Sign in required', 'Log in to get notifications for this mosque.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log in', onPress: () => router.push('/login') },
        ])
      } else if (result === 'error') {
        Alert.alert('Could not update', 'Check your connection and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'Notifications on' : 'Notifications off'}
      hitSlop={8}
      onPress={(e) => {
        // @ts-expect-error RN web may pass stopPropagation
        e?.stopPropagation?.()
        void onPress()
      }}
      style={[styles.track, on ? styles.trackOn : styles.trackOff]}>
      {busy ? (
        <ActivityIndicator size="small" color={on ? '#fff' : '#64748b'} style={styles.spinner} />
      ) : (
        <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
      )}
    </Pressable>
  )
}

const TRACK_W = 36
const TRACK_H = 20
const KNOB = 16

const useStyles = makeStyles(({ colors }) => ({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: 2,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.success },
  trackOff: { backgroundColor: '#cbd5e1' },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#fff',
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  spinner: { alignSelf: 'center' },
}))
