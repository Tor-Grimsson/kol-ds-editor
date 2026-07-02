/**
 * Glass — displacement-map filter (ported from kol-labs-single pages/glass).
 * A procedural vector field offsets each output pixel's sample point into the
 * source image, fracturing/refracting it like a sheet of patterned glass.
 * Pure canvas2d, no deps.
 *
 * Motion is woven from the transport's u∈[0,1] with integer cycles so
 * frame(0) === frame(1) exactly:
 *   spin  — whole 360° turns of the field per loop (rotation is 360-periodic
 *           for every pattern ⇒ seamless).
 *   drift — the sheet pans on a circular orbit that closes once per loop
 *           (the labs' linear panSpeedX/Y scroll was never seamless).
 *   phase — the pattern's internal time swings ±phase·π on a sine, so every
 *           field closes regardless of its own t-periodicity (the labs' 0.7×
 *           second-wave and fbm scroll made a shared linear period impossible).
 *   pulse — shift amplitude breathes on one sine cycle (labs sin(t·3) → sin(TAU·u)).
 */

const TAU = Math.PI * 2

/* ── deterministic value noise (frosted "Glass" + shard patterns) ────── */
function hash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}
const fade = (t) => t * t * (3 - 2 * t)
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  const u = fade(xf), v = fade(yf)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1
  for (let i = 0; i < 4; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5 }
  return s
}
/* per-band signed offset, stable per index */
const band = (i) => hash2(i, 7) * 2 - 1

/* Each pattern: field(nx, ny, scale, t) -> [fx, fy] in roughly [-1,1].
 * nx,ny ∈ [0,1]; t is the woven animation clock — most are static at t=0. */
const PATTERNS = [
  { id: 'panes', label: 'Panes', field(nx, ny, s, t) {
    const n = Math.max(2, Math.round(3 + s * 6))
    const b = Math.floor(nx * n)
    const drift = t ? 0.25 * Math.sin(t + b) : 0
    return [band(b * 2) * 0.35, band(b * 2 + 1) + drift]
  } },
  { id: 'bands', label: 'Bands', field(nx, ny, s, t) {
    const n = Math.max(2, Math.round(3 + s * 6))
    const b = Math.floor(ny * n)
    const drift = t ? 0.25 * Math.sin(t + b) : 0
    return [band(b * 2) + drift, band(b * 2 + 1) * 0.35]
  } },
  { id: 'glass', label: 'Glass', field(nx, ny, s, t) {
    const f = 2 + s * 3, e = 0.012, ph = t * 0.15
    const base = fbm(nx * f + ph, ny * f)
    const gx = fbm((nx + e) * f + ph, ny * f) - base
    const gy = fbm(nx * f + ph, (ny + e) * f) - base
    return [(gx / e) * 0.12, (gy / e) * 0.12]
  } },
  { id: 'ripple', label: 'Ripple', field(nx, ny, s, t) {
    const dx = nx - 0.5, dy = ny - 0.5
    const r = Math.hypot(dx, dy) + 1e-4
    const w = Math.sin(r * (8 + s * 22) - t * 2)
    return [(dx / r) * w, (dy / r) * w]
  } },
  { id: 'waves', label: 'Waves', field(nx, ny, s, t) {
    const f = 4 + s * 12
    return [Math.sin(ny * f + t), Math.sin(nx * f + t * 0.7)]
  } },
  { id: 'diagonal', label: 'Diagonal', field(nx, ny, s) {
    const n = Math.max(2, Math.round(4 + s * 8))
    const o = band(Math.floor((nx + ny) * n))
    return [o * 0.7, o * 0.7]
  } },
  { id: 'shards', label: 'Shards', field(nx, ny, s) {
    const n = Math.max(2, Math.round(2 + s * 5))
    const cx = Math.floor(nx * n), cy = Math.floor(ny * n)
    return [band(cx * 31 + cy), band(cy * 31 + cx)]
  } },
  { id: 'grid', label: 'Grid', field(nx, ny, s) {
    const n = Math.max(2, Math.round(3 + s * 6))
    return [band(Math.floor(ny * n)), band(Math.floor(nx * n))]
  } },
  { id: 'lens', label: 'Lens', field(nx, ny, s) {
    const dx = nx - 0.5, dy = ny - 0.5
    const k = (0.5 - Math.hypot(dx, dy)) * (1 + s)
    return [dx * k * 2, dy * k * 2]
  } },
  { id: 'swirl', label: 'Swirl', field(nx, ny, s, t) {
    const dx = nx - 0.5, dy = ny - 0.5
    const a = (0.5 - Math.hypot(dx, dy)) * (2 + s * 4) + t * 0.5
    return [-dy * a * 2, dx * a * 2]
  } },
]
const PATTERN_OPTIONS = PATTERNS.map((p) => ({ value: p.id, label: p.label }))

/* Edge handling for an out-of-bounds sample coordinate. */
function edgeAt(v, n, mode) {
  if (v >= 0 && v < n) return v | 0
  if (mode === 'wrap') { let m = v % n; return (m < 0 ? m + n : m) | 0 }
  if (mode === 'mirror') {
    const p = n - 1, m = Math.abs(v) % (2 * p)
    return (m <= p ? m : 2 * p - m) | 0
  }
  return v < 0 ? 0 : n - 1 // clamp
}

/* Per-source pixel cache. The host hands us a NEW fitted canvas whenever the
 * source image / fit / size changes, so canvas identity is the cache key:
 * base pixels are read once per source, the output ImageData is reused every
 * frame (no per-frame getImageData / allocation). */
const pixelCache = new WeakMap()
function pixelsFor(src) {
  let e = pixelCache.get(src)
  if (!e) {
    const g = src.getContext('2d')
    e = { base: g.getImageData(0, 0, src.width, src.height), out: g.createImageData(src.width, src.height) }
    pixelCache.set(src, e)
  }
  return e
}

/* Shared blit canvas — putImageData ignores the dest ctx's dpr transform, so
 * we compose into this scratch and drawImage it (transform-aware) instead. */
let scratch = null
function scratchFor(w, h) {
  if (!scratch) scratch = document.createElement('canvas')
  if (scratch.width !== w) scratch.width = w
  if (scratch.height !== h) scratch.height = h
  return scratch
}

/* Core displacement pass over the fitted source pixels. With chroma > 0 the
 * R/G/B channels sample slightly different offsets (dispersion along the
 * displacement + a radial lens fringe) → chromatic aberration. Alpha is
 * carried from the sampled pixel (labs forced 255; `fit: contain` letterbox
 * would go black otherwise). */
function displace(src, q) {
  const w = src.width, h = src.height
  const { base, out } = pixelsFor(src)
  const sd = base.data
  const od = out.data

  const pat = PATTERNS.find((p) => p.id === q.pattern) || PATTERNS[0]
  const ax = (q.xShift / 100) * w * 0.25 // full shift ≈ quarter-frame
  const ay = (q.yShift / 100) * h * 0.25
  const m = q.mix / 100
  const rad = (q.angle * Math.PI) / 180
  const ca = Math.cos(rad), sa = Math.sin(rad)
  const cAmt = q.chroma / 100              // dispersion: per-channel displacement gain
  const cRad = (q.chroma / 100) * w * 0.02 // radial lens fringe (px)
  const hw = w / 2, hh = h / 2
  const edge = q.edge

  for (let y = 0; y < h; y++) {
    const ny = y / h
    for (let x = 0; x < w; x++) {
      // kaleidoscope fold: mirror the right half onto the left before sampling
      const fxBase = q.mirror && x >= w / 2 ? (w - 1 - x) : x
      // rotate sample-space into the field, then rotate the result back, so
      // the whole pattern turns with Angle. panX/panY slide the sheet.
      const cx = fxBase / w - 0.5 - q.panX, cy = ny - 0.5 - q.panY
      const v = pat.field(ca * cx + sa * cy + 0.5, -sa * cx + ca * cy + 0.5, q.scale, q.time)
      const dx = (ca * v[0] - sa * v[1]) * ax
      const dy = (sa * v[0] + ca * v[1]) * ay
      const di = (y * w + x) << 2

      if (q.chroma > 0) {
        const rx = (x - hw) / hw, ry = (y - hh) / hh // radial unit
        const rX = edgeAt(fxBase + dx * (1 + cAmt) + rx * cRad, w, edge)
        const rY = edgeAt(y + dy * (1 + cAmt) + ry * cRad, h, edge)
        const gX = edgeAt(fxBase + dx, w, edge), gY = edgeAt(y + dy, h, edge)
        const bX = edgeAt(fxBase + dx * (1 - cAmt) - rx * cRad, w, edge)
        const bY = edgeAt(y + dy * (1 - cAmt) - ry * cRad, h, edge)
        const gi = (gY * w + gX) << 2
        const r = sd[(rY * w + rX) << 2]
        const g = sd[gi + 1]
        const b = sd[((bY * w + bX) << 2) + 2]
        const a = sd[gi + 3]
        if (m >= 1) { od[di] = r; od[di + 1] = g; od[di + 2] = b; od[di + 3] = a }
        else {
          od[di] = sd[di] * (1 - m) + r * m
          od[di + 1] = sd[di + 1] * (1 - m) + g * m
          od[di + 2] = sd[di + 2] * (1 - m) + b * m
          od[di + 3] = sd[di + 3] * (1 - m) + a * m
        }
        continue
      }

      const si = (edgeAt(y + dy, h, edge) * w + edgeAt(fxBase + dx, w, edge)) << 2
      if (m >= 1) {
        od[di] = sd[si]; od[di + 1] = sd[si + 1]; od[di + 2] = sd[si + 2]; od[di + 3] = sd[si + 3]
      } else {
        od[di] = sd[di] * (1 - m) + sd[si] * m
        od[di + 1] = sd[di + 1] * (1 - m) + sd[si + 1] * m
        od[di + 2] = sd[di + 2] * (1 - m) + sd[si + 2] * m
        od[di + 3] = sd[di + 3] * (1 - m) + sd[si + 3] * m
      }
    }
  }
  return out
}

export default {
  id: 'glass',
  label: 'Glass',
  animated: true,
  params: [
    { key: 'pattern', label: 'Pattern', type: 'select', options: PATTERN_OPTIONS, default: 'panes' },
    { key: 'xShift', label: 'X shift', type: 'range', min: -100, max: 100, step: 1, default: 60 },
    { key: 'yShift', label: 'Y shift', type: 'range', min: -100, max: 100, step: 1, default: 0 },
    { key: 'scale', label: 'Scale', type: 'range', min: 0.2, max: 4, step: 0.05, default: 1.5 },
    { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    { key: 'mix', label: 'Mix', type: 'range', min: 0, max: 100, step: 1, default: 100 },
    { key: 'chroma', label: 'Chroma', type: 'range', min: 0, max: 100, step: 1, default: 0 },
    { key: 'edge', label: 'Edge', type: 'select', default: 'clamp',
      options: [
        { value: 'clamp', label: 'Clamp' },
        { value: 'wrap', label: 'Wrap' },
        { value: 'mirror', label: 'Mirror' },
      ] },
    { key: 'mirror', label: 'Mirror fold', type: 'toggle', default: false },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: -2, max: 2, step: 1, default: 0 },
    { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0 },
    /* time-less pattern fields (no t arg) ignore phase */
    { key: 'phase', label: 'Phase', type: 'range', min: 0, max: 3, step: 0.05, default: 0, when: (l) => !['diagonal', 'shards', 'grid', 'lens'].includes(l.pattern) },
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  apply(ctx, src, w, h, p, u) {
    const osc = Math.sin(TAU * u)
    const amp = 1 + (p.pulse ?? 0) * 0.4 * osc
    const out = displace(src, {
      pattern: p.pattern,
      scale: p.scale ?? 1.5,
      mix: p.mix ?? 100,
      edge: p.edge ?? 'clamp',
      mirror: !!p.mirror,
      chroma: p.chroma ?? 0,
      angle: (p.angle ?? 0) + 360 * u * Math.round(p.spin ?? 0),
      xShift: (p.xShift ?? 0) * amp,
      yShift: (p.yShift ?? 0) * amp,
      panX: (p.drift ?? 0) * Math.cos(TAU * u),
      panY: (p.drift ?? 0) * Math.sin(TAU * u),
      time: (p.phase ?? 0) * Math.PI * osc,
    })
    const s = scratchFor(src.width, src.height)
    s.getContext('2d').putImageData(out, 0, 0)
    ctx.drawImage(s, 0, 0, w, h)
  },
}
