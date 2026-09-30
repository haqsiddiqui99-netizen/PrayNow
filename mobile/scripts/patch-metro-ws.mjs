/**
 * Metro dev server crash on Windows/Node 22:
 *   RangeError: Too many message fragments (ws close 1008)
 *
 * Newer `ws` builds cap fragmented messages at 16k frames. Large HMR payloads
 * from Expo Go can exceed that and kill Metro. Setting maxFragments to 0
 * disables the limit (dev-only nested dependency).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WS_FILES = ['lib/websocket-server.js', 'lib/websocket.js']
const FROM = 'maxFragments: 16 * 1024'
const TO = 'maxFragments: 0'

/** @param {string} mobileRoot */
export function patchMetroWsLimits(mobileRoot) {
  const nodeModules = join(mobileRoot, 'node_modules')
  if (!existsSync(nodeModules)) return []

  /** @type {string[]} */
  const patched = []

  /** @param {string} dir @param {number} depth */
  function scan(dir, depth) {
    if (depth > 10) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name === '.bin' || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'ws' && existsSync(join(full, 'lib', 'websocket-server.js'))) {
          for (const rel of WS_FILES) {
            const file = join(full, rel)
            if (patchFile(file)) patched.push(file)
          }
          continue
        }
        if (entry.name === 'node_modules' || !entry.name.startsWith('@')) {
          scan(full, depth + 1)
        } else if (entry.name.startsWith('@')) {
          scan(full, depth + 1)
        }
      }
    }
  }

  scan(nodeModules, 0)
  return patched
}

/** @param {string} file */
function patchFile(file) {
  if (!existsSync(file)) return false
  const content = readFileSync(file, 'utf8')
  if (!content.includes(FROM)) return false
  writeFileSync(file, content.replaceAll(FROM, TO))
  return true
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const patched = patchMetroWsLimits(mobileRoot)
  if (patched.length > 0) {
    console.log(`>>> Patched ws maxFragments in ${patched.length} file(s)`)
  } else {
    console.log('>>> ws maxFragments already patched (nothing to do)')
  }
}
