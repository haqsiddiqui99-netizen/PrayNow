import { useCallback, useEffect, useRef, useState } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { AzanBroadcaster, isAgoraNativeAvailable } from '@/src/services/agoraClient'
import { startMosqueAzan, stopMosqueAzan } from '@/src/services/api'
import { isMosqueLive, refreshLiveSessions } from '@/src/store/liveAzanSessions'
import type { PrayerName } from '@/src/types'

const KEEP_AWAKE_TAG = 'praynow-azan-broadcast'

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  return granted === PermissionsAndroid.RESULTS.GRANTED
}

export function useAzanBroadcast(mosqueId: string | undefined) {
  const broadcasterRef = useRef<AzanBroadcaster | null>(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [prayer, setPrayer] = useState<PrayerName | undefined>(undefined)

  useEffect(() => {
    return () => {
      void broadcasterRef.current?.stop()
      broadcasterRef.current = null
      deactivateKeepAwake(KEEP_AWAKE_TAG)
    }
  }, [])

  useEffect(() => {
    if (!live) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [live])

  const syncLive = useCallback(async () => {
    await refreshLiveSessions()
    if (mosqueId) setLive(isMosqueLive(mosqueId))
  }, [mosqueId])

  const onStart = useCallback(async () => {
    if (!mosqueId) return
    setBusy(true)
    setError('')
    setHint('')
    try {
      if (isAgoraNativeAvailable()) {
        const micOk = await ensureMicPermission()
        if (!micOk) throw new Error('Microphone permission is required to broadcast live azan.')
      }

      const result = await startMosqueAzan(mosqueId, prayer)
      if (!result.agora?.configured || !result.agora.appId) {
        throw new Error('Live audio is not configured on the server. Add AGORA_APP_ID to server/.env.')
      }

      if (isAgoraNativeAvailable()) {
        const broadcaster = new AzanBroadcaster()
        await broadcaster.start(result.agora)
        broadcasterRef.current = broadcaster
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
        setHint('Mic is live. Keep this screen open until you tap Stop Azan.')
      } else {
        setHint(
          'Session is LIVE for app users. Mic streaming needs a dev build (npm run eas:preview) — or use web admin.',
        )
      }

      await refreshLiveSessions()
      setLive(isMosqueLive(mosqueId))
    } catch (e) {
      await broadcasterRef.current?.stop().catch(() => {})
      broadcasterRef.current = null
      deactivateKeepAwake(KEEP_AWAKE_TAG)
      await stopMosqueAzan(mosqueId).catch(() => {})
      setError(e instanceof Error ? e.message : 'Could not start azan')
    } finally {
      setBusy(false)
    }
  }, [mosqueId, prayer])

  const onStop = useCallback(async () => {
    if (!mosqueId) return
    setBusy(true)
    setError('')
    try {
      await broadcasterRef.current?.stop()
      broadcasterRef.current = null
      deactivateKeepAwake(KEEP_AWAKE_TAG)
      await stopMosqueAzan(mosqueId)
      await refreshLiveSessions()
      setLive(false)
      setHint('Azan stopped.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop azan')
    } finally {
      setBusy(false)
    }
  }, [mosqueId])

  return {
    live,
    busy,
    error,
    setError,
    hint,
    elapsed,
    prayer,
    setPrayer,
    onStart,
    onStop,
    syncLive,
    nativeAgora: isAgoraNativeAvailable(),
  }
}
