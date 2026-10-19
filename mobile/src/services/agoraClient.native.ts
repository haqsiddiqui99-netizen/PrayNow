import Constants from 'expo-constants'
import { cacheDirectory } from 'expo-file-system/legacy'

export interface AgoraCredentials {
  configured: boolean
  appId: string | null
  channel: string
  uid: number
  role: 'publisher' | 'subscriber'
  token: string | null
  expiresIn?: number
}

type AgoraModule = typeof import('react-native-agora')

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo'
}

/** Minimal engine surface used by this module (avoids importing react-native-agora at load time). */
type AzanRtcEngine = {
  initialize(opts: { appId: string }): void
  setChannelProfile(profile: number): number
  enableAudio(): number
  setClientRole(role: number): number
  joinChannel(token: string, channelId: string, uid: number, options: object): number
  leaveChannel(): number
  release(): void
  startAudioRecording(config: {
    filePath?: string
    encode?: boolean
    sampleRate?: number
    fileRecordingType?: number
    quality?: number
  }): number
  stopAudioRecording(): number
}

const LAST_AZAN_FILE = 'praynow-last-azan.aac'

/** Agora wants a filesystem path. The cache helper returns a file:// URI. */
function lastAzanPaths(): { uri: string; nativePath: string } | null {
  if (!cacheDirectory) return null
  const uri = `${cacheDirectory}${LAST_AZAN_FILE}`
  return { uri, nativePath: uri.replace(/^file:\/\//, '') }
}

/** Lazy-load native Agora — top-level import crashes Expo Go (module not linked). */
let cachedModule: AgoraModule | null | undefined
let cachedAvailable: boolean | undefined

function loadAgora(): AgoraModule | null {
  if (cachedModule !== undefined) return cachedModule
  if (isExpoGo()) {
    cachedModule = null
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('react-native-agora') as AgoraModule
  } catch {
    cachedModule = null
  }
  return cachedModule
}

function createEngine(appId: string): AzanRtcEngine {
  const agora = loadAgora()
  if (!agora) throw new Error('Agora native module is not available')
  const engine = agora.createAgoraRtcEngine()
  engine.initialize({ appId })
  engine.setChannelProfile(agora.ChannelProfileType.ChannelProfileLiveBroadcasting)
  engine.enableAudio()
  return engine
}

function joinLiveChannel(engine: AzanRtcEngine, creds: AgoraCredentials, role: number): void {
  const agora = loadAgora()
  if (!agora) throw new Error('Agora native module is not available')
  const code = engine.joinChannel(creds.token ?? '', creds.channel, creds.uid || 0, {
    clientRoleType: role,
    channelProfile: agora.ChannelProfileType.ChannelProfileLiveBroadcasting,
    publishMicrophoneTrack: role === agora.ClientRoleType.ClientRoleBroadcaster,
    autoSubscribeAudio: true,
  })
  if (code < 0) {
    throw new Error(`Could not join live azan channel (${code})`)
  }
}

/** True when the native Agora module is linked (dev/EAS build, not Expo Go). */
export function isAgoraNativeAvailable(): boolean {
  if (cachedAvailable !== undefined) return cachedAvailable
  const agora = loadAgora()
  if (!agora) {
    cachedAvailable = false
    return false
  }
  try {
    const engine = agora.createAgoraRtcEngine()
    engine.release()
    cachedAvailable = true
  } catch {
    cachedAvailable = false
  }
  return cachedAvailable
}

/** Mosque admin: publish microphone to the mosque Agora channel. */
export class AzanBroadcaster {
  private engine: AzanRtcEngine | null = null
  private recordTimer: ReturnType<typeof setTimeout> | null = null
  private recordUri: string | null = null

  async start(creds: AgoraCredentials): Promise<void> {
    if (!creds.appId) {
      throw new Error('Live audio is not configured on the server (missing Agora App ID).')
    }
    if (!isAgoraNativeAvailable()) {
      throw new Error(
        'Mic broadcast needs a PrayNow dev build (not Expo Go). Use web admin or run: npm run eas:preview',
      )
    }
    const agora = loadAgora()!
    await this.stop()
    const engine = createEngine(creds.appId)
    engine.setClientRole(agora.ClientRoleType.ClientRoleBroadcaster)
    joinLiveChannel(engine, creds, agora.ClientRoleType.ClientRoleBroadcaster)
    this.engine = engine
    this.scheduleRecording()
  }

  /** Join is async, so wait briefly before writing the local mic file. */
  private scheduleRecording() {
    this.clearRecordTimer()
    this.recordTimer = setTimeout(() => {
      this.recordTimer = null
      this.beginLocalRecording()
    }, 800)
  }

  private clearRecordTimer() {
    if (!this.recordTimer) return
    clearTimeout(this.recordTimer)
    this.recordTimer = null
  }

  private beginLocalRecording() {
    const engine = this.engine
    const agora = loadAgora()
    const paths = lastAzanPaths()
    if (!engine || !agora || !paths) return
    try {
      const code = engine.startAudioRecording({
        filePath: paths.nativePath,
        encode: true,
        sampleRate: 32000,
        fileRecordingType: agora.AudioFileRecordingType.AudioFileRecordingMic,
        quality: agora.AudioRecordingQualityType.AudioRecordingQualityLow,
      })
      this.recordUri = code === 0 ? paths.uri : null
    } catch {
      this.recordUri = null
    }
  }

  /** Leaves the channel and returns the local recording URI when one was written. */
  async stop(): Promise<string | null> {
    this.clearRecordTimer()
    const uri = this.recordUri
    this.recordUri = null
    const engine = this.engine
    this.engine = null
    if (!engine) return null
    try {
      if (uri) engine.stopAudioRecording()
      engine.leaveChannel()
      engine.release()
    } catch {
      try {
        engine.release()
      } catch {
        /* already released */
      }
    }
    return uri
  }

  get active() {
    return this.engine !== null
  }
}

/** App user: listen to a mosque's live azan broadcast. */
export class AzanListener {
  private engine: AzanRtcEngine | null = null

  async start(creds: AgoraCredentials): Promise<void> {
    if (!creds.appId) {
      throw new Error('Live audio is not configured on the server (missing Agora App ID).')
    }
    if (!isAgoraNativeAvailable()) {
      throw new Error('Live azan listening requires a PrayNow dev build (not Expo Go).')
    }
    const agora = loadAgora()!
    await this.stop()
    const engine = createEngine(creds.appId)
    engine.setClientRole(agora.ClientRoleType.ClientRoleAudience)
    joinLiveChannel(engine, creds, agora.ClientRoleType.ClientRoleAudience)
    this.engine = engine
  }

  async stop(): Promise<void> {
    if (!this.engine) return
    try {
      this.engine.leaveChannel()
      this.engine.release()
    } finally {
      this.engine = null
    }
  }

  get active() {
    return this.engine !== null
  }
}
