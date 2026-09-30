/**
 * Derives a square, transparent Google Maps pin from the bundled
 * `google_map_icon.png`, which ships as a portrait tile with the "Maps"
 * wordmark and a baked-in near-white background. Neither of those can fill a
 * rounded square or follow a dark palette, so the pin is isolated here once and
 * committed as its own asset.
 *
 * Run with `node scripts/make-maps-pin.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const SOURCE = new URL('../assets/images/google_map_icon.png', import.meta.url)
const TARGET = new URL('../assets/images/google_maps_pin.png', import.meta.url)

/** Colour distance at which a pixel still counts as background. */
const BG_TOLERANCE = 42
/** Chroma above which a pixel is pin artwork rather than grey wordmark. */
const SATURATION_FLOOR = 28
/** Transparent margin around the pin, as a fraction of its longest side. */
const PADDING_RATIO = 0.06

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readChunks(buf) {
  const chunks = []
  let off = PNG_SIGNATURE.length
  while (off < buf.length) {
    const length = buf.readUInt32BE(off)
    chunks.push({
      type: buf.toString('ascii', off + 4, off + 8),
      data: buf.subarray(off + 8, off + 8 + length),
    })
    off += 12 + length
  }
  return chunks
}

function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/** Reverses the per-scanline filters into a flat RGBA buffer. */
function unfilter(raw, width, height) {
  const bpp = 4
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const target = y * stride
    const above = target - stride
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? out[target + x - bpp] : 0
      const up = y > 0 ? out[above + x] : 0
      const upLeft = y > 0 && x >= bpp ? out[above + x - bpp] : 0
      let value = line[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += (left + up) >> 1
      else if (filter === 4) value += paethPredictor(left, up, upLeft)
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`)
      out[target + x] = value & 0xff
    }
  }
  return out
}

function decode(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Not a PNG')
  const chunks = readChunks(buf)
  const ihdr = chunks.find((c) => c.type === 'IHDR')
  const width = ihdr.data.readUInt32BE(0)
  const height = ihdr.data.readUInt32BE(4)
  if (ihdr.data[8] !== 8 || ihdr.data[9] !== 6 || ihdr.data[12] !== 0) {
    throw new Error('Expected a non-interlaced 8-bit RGBA PNG')
  }
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data))
  return { width, height, pixels: unfilter(inflateSync(idat), width, height) }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

function encode(width, height, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const { width, height, pixels } = decode(readFileSync(SOURCE))
const at = (x, y) => (y * width + x) * 4
const bg = [pixels[0], pixels[1], pixels[2]]
const distToBg = (i) =>
  Math.max(
    Math.abs(pixels[i] - bg[0]),
    Math.abs(pixels[i + 1] - bg[1]),
    Math.abs(pixels[i + 2] - bg[2]),
  )
const chroma = (i) => {
  const r = pixels[i]
  const g = pixels[i + 1]
  const b = pixels[i + 2]
  return Math.max(r, g, b) - Math.min(r, g, b)
}

/**
 * The wordmark is grey, so bounding the pin by chroma alone crops it off
 * without needing to know where the text sits.
 */
let minX = width
let minY = height
let maxX = -1
let maxY = -1
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = at(x, y)
    if (pixels[i + 3] < 8 || chroma(i) < SATURATION_FLOOR) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
}
if (maxX < 0) throw new Error('Found no saturated pixels; is this the right asset?')

/**
 * Only background-connected pixels are cleared, so the white circle enclosed by
 * the pin survives instead of punching a hole through to the tile behind it.
 */
const isBg = new Uint8Array(width * height)
const queue = []
const consider = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const p = y * width + x
  if (isBg[p]) return
  const i = p * 4
  if (pixels[i + 3] >= 8 && distToBg(i) > BG_TOLERANCE) return
  isBg[p] = 1
  queue.push(p)
}
for (let x = 0; x < width; x += 1) {
  consider(x, 0)
  consider(x, height - 1)
}
for (let y = 0; y < height; y += 1) {
  consider(0, y)
  consider(width - 1, y)
}
while (queue.length) {
  const p = queue.pop()
  const x = p % width
  const y = (p - x) / width
  consider(x - 1, y)
  consider(x + 1, y)
  consider(x, y - 1)
  consider(x, y + 1)
}

const pinWidth = maxX - minX + 1
const pinHeight = maxY - minY + 1
const side = Math.round(Math.max(pinWidth, pinHeight) * (1 + PADDING_RATIO * 2))
const offsetX = Math.round((side - pinWidth) / 2) - minX
const offsetY = Math.round((side - pinHeight) / 2) - minY
const out = Buffer.alloc(side * side * 4)

for (let y = minY; y <= maxY; y += 1) {
  for (let x = minX; x <= maxX; x += 1) {
    const dx = x + offsetX
    const dy = y + offsetY
    if (dx < 0 || dy < 0 || dx >= side || dy >= side) continue
    const src = at(x, y)
    const dst = (dy * side + dx) * 4
    if (isBg[y * width + x]) continue
    // Edge pixels were blended against the old background, so their alpha is
    // recovered from how far they drifted from it and the blend is undone.
    // Without that the pin keeps a pale halo on dark surfaces.
    const alpha = Math.min(255, Math.round((distToBg(src) / BG_TOLERANCE) * 255))
    if (alpha <= 0) continue
    const a = alpha / 255
    for (let c = 0; c < 3; c += 1) {
      const straight = (pixels[src + c] - (1 - a) * bg[c]) / a
      out[dst + c] = Math.max(0, Math.min(255, Math.round(straight)))
    }
    out[dst + 3] = Math.round(alpha * (pixels[src + 3] / 255))
  }
}

writeFileSync(TARGET, encode(side, side, out))
console.log(
  `source ${width}x${height} bg rgb(${bg.join(',')}) -> pin ${pinWidth}x${pinHeight} at (${minX},${minY}) -> ${side}x${side}`,
)
