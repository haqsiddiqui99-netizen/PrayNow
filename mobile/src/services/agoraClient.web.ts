export interface AgoraCredentials {
  configured: boolean
  appId: string | null
  channel: string
  uid: number
  role: 'publisher' | 'subscriber'
  token: string | null
  expiresIn?: number
}

export function isAgoraNativeAvailable(): boolean {
  return false
}

export class AzanBroadcaster {
  async start(): Promise<void> {
    throw new Error('Use web admin to broadcast live azan from a browser.')
  }

  async stop(): Promise<void> {}

  get active() {
    return false
  }
}

export class AzanListener {
  async start(): Promise<void> {
    throw new Error('Live azan listening is not available on mobile web.')
  }

  async stop(): Promise<void> {}

  get active() {
    return false
  }
}
