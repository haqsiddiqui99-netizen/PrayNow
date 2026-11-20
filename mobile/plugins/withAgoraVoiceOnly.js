// Live azan only sends and plays audio. react-native-agora pulls Agora's full SDK, so this
// drops its optional video and effect extensions from the Android build to shrink the APK.
// Keep full-rtc-basic (the engine), ains (noise suppression) and aiaec (echo cancellation).
const { withAppBuildGradle } = require('expo/config-plugins')

const UNUSED_AGORA_MODULES = [
  'audio-beauty',
  'clear-vision',
  'full-content-inspect',
  'full-face-capture',
  'full-face-detect',
  'full-screen-sharing',
  'full-video-av1-codec-dec',
  'full-video-av1-codec-enc',
  'full-video-codec-dec',
  'full-video-codec-enc',
  'full-virtual-background',
  'full-voice-drive',
  'full-vqa',
  'screen-capture',
  'spatial-audio',
]

const MARKER = '// praynow: agora voice-only'

module.exports = function withAgoraVoiceOnly(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      const excludes = UNUSED_AGORA_MODULES.map((name) => `    exclude group: 'io.agora.rtc', module: '${name}'`).join('\n')
      cfg.modResults.contents += `\n${MARKER}\nconfigurations.all {\n${excludes}\n}\n`
    }
    return cfg
  })
}
