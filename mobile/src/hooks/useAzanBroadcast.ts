import { useCallback, useEffect, useRef, useState } from 'react'
import { PermissionsAndroid, Platform } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useLanguage } from '@/src/context/LanguageContext'
import { AzanBroadcaster, isAgoraNativeAvailable } from '@/src/services/agoraClient'
import { startMosqueAzan, stopMosqueAzan } from '@/src/services/api'
import { isMosqueLive, refreshLiveSessions } from '@/src/store/liveAzanSessions'
import type { BroadcastPrayer } from '@/src/types'

const KEEP_AWAKE_TAG = 'praynow-azan-broadcast'

let keepAwakeOn = false

async function holdScreenAwake() {
  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
    keepAwakeOn = true
  } catch {
    keepAwakeOn = false
  }
}

/** Releasing a lock that never activated throws, so only release our own. */
function releaseScreenAwake() {
  if (!keepAwakeOn) return
  keepAwakeOn = false
  try {
    void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {})
  } catch {
    /* already released */
  }
}

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
  return granted === PermissionsAndroid.RESULTS.GRANTED
}

export function useAzanBroadcast(mosqueId: string | undefined) {
  const { t } = useLanguage()
  const broadcasterRef = useRef<AzanBroadcaster | null>(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [prayer, setPrayer] = useState<BroadcastPrayer | undefined>(undefined)

  useEffect(() => {
    return () => {
      void broadcasterRef.current?.stop()
      broadcasterRef.current = null
      releaseScreenAwake()
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

  const onStart = useCallback(async (nextPrayer?: BroadcastPrayer) => {
    if (!mosqueId) return
    const chosen = nextPrayer ?? prayer
    if (nextPrayer) setPrayer(nextPrayer)
    setBusy(true)
    setError('')
    setHint('')
    try {
      if (isAgoraNativeAvailable()) {
        const micOk = await ensureMicPermission()
        if (!micOk) throw new Error(t('cast.micNeeded'))
      }

      const result = await startMosqueAzan(mosqueId, chosen)
      if (!result.agora?.configured || !result.agora.appId) {
        throw new Error(t('cast.notConfigured'))
      }

      if (isAgoraNativeAvailable()) {
        const broadcaster = new AzanBroadcaster()
        await broadcaster.start(result.agora)
        broadcasterRef.current = broadcaster
        await holdScreenAwake()
        setHint(t('cast.micLive'))
      } else {
        setHint(t('cast.devOnly'))
      }

      await refreshLiveSessions()
      setLive(isMosqueLive(mosqueId))
    } catch (e) {
      await broadcasterRef.current?.stop().catch(() => {})
      broadcasterRef.current = null
      releaseScreenAwake()
      await stopMosqueAzan(mosqueId).catch(() => {})
      setError(e instanceof Error ? e.message : t('cast.startFail'))
    } finally {
      setBusy(false)
    }
  }, [mosqueId, prayer, t])

  const onStop = useCallback(async () => {
    if (!mosqueId) return
    setBusy(true)
    setError('')
    try {
      await broadcasterRef.current?.stop()
      broadcasterRef.current = null
      releaseScreenAwake()
      await stopMosqueAzan(mosqueId)
      await refreshLiveSessions()
      setLive(false)
      setHint(t('cast.stopped'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cast.stopFail'))
    } finally {
      setBusy(false)
    }
  }, [mosqueId, t])

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
