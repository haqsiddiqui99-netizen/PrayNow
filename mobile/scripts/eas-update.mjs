// Publishes an over-the-air update to the phones on one channel.
// Usage: node scripts/eas-update.mjs <preview|production> "What changed"
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const channel = process.argv[2]
const message = process.argv.slice(3).join(' ').trim()
const profiles = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build
const profile = profiles[channel]

if (!profile || profile.channel !== channel) {
  console.error('Usage: node scripts/eas-update.mjs <preview|production> "What changed"')
  process.exit(1)
}
if (!message) {
  console.error('Add a short message describing the update.')
  process.exit(1)
}

// The local .env points at this PC. Set the build profile's URLs first, because Expo
// does not let .env replace variables that are already set.
const env = { ...process.env, ...profile.env }

const windows = process.platform === 'win32'
// npx is a .cmd on Windows, so it needs a shell, and the shell splits unquoted spaces.
const quotedMessage = windows ? `"${message.replace(/"/g, '\\"')}"` : message
const result = spawnSync(
  'npx',
  ['eas-cli', 'update', '--channel', channel, '--platform', 'android', '--message', quotedMessage, '--non-interactive'],
  { stdio: 'inherit', env, shell: windows },
)
process.exit(result.status ?? 1)
