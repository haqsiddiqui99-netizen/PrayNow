import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng'

export interface AgoraCredentials {
  configured: boolean
  appId: string | null
  channel: string
  uid: number
  role: 'publisher' | 'subscriber'
  token: string | null
  expiresIn?: number
}

AgoraRTC.setLogLevel(2) // WARN

/**
 * Broadcaster: joins a channel as host and publishes the microphone.
 * Used by mosque managers from the admin dashboard to broadcast azan live.
 */
export class AzanBroadcaster {
  private client: IAgoraRTCClient | null = null
  private micTrack: IMicrophoneAudioTrack | null = null

  async start(creds: AgoraCredentials): Promise<void> {
    if (!creds.appId) {
      throw new Error('Live audio is not configured on the server (missing Agora App ID).')
    }
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
    await client.setClientRole('host')
    await client.join(creds.appId, creds.channel, creds.token ?? null, creds.uid || null)

    const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: 'speech_standard',
    })
    await client.publish([micTrack])

    this.client = client
    this.micTrack = micTrack
  }

  async stop(): Promise<void> {
    try {
      if (this.micTrack) {
        this.micTrack.stop()
        this.micTrack.close()
      }
      if (this.client) {
        await this.client.unpublish().catch(() => {})
        await this.client.leave().catch(() => {})
      }
    } finally {
      this.micTrack = null
      this.client = null
    }
  }

  get active() {
    return this.client !== null
  }
}

/**
 * Listener: joins a channel as audience and plays remote host audio.
 * Used on the Live Azan page to hear a mosque's live azan.
 */
export class AzanListener {
  private client: IAgoraRTCClient | null = null

  async start(creds: AgoraCredentials): Promise<void> {
    if (!creds.appId) {
      throw new Error('Live audio is not configured on the server (missing Agora App ID).')
    }
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
    await client.setClientRole('audience')

    client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
      if (mediaType !== 'audio') return
      await client.subscribe(user, mediaType)
      user.audioTrack?.play()
    })

    await client.join(creds.appId, creds.channel, creds.token ?? null, creds.uid || null)
    this.client = client
  }

  async stop(): Promise<void> {
    try {
      if (this.client) {
        for (const user of this.client.remoteUsers) {
          user.audioTrack?.stop()
        }
        await this.client.leave().catch(() => {})
      }
    } finally {
      this.client = null
    }
  }

  get active() {
    return this.client !== null
  }
}

export function isAgoraSupported(): boolean {
  try {
    return AgoraRTC.checkSystemRequirements()
  } catch {
    return false
  }
}
