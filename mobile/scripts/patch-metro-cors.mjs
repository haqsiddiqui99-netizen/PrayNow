/**
 * Metro/Expo dev server crash on Windows:
 *   TypeError: Invalid URL
 *     at new URL (node:internal/url:818:25)
 *     at CorsMiddleware.js / Server.js
 *
 * Some clients (stray LAN probes, WebViews, security software) send a
 * malformed `Origin` header (e.g. the literal string "null") or a
 * malformed `req.url`. `new URL()` throws on those inputs, and the
 * uncaught throw can bubble up and kill the dev server. Wrap the
 * offending `new URL(...)` calls so a bad header just gets ignored
 * instead of taking the whole process down.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PATCHES = [
  {
    // @expo/cli's CorsMiddleware: guard the Origin-header URL parse.
    rel: ['@expo', 'cli', 'build', 'src', 'start', 'server', 'middleware', 'CorsMiddleware.js'],
    from: `if (typeof req.headers.origin === 'string') {
            const { host, hostname } = new URL(req.headers.origin);`,
    to: `if (typeof req.headers.origin === 'string') {
            let __originUrl;
            try {
                __originUrl = new URL(req.headers.origin);
            } catch {
                res.setHeader('X-Content-Type-Options', 'nosniff');
                next();
                return;
            }
            const { host, hostname } = __originUrl;`,
  },
  {
    // Same file: guard the source-map pathname parse used for CORS header stripping.
    rel: ['@expo', 'cli', 'build', 'src', 'start', 'server', 'middleware', 'CorsMiddleware.js'],
    from: `const pathname = req.url ? new URL(req.url, \`http://\${req.headers.host}\`).pathname : '';`,
    to: `let pathname = '';
    try {
        pathname = req.url ? new URL(req.url, \`http://\${req.headers.host}\`).pathname : '';
    } catch {
        pathname = '';
    }`,
  },
  {
    // Metro's Server: guard the request URL parse so a malformed req.url
    // rejects the request instead of throwing past the middleware chain.
    rel: ['metro', 'src', 'Server.js'],
    from: `const urlObj = new URL(req.url, reqProtocol + "://" + reqHost);`,
    to: `let urlObj;
    try {
      urlObj = new URL(req.url, reqProtocol + "://" + reqHost);
    } catch {
      res.writeHead(400);
      res.end("Invalid URL");
      return;
    }`,
  },
]

/** @param {string} mobileRoot */
export function patchMetroCors(mobileRoot) {
  const nodeModules = join(mobileRoot, 'node_modules')
  if (!existsSync(nodeModules)) return []

  /** @type {string[]} */
  const patched = []
  for (const { rel, from, to } of PATCHES) {
    const file = join(nodeModules, ...rel)
    if (patchFile(file, from, to)) patched.push(file)
  }
  return patched
}

/** @param {string} file @param {string} from @param {string} to */
function patchFile(file, from, to) {
  if (!existsSync(file)) return false
  const content = readFileSync(file, 'utf8')
  if (!content.includes(from)) return false
  writeFileSync(file, content.replace(from, to))
  return true
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const patched = patchMetroCors(mobileRoot)
  if (patched.length > 0) {
    console.log(`>>> Patched Metro/Expo Invalid URL guard in ${patched.length} file(s)`)
  } else {
    console.log('>>> Metro/Expo Invalid URL guard already patched (nothing to do)')
  }
}
