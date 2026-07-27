import { spawn } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function isVirtualIface(name) {
  return /vEthernet|Hyper-V|WSL|Loopback|Virtual|VMware|VirtualBox|Docker|Default Switch/i.test(
    name,
  )
}

function getLanIp() {
  /** @type {{ address: string, name: string }[]} */
  const candidates = []

  for (const [name, entries] of Object.entries(networkInterfaces())) {
    if (isVirtualIface(name)) continue
    for (const net of entries ?? []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue
      if (net.internal) continue
      if (net.address.startsWith('169.254.')) continue
      candidates.push({ address: net.address, name })
    }
  }

  const wifi =
    candidates.find((c) => /wi-?fi|wlan/i.test(c.name)) ??
    candidates.find((c) => c.address.startsWith('192.168.')) ??
    candidates.find((c) => c.address.startsWith('10.')) ??
    candidates[0]

  return wifi?.address ?? '127.0.0.1'
}

const ip = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || getLanIp()
const port = process.env.EXPO_METRO_PORT || '8081'

console.log(`\n>>> Scan with Expo Go: exp://${ip}:${port}\n`)
console.log('>>> Phone and PC must be on the same Wi-Fi.\n')
console.log(`>>> API should be reachable at http://${ip}:5000 (see mobile/.env)\n`)

const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: ip,
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
}

const child = spawn('npx', ['expo', 'start', '--lan', '--clear', '--port', port], {
  cwd: mobileRoot,
  env,
  shell: true,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 0))
