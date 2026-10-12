import { existsSync } from 'node:fs'

const EAS_PROJECT_ID = 'e1bf7bdb-a513-48a8-b966-b599e3531e62'

/** Firebase config for Android push; builds without it still work, just without remote push. */
const GOOGLE_SERVICES_FILE = './google-services.json'
const hasGoogleServices = existsSync(GOOGLE_SERVICES_FILE)

/** Extends app.json with store IDs + build-time public URLs for EAS. */
export default ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.praynow.app',
  },
  android: {
    ...config.android,
    package: 'com.praynow.app',
    ...(hasGoogleServices ? { googleServicesFile: GOOGLE_SERVICES_FILE } : null),
  },
  plugins: [
    ...(config.plugins || []),
    ['expo-notifications', { color: '#0F1F2E', defaultChannel: 'default' }],
  ],
  extra: {
    ...(config.extra || {}),
    eas: {
      projectId: process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || EAS_PROJECT_ID,
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    adminUrl: process.env.EXPO_PUBLIC_ADMIN_URL || '',
  },
})
