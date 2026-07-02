import { TAU, clamp01, lerp } from '../lib/util.js'

// Scanlines — cumulative-sum variable-density scanline engine. Canvas2D.
//
// The @polyhop "cumulative sum spacing" system, generalized. A GEOMETRY lays out
// scan-paths (horizontal rows, vertical columns, radial rays, concentric rings,
// or a spiral). Along each path we accumulate a local DENSITY read from a scalar
// FIELD (fbm noise / waves / radial lens) and emit a MARK every time the running
// sum crosses 1 — so marks bunch where the field is bright and spread where it's
// dark. Marks render as dots, dashes, a proximity-line mesh, or glyphs, optionally
// displaced along the path normal (the draped-terrain look) and optionally woven
// (rows + columns together).
//
// Ported from kol-labs-single scanlines as ONE loop def. Time is woven for the
// loop contract: the labs' free-running seconds `t` becomes a phase
// ph = TAU · u · flow (integer cycles) so frame(0) === frame(1) exactly. The
// image/video/webcam luma source and the pan/zoom camera stayed behind in labs
// (editor concerns); the Direction (drift angle) control went with the source —
// the noise scroll is now a circular orbit in noise space (see internalField),
// which has no meaningful direction.

// The cumulative sum starts at the path origin (x=0 for rows), so the first mark
// lands a gap in — a systematic empty margin on the leading edge. Overscan the whole
// render a touch around centre so that margin pushes off-canvas (bg still fills it).
const OVERSCAN = 1.2
// Radius of the seamless noise-scroll orbit (in field units). Tuned so one cycle
// covers about the same noise distance per loop as the labs' 0.3 units/s drift.
const DRIFT_R = 0.4

export const PALETTES = [
  { value: 'mono', label: 'Mono', bg: '#06070b', fg: '#f4f1ea' },
  { value: 'cream', label: 'Cream', bg: '#f4f1ea', fg: '#14161c' },
  { value: 'blueprint', label: 'Blueprint', bg: '#0a1628', fg: '#7fb6ff' },
  { value: 'ember', label: 'Ember', bg: '#0b0707', fg: '#ff7a3c' },
  { value: 'acid', label: 'Acid', bg: '#0a0d07', fg: '#c8ff4d' },
]
export const FIELD_OPTIONS = [
  { value: 'noise', label: 'Noise' },
  { value: 'waves', label: 'Waves' },
  { value: 'radial', label: 'Radial' },
]
export const GEOMETRY_OPTIONS = [
  { value: 'rows', label: 'Rows' },
  { value: 'columns', label: 'Columns' },
  { value: 'radial', label: 'Radial' },
  { value: 'rings', label: 'Rings' },
  { value: 'spiral', label: 'Spiral' },
]
export const MARK_OPTIONS = [
  { value: 'dots', label: 'Dots' },
  { value: 'dash', label: 'Dash' },
  { value: 'lattice', label: 'Lattice' },
  { value: 'glyph', label: 'Glyph' },
]
export const CHARSETS = {
  ascii: ' .:-=+*#%@',
  blocks: '░▒▓█',
  binary: '01',
  dots: '·•●',
}
export const CHARSET_OPTIONS = [
  { value: 'ascii', label: 'ASCII' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'binary', label: 'Binary' },
  { value: 'dots', label: 'Dots' },
]

// ── seedable value noise ──────────────────────────────────────────────────
function hash2(x, y, seed) {
  const s = Math.sin((x + seed * 0.137) * 127.1 + (y - seed * 0.219) * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x, y, seed) {
  let v = 0, amp = 0.5, f = 1
  for (let o = 0; o < 4; o++) { v += amp * vnoise(x * f, y * f, seed); f *= 2; amp *= 0.5 }
  return v
}

// scalar field 0..1 at normalized (nx,ny), phase ph = TAU·u·cycles. Every ph term
// closes an integer number of cycles per loop ⇒ seamless.
function internalField(field, nx, ny, ph, freq, lens, seed) {
  const cx = nx - 0.5, cy = ny - 0.5
  switch (field) {
    case 'waves': {
      // labs: sin((nx·freq·2 − t)·TAU·0.25) — the t·TAU·0.25 term is now ph; the
      // second wave ran at 0.6× the first, unified to 1× so both close per loop.
      const a = Math.sin(nx * freq * TAU * 0.5 - ph)
      const b = Math.sin(ny * freq * TAU * 0.5 + ph)
      return clamp01(0.5 + 0.35 * a + 0.15 * b)
    }
    case 'radial': {
      const r = Math.sqrt(cx * cx + cy * cy) * 2
      // Static lens bulge; the time breathe is the exposed Pulse (see fieldAt).
      return clamp01(1 - Math.pow(clamp01(r), Math.max(0.2, lens || 1)))
    }
    case 'noise':
    default:
      // labs scrolled the noise linearly (t·0.3·direction) — never seamless. The
      // loop orbits the sample window instead: a circle of radius DRIFT_R closes
      // exactly once per ph cycle.
      return clamp01(fbm(nx * freq + DRIFT_R * Math.cos(ph), ny * freq + DRIFT_R * Math.sin(ph), seed))
  }
}

// ── geometry: build the scan-paths ─────────────────────────────────────────
// Each path is { pts: [{x,y,nx,ny,sl}], amp } where (nx,ny) is the unit normal
// (displacement direction) and sl is the segment length used to advance the
// accumulator; amp is the displacement amplitude for that path.
// `spinAng` (radians) rotates the radial/rings/spiral layout — TAU·u·turns from
// the caller, integer turns ⇒ seamless; rows/columns have no centre to turn about.
function buildPaths(geo, W, H, p, spinAng) {
  const step = 2
  const out = []
  const spin = spinAng || 0
  if (geo === 'rows' || geo === 'columns') {
    const horiz = geo === 'rows'
    const count = Math.max(2, Math.round(p.rows ?? 90))
    const along = horiz ? W : H
    const amp = (horiz ? H / count : W / count) * 2.2
    for (let i = 0; i < count; i++) {
      const c = (i + 0.5) / count
      const pts = []
      for (let s = 0; s <= along; s += step) {
        const a = s / along
        pts.push({ x: horiz ? a * W : c * W, y: horiz ? c * H : a * H, nx: horiz ? 0 : 1, ny: horiz ? 1 : 0, sl: step })
      }
      out.push({ pts, amp })
    }
    return out
  }
  const cx = W / 2, cy = H / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  const unit = Math.min(W, H) / 1200
  if (geo === 'radial') {
    const rays = Math.max(8, Math.round(p.rayCount ?? 200))
    const swirl = p.swirl ?? 0
    for (let i = 0; i < rays; i++) {
      const base = (i / rays) * TAU + spin
      const pts = []
      for (let r = 4; r <= maxR; r += step) {
        const ang = base + swirl * (r / maxR) * TAU * 0.5
        pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, nx: -Math.sin(ang), ny: Math.cos(ang), sl: step })
      }
      out.push({ pts, amp: 12 * unit })
    }
    return out
  }
  if (geo === 'rings') {
    const rings = Math.max(3, Math.round(p.ringCount ?? 60))
    const swirl = p.swirl ?? 0
    for (let i = 0; i < rings; i++) {
      const rad = ((i + 0.5) / rings) * maxR
      const circ = TAU * rad
      const n = Math.max(8, Math.floor(circ / step))
      const sl = circ / n
      const off = swirl * (rad / maxR) * TAU + spin
      const pts = []
      for (let j = 0; j <= n; j++) {
        const ang = (j / n) * TAU + off
        pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, nx: Math.cos(ang), ny: Math.sin(ang), sl })
      }
      out.push({ pts, amp: (maxR / rings) * 1.6 })
    }
    return out
  }
  // spiral — one (or a few) arms
  const arms = Math.max(1, Math.round(p.arms ?? 1))
  const turns = Math.max(0.5, p.turns ?? 6)
  for (let a = 0; a < arms; a++) {
    const armOff = (a / arms) * TAU + spin
    const pts = []
    let r = 4
    while (r <= maxR) {
      const u = r / maxR
      const ang = armOff + u * turns * TAU
      const dAng = (step / maxR) * turns * TAU
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, nx: Math.cos(ang), ny: Math.sin(ang), sl: Math.sqrt(step * step + (r * dAng) * (r * dAng)) })
      r += step
    }
    out.push({ pts, amp: 12 * unit })
  }
  return out
}

// ── mark renderers ─────────────────────────────────────────────────────────
function strokePolyline(ctx, marks) {
  ctx.beginPath()
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i]
    if (i === 0) ctx.moveTo(m.x, m.y); else ctx.lineTo(m.x, m.y)
  }
  ctx.stroke()
}
// proximity lines between two ordered mark lists, nearest by primary axis
function crossConnect(ctx, marks, prev, axis, maxDist) {
  if (!prev || !prev.length) return
  let j = 0
  ctx.beginPath()
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i], k0 = axis === 'x' ? m.x : m.y
    while (j < prev.length - 1 && (axis === 'x' ? prev[j + 1].x : prev[j + 1].y) < k0) j++
    let k = j
    if (j + 1 < prev.length) {
      const dA = Math.abs((axis === 'x' ? prev[j].x : prev[j].y) - k0)
      const dB = Math.abs((axis === 'x' ? prev[j + 1].x : prev[j + 1].y) - k0)
      if (dB < dA) k = j + 1
    }
    const pp = prev[k]
    if (Math.abs((axis === 'x' ? pp.x : pp.y) - k0) < maxDist) { ctx.moveTo(m.x, m.y); ctx.lineTo(pp.x, pp.y) }
  }
  ctx.stroke()
}

function renderScanlines(ctx, u, W, H, p) {
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = p.fg
  ctx.strokeStyle = p.fg

  const seed = p.seed || 0
  const freq = (p.freq ?? 1) * 3
  const contrast = p.contrast ?? 1
  const minGap = Math.max(1, p.minGap ?? 5)
  const maxGap = Math.max(minGap + 1, p.maxGap ?? 24)
  const invert = !!p.invert
  const unit = Math.min(W, H) / 1200
  const markSize = (p.markSize ?? 1) * unit
  const displace = p.displace ?? 0
  const mark = p.mark || 'dots'

  // Animation, woven from u. Flow is whole field cycles per loop (0 ⇒ frozen);
  // Spin whole layout turns; Pulse breathes the field brightness. Integer cycle
  // counts everywhere ⇒ frame(0) === frame(1).
  const ph = TAU * u * Math.round(p.flow ?? 1)
  const spinAng = TAU * u * Math.round(p.spin ?? 0)
  const pulse = p.pulse ?? 0
  // Form › Sweep — each mark's SIZE breathes individually, phased across the canvas
  // (diagonal), so marks pulse in a travelling wave (the per-element animation, vs
  // Frame's whole-field drift). Multiplier 1±sweep; 0 ⇒ off. 2·ph ⇒ two waves per
  // loop, still integer ⇒ seamless.
  const sweepAmt = p.sweep ?? 0
  const sweepK = sweepAmt
    ? (mx, my) => 1 - sweepAmt * 0.5 + sweepAmt * 0.5 * Math.sin(2 * ph - (mx + my) * 0.012)
    : null

  const fieldAt = (x, y) => {
    /* `p.sample` (nx,ny)→0..1 overrides the procedural field — the labs
     * FILTER mode's luma hook, consumed by src/filters/scanline.js. */
    let f = p.sample ? p.sample(x / W, y / H) : internalField(p.field, x / W, y / H, ph, freq, p.lens, seed)
    if (pulse) f *= 1 - pulse * 0.5 * (1 - Math.sin(ph))
    if (invert) f = 1 - f
    if (contrast !== 1) f = clamp01(Math.pow(clamp01(f), contrast))
    return clamp01(f)
  }

  // geometry list (weave runs rows + columns together)
  const geos = p.weave && (p.geometry === 'rows' || p.geometry === 'columns')
    ? ['rows', 'columns']
    : [p.geometry || 'rows']

  if (mark === 'glyph') {
    const fs = (p.geometry === 'rows' || p.geometry === 'columns')
      ? (p.fontScale ?? 1) * (Math.min(W, H) / Math.max(2, Math.round(p.rows ?? 90))) * 1.05
      : (p.fontScale ?? 1) * 16 * unit
    ctx.font = `${fs.toFixed(1)}px ui-monospace, "SFMono-Regular", Menlo, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }
  const set = CHARSETS[p.charset] || CHARSETS.ascii
  const dashLen = (p.dashLen ?? 1) * 7
  const canCross = mark === 'lattice'

  // Overscan around centre so the leading-edge margin clears the frame (bg drawn
  // above already fills edge-to-edge).
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.scale(OVERSCAN, OVERSCAN)
  ctx.translate(-W / 2, -H / 2)

  for (const geo of geos) {
    const paths = buildPaths(geo, W, H, p, spinAng)
    const crossAxis = geo === 'rows' ? 'x' : geo === 'columns' ? 'y' : null
    let prev = null
    for (let li = 0; li < paths.length; li++) {
      const { pts, amp } = paths[li]
      const marks = []
      let acc = 0
      for (let k = 0; k < pts.length; k++) {
        const pt = pts[k]
        const f = fieldAt(pt.x, pt.y)
        acc += pt.sl / lerp(maxGap, minGap, f)
        if (acc >= 1) {
          acc -= 1
          const d = displace ? (f - 0.5) * displace * amp : 0
          marks.push({ x: pt.x + (d ? pt.nx * d : 0), y: pt.y + (d ? pt.ny * d : 0), f })
        }
      }
      if (mark === 'lattice') {
        ctx.lineWidth = Math.max(0.5, markSize * 0.9)
        strokePolyline(ctx, marks)
        if (crossAxis) crossConnect(ctx, marks, prev, crossAxis, amp)
        prev = canCross && crossAxis ? marks : null
      } else if (mark === 'glyph') {
        for (const m of marks) {
          const lvl = clamp01((m.f - 0.5) * (sweepK ? sweepK(m.x, m.y) : 1) + 0.5)
          const ch = set[Math.min(set.length - 1, Math.max(0, Math.floor(lvl * set.length)))]
          if (ch !== ' ') ctx.fillText(ch, m.x, m.y)
        }
      } else if (mark === 'dash') {
        ctx.lineWidth = Math.max(0.8, markSize * 1.4)
        ctx.beginPath()
        for (const m of marks) {
          const half = dashLen * (0.35 + 0.65 * m.f) * unit * (sweepK ? sweepK(m.x, m.y) : 1)
          ctx.moveTo(m.x - half, m.y); ctx.lineTo(m.x + half, m.y)
        }
        ctx.stroke()
      } else {
        const base = markSize * 1.6
        for (const m of marks) {
          const rad = base * (0.45 + m.f) * (sweepK ? sweepK(m.x, m.y) : 1)
          if (rad < 0.3) continue
          ctx.beginPath(); ctx.arc(m.x, m.y, rad, 0, TAU); ctx.fill()
        }
      }
    }
  }
  ctx.restore()
}

export { renderScanlines }

export default {
  id: 'scanline',
  label: 'Scanline',
  group: 'scanline',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b' },
    { key: 'fg', label: 'Ink', type: 'color', role: 'fg', default: '#f4f1ea' },
    { key: 'geometry', label: 'Geometry', type: 'select', options: GEOMETRY_OPTIONS, default: 'rows' },
    { key: 'mark', label: 'Mark', type: 'select', options: MARK_OPTIONS, default: 'dots' },
    { key: 'field', label: 'Field', type: 'select', options: FIELD_OPTIONS, default: 'noise' },
    { key: 'rows', label: 'Lines', type: 'range', min: 8, max: 260, step: 1, default: 90 },
    { key: 'rayCount', label: 'Rays', type: 'range', min: 16, max: 520, step: 1, default: 200 },
    { key: 'ringCount', label: 'Rings', type: 'range', min: 4, max: 200, step: 1, default: 60 },
    { key: 'turns', label: 'Turns', type: 'range', min: 1, max: 30, step: 0.5, default: 6 },
    { key: 'arms', label: 'Arms', type: 'range', min: 1, max: 8, step: 1, default: 1 },
    { key: 'swirl', label: 'Swirl', type: 'range', min: -1, max: 1, step: 0.02, default: 0 },
    { key: 'minGap', label: 'Min gap', type: 'range', min: 1, max: 24, step: 0.5, default: 5 },
    { key: 'maxGap', label: 'Max gap', type: 'range', min: 4, max: 64, step: 0.5, default: 24 },
    { key: 'freq', label: 'Field scale', type: 'range', min: 0.2, max: 4, step: 0.05, default: 1 },
    { key: 'lens', label: 'Lens', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1.6 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1 },
    { key: 'displace', label: 'Displace', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
    { key: 'weave', label: 'Weave', type: 'toggle', default: false },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    { key: 'markSize', label: 'Mark size', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'dashLen', label: 'Dash length', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1.2 },
    { key: 'charset', label: 'Charset', type: 'select', options: CHARSET_OPTIONS, default: 'ascii' },
    { key: 'fontScale', label: 'Font size', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1 },
    { key: 'seed', label: 'Seed', type: 'range', min: 0, max: 99, step: 1, default: 0 },
    { key: 'flow', label: 'Flow · cycles', type: 'range', min: 0, max: 4, step: 1, default: 1, noRandom: true },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: -2, max: 2, step: 1, default: 0, noRandom: true },
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0, noRandom: true },
    { key: 'sweep', label: 'Sweep', type: 'range', min: 0, max: 1, step: 0.05, default: 0, noRandom: true },
  ],
  draw(ctx, u, w, h, p) {
    renderScanlines(ctx, u, w, h, p)
  },
}
