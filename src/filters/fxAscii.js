/**
 * ASCII — image → monospace character grid by cell luma (ported from
 * kol-labs-single radar/effects/asciiEngine.js, density algorithm). Each
 * cell samples its centre pixel and picks a glyph from a sparse→dense ramp;
 * transparent cells (`fit: contain` letterbox) draw no glyph, so the
 * background shows through. Static by design — the labs page only animates
 * ASCII through its sweep rig, which is anything but cheap.
 */

const RAMPS = [
  { value: 'classic', label: 'Classic', ramp: ' .:-=+*#%@' },
  { value: 'blocks', label: 'Blocks', ramp: ' ░▒▓█' },
  { value: 'minimal', label: 'Minimal', ramp: ' .·:*' },
]
const RAMP_OPTIONS = RAMPS.map(({ value, label }) => ({ value, label }))

/* Per-source pixel cache (glass.js pattern) — the host hands us a NEW fitted
 * canvas whenever the image/fit/size changes, so canvas identity is the key. */
const pixelCache = new WeakMap()
function pixelsFor(src) {
  let d = pixelCache.get(src)
  if (!d) {
    d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data
    pixelCache.set(src, d)
  }
  return d
}

export default {
  id: 'fx-ascii',
  label: 'ASCII',
  animated: false,
  params: [
    { key: 'cellSize', label: 'Cell size', type: 'range', min: 4, max: 32, step: 1, default: 10 },
    { key: 'charset', label: 'Charset', type: 'select', options: RAMP_OPTIONS, default: 'classic' },
    { key: 'fg', label: 'Ink', type: 'color', role: 'fg', default: '#f4f1ea' },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b' },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
  ],
  apply(ctx, src, w, h, p) {
    const sw = src.width
    const sh = src.height
    const data = pixelsFor(src)
    const step = Math.max(2, Math.round(p.cellSize ?? 10))
    const ramp = (RAMPS.find((r) => r.value === p.charset) ?? RAMPS[0]).ramp

    ctx.save()
    ctx.scale(w / sw, h / sh) // glyph pass runs in source-pixel space
    ctx.fillStyle = p.bg ?? '#06070b'
    ctx.fillRect(0, 0, sw, sh)
    ctx.fillStyle = p.fg ?? '#f4f1ea'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${step}px ui-monospace, monospace`

    for (let y = 0; y < sh; y += step) {
      for (let x = 0; x < sw; x += step) {
        const cx = Math.min(sw - 1, x + (step >> 1))
        const cy = Math.min(sh - 1, y + (step >> 1))
        const i = (cy * sw + cx) << 2
        if (data[i + 3] < 20) continue // transparent cell — background shows
        let l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        if (p.invert) l = 1 - l
        const ch = ramp[Math.min(ramp.length - 1, Math.floor(l * ramp.length))]
        if (ch === ' ') continue
        ctx.fillText(ch, x + step / 2, y + step / 2)
      }
    }
    ctx.restore()
  },
}
