import { spawn, execSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, rmSync } from 'node:fs'
import { patchMetroWsLimits } from './patch-metro-ws.mjs'
import { patchMetroCors } from './patch-metro-cors.mjs'

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

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
        console.log(`>>> Freed port ${port} (killed PID ${pid})`)
      } catch {
        // already gone
      }
    }
  } catch {
    // nothing listening
  }
}

function clearMetroCaches() {
  const targets = [
    join(mobileRoot, '.expo'),
    join(mobileRoot, 'node_modules', '.cache'),
  ]
  for (const dir of targets) {
    if (!existsSync(dir)) continue
    try {
      rmSync(dir, { recursive: true, force: true })
      console.log(`>>> Cleared ${dir}`)
    } catch (err) {
      console.warn(`>>> Could not clear ${dir}:`, err?.message ?? err)
    }
  }
}

const ip = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || getLanIp()
const port = process.env.EXPO_METRO_PORT || '8081'
const shouldClear = !process.env.EXPO_NO_CLEAR
const isWindows = process.platform === 'win32'
const mobileOnly = isWindows && process.env.EXPO_ENABLE_WEB !== '1'
const metroWorkers = process.env.REACT_NATIVE_MAX_WORKERS || (isWindows ? '1' : '2')

console.log(`\n>>> Scan with Expo Go: exp://${ip}:${port}\n`)
console.log('>>> Phone and PC must be on the same Wi-Fi.\n')
console.log(`>>> API should be reachable at http://${ip}:5000 (see mobile/.env)\n`)
if (mobileOnly) {
  console.log('>>> Web bundling disabled on Windows (mobile-only dev).')
  console.log('>>> Set EXPO_ENABLE_WEB=1 before npm start to build for web.\n')
}

killPort(port)
if (shouldClear) clearMetroCaches()

const wsPatched = patchMetroWsLimits(mobileRoot)
if (wsPatched.length > 0) {
  console.log(`>>> Patched Metro ws fragment limit (${wsPatched.length} file(s))\n`)
}

const corsPatched = patchMetroCors(mobileRoot)
if (corsPatched.length > 0) {
  console.log(`>>> Patched Metro/Expo Invalid URL guard (${corsPatched.length} file(s))\n`)
}

const env = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: ip,
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
  // Single worker on Windows — prevents Premature close / stuck 0% bundles.
  REACT_NATIVE_MAX_WORKERS: metroWorkers,
  METRO_MAX_WORKERS: process.env.METRO_MAX_WORKERS || metroWorkers,
}

const expoCli = join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli')
const args = [expoCli, 'start', '--lan', '--port', port]
if (shouldClear) args.push('--clear')

const child = spawn(process.execPath, args, {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 0))
