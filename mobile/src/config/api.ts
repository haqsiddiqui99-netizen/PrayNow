import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Set EXPO_PUBLIC_API_URL in mobile/.env or eas.json (e.g. https://api.yourdomain.com) */
function getExpoDevHost(): string | null {
  const raw =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra
      ?.expoClient?.hostUri

  if (!raw) return null

  const cleaned = raw.replace(/^exp:\/\//, '').replace(/^https?:\/\//, '')
  const host = cleaned.split(':')[0]?.trim()
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  return host
}

function normalizeBase(url: string) {
  return url.replace(/\/$/, '')
}

export function getApiBaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    String(Constants.expoConfig?.extra?.apiUrl || '').trim()

  // Production / preview builds: always use the baked public API URL (HTTPS OK).
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    if (fromEnv) return normalizeBase(fromEnv)
    throw new Error('This build has no API address. Set EXPO_PUBLIC_API_URL and rebuild.')
  }

  // Browser on this PC: talk to the API on the same machine, not a stale LAN IP.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'http://localhost:5000'
    if (host) return `http://${host}:5000`
  }

  // Expo Go / local: prefer Metro LAN host so a stale .env IP cannot break login.
  const devHost = getExpoDevHost()
  if (devHost) return `http://${devHost}:5000`

  if (fromEnv) return normalizeBase(fromEnv)

  if (Platform.OS === 'android') return 'http://10.0.2.2:5000'
  return 'http://localhost:5000'
}
