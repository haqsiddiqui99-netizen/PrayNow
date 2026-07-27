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
  },
  extra: {
    ...(config.extra || {}),
    eas: {
      projectId: process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId,
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    adminUrl: process.env.EXPO_PUBLIC_ADMIN_URL || '',
  },
})
