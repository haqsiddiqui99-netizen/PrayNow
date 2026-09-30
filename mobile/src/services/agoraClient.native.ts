import Constants from 'expo-constants'

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
