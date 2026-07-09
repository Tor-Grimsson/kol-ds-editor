/**
 * ASCII — full port of kol-labs-single radar/effects/asciiEngine.js (the
 * HALFTONE trio's ASCII page). Image → character cells; each algorithm is a
 * different letterform strategy: density ramps (8 charsets), gradient-directed
 * edge strokes, braille 2×4 sub-cell dots, or a user-typed custom ramp.
 * Transparent cells (`fit: contain` letterbox) draw no glyph, so the
 * background shows through.
 *
 * Amount is the labs dry/wet dial (photo crossfaded back over the glyphs);
 * motion is the STACKED sweep rig (sweeps.js, `params.sweeps` array with the
 * labs one-click presets) — woven from the transport's u with integer
 * cycles, so every sweep shape loops seamlessly. Same id as the old 5-param
 * port, superset params: legacy keys (cellSize / charset / fg / bg / invert)
 * resolve unchanged.
 */
import { AMOUNT_PARAM, mixSourceOver, registerSourceCache } from './fxCore.js'
import { NO_SWEEP, sweepStates, evalSweeps, anyReveal } from './sweeps.js'

const DENSITY_RAMP = ' .:-=+*#%@'
const EDGE_GLYPHS = ['—', '\\', '|', '/'] // by gradient direction, quantized

const ALGORITHM_OPTIONS = [
  { value: 'density', label: 'Density' },
  { value: 'edges', label: 'Edges' },
  { value: 'braille', label: 'Braille' },
  { value: 'custom', label: 'Custom ramp' },
]

/* Ramps for the density algorithm — ordered sparse → dense (labs originals). */
const CHARSETS = [
  { value: 'classic', label: 'Classic', ramp: DENSITY_RAMP },
  { value: 'extended', label: 'Extended', ramp: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { value: 'blocks', label: 'Blocks', ramp: ' ░▒▓█' },
  { value: 'minimal', label: 'Minimal', ramp: ' .·:*' },
  { value: 'binary', label: 'Binary', ramp: ' 01' },
  { value: 'hex', label: 'Hex', ramp: ' 0123456789ABCDEF' },
  { value: 'katakana', label: 'Katakana', ramp: ' ･ｨｩｮｺﾆﾊﾎﾒﾗﾜ' },
  { value: 'strokes', label: 'Strokes', ramp: " `'-/\\|+X#" },
]
const CHARSET_OPTIONS = CHARSETS.map(({ value, label }) => ({ value, label }))

/* Braille dot bit order: 1-3 left col, 4-6 right col, 7-8 bottom row
 * (U+2800 + bits) — [col, row, bit] per sub-cell. */
const BRAILLE_DOTS = [
  [0, 0, 0x01], [0, 1, 0x02], [0, 2, 0x04], [1, 0, 0x08],
  [1, 1, 0x10], [1, 2, 0x20], [0, 3, 0x40], [1, 3, 0x80],
]

const rampChar = (ramp, l) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(l * ramp.length)))]

/* Per-source pixel cache (glass.js pattern) — the host hands us a NEW fitted
 * canvas whenever the image/fit/size changes, so canvas identity is the key:
 * base pixels read once per source, nothing allocated per frame. */
const pixelCache = new WeakMap()
registerSourceCache(pixelCache)   /* chain intermediates / loop sources invalidate in place */
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
  animated: true,
  sweeps: true,   /* stacked sweep rig (sweeps.js) — Effects panel Motion tab */
  params: [
    { ...AMOUNT_PARAM, section: 'Effect' },
    { key: 'algorithm', label: 'Algorithm', type: 'select', options: ALGORITHM_OPTIONS, default: 'density', section: 'Algorithm' },
    { key: 'charset', label: 'Charset', type: 'select', options: CHARSET_OPTIONS, default: 'classic', section: 'Algorithm', when: (l) => (l.algorithm ?? 'density') === 'density' },
    { key: 'ramp', label: 'Custom ramp', type: 'text', rows: 1, placeholder: DENSITY_RAMP, default: DENSITY_RAMP, section: 'Characters', when: (l) => l.algorithm === 'custom' },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false, section: 'Characters' },
    { key: 'glyphScale', label: 'Glyph scale', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, section: 'Characters' },
    /* noRandom: cell size is grid resolution — a size thing, not a look. */
    { key: 'cellSize', label: 'Cell size', type: 'range', min: 4, max: 40, step: 1, default: 10, noRandom: true, section: 'Cells' },
    { key: 'contrast', label: 'Contrast', type: 'range', min: -100, max: 100, step: 1, default: 0, section: 'Cells' },
    { key: 'useColor', label: 'Original color', type: 'toggle', default: true, section: 'Color' },
    { key: 'fg', label: 'Foreground', type: 'color', role: 'fg', default: '#f4f1ea', section: 'Color', when: (l) => !(l.useColor ?? true) },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b', section: 'Color' },
  ],
  apply(ctx, src, w, h, p, u) {
    if ((p.amount ?? 100) <= 0) { ctx.drawImage(src, 0, 0, w, h); return }
    const sw = src.width
    const sh = src.height
    const data = pixelsFor(src)
    /* The source is dpr-backed (sw = w·dpr); cellSize is authored in css px,
     * so scale it into source-pixel space (k = 1 at dpr 1 — identical). */
    const k = sw / w || 1
    const step = Math.max(2, Math.round((p.cellSize ?? 10) * k))
    const algorithm = p.algorithm ?? 'density'
    const useColor = p.useColor ?? true
    const invert = !!p.invert

    const st = sweepStates(p, u)
    const reveal = anyReveal(st)
    const geo = !!st && st.some((s) => s.target === 'geometry')

    const contrast = p.contrast ?? 0
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast))
    const adjust = (v) => Math.max(0, Math.min(255, cf * (v - 128) + 128))

    /* Contrast-adjusted, optionally inverted luma at a pixel (clamped);
     * null for transparent (letterbox) pixels — the cell draws nothing. */
    const lumaAt = (px, py) => {
      const cx = Math.max(0, Math.min(sw - 1, Math.round(px)))
      const cy = Math.max(0, Math.min(sh - 1, Math.round(py)))
      const i = (cy * sw + cx) << 2
      if (data[i + 3] < 20) return null
      const l = (0.299 * adjust(data[i]) + 0.587 * adjust(data[i + 1]) + 0.114 * adjust(data[i + 2])) / 255
      return invert ? 1 - l : l
    }
    const colorAt = (px, py) => {
      const cx = Math.max(0, Math.min(sw - 1, Math.round(px)))
      const cy = Math.max(0, Math.min(sh - 1, Math.round(py)))
      const i = (cy * sw + cx) << 2
      return `rgb(${Math.floor(adjust(data[i]))},${Math.floor(adjust(data[i + 1]))},${Math.floor(adjust(data[i + 2]))})`
    }

    const ramp = algorithm === 'custom'
      ? ((p.ramp && p.ramp.length) ? p.ramp : DENSITY_RAMP)
      : (CHARSETS.find((c) => c.value === p.charset) ?? CHARSETS[0]).ramp

    ctx.save()
    ctx.scale(w / sw, h / sh) // glyph pass runs in source-pixel space
    ctx.fillStyle = p.bg ?? '#06070b'
    ctx.fillRect(0, 0, sw, sh)
    // Reveal sweeps wipe glyphs in/out over the raw photo, so it goes underneath.
    if (reveal) ctx.drawImage(src, 0, 0, sw, sh)

    ctx.fillStyle = p.fg ?? '#f4f1ea'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${Math.max(4, step * (p.glyphScale ?? 1))}px ui-monospace, monospace`

    for (let y = 0; y < sh; y += step) {
      for (let x = 0; x < sw; x += step) {
        const cx = x + step / 2
        const cy = y + step / 2
        let l = lumaAt(cx, cy)
        if (l == null) continue

        const pkt = st ? evalSweeps(st, cx / sw, cy / sh) : NO_SWEEP
        if (pkt.hasReveal && pkt.reveal < 0.5) continue // photo underlay shows through
        if (pkt.bright) l = Math.max(0, Math.min(1, l + pkt.bright))

        let ch = null
        switch (algorithm) {
          case 'edges': {
            const lR = lumaAt(cx + step, cy)
            const lB = lumaAt(cx, cy + step)
            if (lR == null || lB == null) break
            const dx = lR - l
            const dy = lB - l
            const mag = Math.hypot(dx, dy)
            if (mag < 0.06) { ch = l > 0.5 ? '·' : null; break }
            // gradient direction → stroke perpendicular to it (follows the edge)
            const ang = Math.atan2(dy, dx) + Math.PI / 2
            const bin = Math.round(((ang + Math.PI) / Math.PI) * 2) % 4
            ch = EDGE_GLYPHS[bin]
            break
          }
          case 'braille': {
            // 2×4 sub-cells per glyph, thresholded at mid-luma
            const sx = step / 2
            const sy = step / 4
            let bits = 0
            for (let k = 0; k < BRAILLE_DOTS.length; k++) {
              const d = BRAILLE_DOTS[k]
              const sl = lumaAt(x + sx * d[0] + sx / 2, y + sy * d[1] + sy / 2)
              if (sl != null && sl > 0.5) bits |= d[2]
            }
            if (bits === 0) break
            ch = String.fromCharCode(0x2800 + bits)
            break
          }
          case 'density':
          case 'custom':
          default:
            ch = rampChar(ramp, l)
            break
        }
        if (!ch || ch === ' ') continue

        if (useColor) ctx.fillStyle = colorAt(cx, cy)
        if (geo) {
          ctx.save()
          ctx.translate(cx + pkt.offX * step, cy + pkt.offY * step)
          ctx.rotate(pkt.rot)
          ctx.scale(pkt.scaleMul, pkt.scaleMul)
          ctx.fillText(ch, 0, 0)
          ctx.restore()
        } else {
          ctx.fillText(ch, cx, cy)
        }
      }
    }
    ctx.restore()
    mixSourceOver(ctx, src, w, h, p.amount) // dry/wet: photo back over the glyphs
  },
}
