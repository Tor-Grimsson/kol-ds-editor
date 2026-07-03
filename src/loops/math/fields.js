import { mulberry32 } from './rng.js'

// Fields (ported from kol-labs-single math/fields: render.js + the
// FieldsEditor.jsx draw loop). Two render kinds behind one loop, like the
// surface/attractor pair:
//   kind 'scalar'  — f(x,y) heatmap + flow particles riding the perpendicular-
//                    gradient field (+ swirl vortex / drift wind biases)
//   kind 'complex' — domain coloring of f(z): hue = arg, rings = log₂|f|,
//                    animated by hue/ring phase, whole-field spin + zoom breathe
//
// PURE IN u. What changed vs labs:
//   • compileVars expression evaluation did NOT come along — f(x,y) is a select
//     over the labs SCALAR_EXPRS, frozen to plain JS (the surface-port idiom).
//     The complex f(z) maps were already frozen JS (render.js COMPLEX_FUNCS).
//   • The labs particles were ADVECTED state (integrated per rAF frame, random
//     respawn). Here each particle's whole STREAMLINE is integrated once at
//     model build (memoized), and the particle replays it as a function of u —
//     an integer number of traversals per loop per particle ⇒ seamless AND
//     scrubbable. Jitter became a deterministic per-particle shimmer.
//   • Per-frame pixel work is capped like the field family's raster.js:
//     the heatmap paints once per param change (CAP 700) and blits; the complex
//     remap runs per frame on a CAP-640 buffer (labs remapped on the GPU at up
//     to 2600 — the CPU port downscales instead of dropping the presets).
//   • Rates snapped to integer cycles per loop (hue/ring phase, shade + zoom
//     breathe, spin turns), so every phase term closes at u=1.

const TAU = Math.PI * 2
const DURATION = 12 // seconds per loop — also the cycle-snap denominator
const HEAT_CAP = 700 // scalar heatmap buffer long edge (labs CAP)
const COMPLEX_CAP = 640 // complex remap buffer long edge (per-frame CPU work)

// ── Frozen scalar fields (labs SCALAR_EXPRS, compileVars dropped).
export const FIELD_FN_OPTIONS = [
  { value: 'waves', label: 'sin x · cos y', fn: (x, y) => Math.sin(x) * Math.cos(y) },
  { value: 'ripples', label: 'sin 2r', fn: (x, y) => Math.sin(Math.hypot(x, y) * 2) },
  { value: 'saddle', label: 'x² − y²', fn: (x, y) => x * x - y * y },
  { value: 'sinsum', label: 'sin 1.5x + cos 1.5y', fn: (x, y) => Math.sin(x * 1.5) + Math.cos(y * 1.5) },
  { value: 'vortex', label: 'θ + r', fn: (x, y) => Math.atan2(y, x) + Math.hypot(x, y) },
]
const fieldFn = (id) => (FIELD_FN_OPTIONS.find((f) => f.value === id) || FIELD_FN_OPTIONS[0]).fn

// ── Complex arithmetic + curated f(z) maps (verbatim from labs render.js).
const C = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d] },
  exp: (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])] },
  sin: (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])],
  sq: (a) => C.mul(a, a),
  cube: (a) => C.mul(C.mul(a, a), a),
}
export const COMPLEX_FUNCS = [
  { id: 'z2-1', label: 'z² − 1', f: (z) => C.sub(C.sq(z), [1, 0]) },
  { id: 'z3-1', label: 'z³ − 1', f: (z) => C.sub(C.cube(z), [1, 0]) },
  { id: 'inv', label: '1 / z', f: (z) => C.div([1, 0], z) },
  { id: 'rat', label: '(z²−1)/(z²+1)', f: (z) => { const z2 = C.sq(z); return C.div(C.sub(z2, [1, 0]), C.add(z2, [1, 0])) } },
  { id: 'zinv', label: 'z + 1/z', f: (z) => C.add(z, C.div([1, 0], z)) },
  { id: 'sin', label: 'sin z', f: (z) => C.sin(z) },
  { id: 'exp', label: 'eᶻ', f: (z) => C.exp(z) },
  { id: 'poly5', label: 'z⁵ + z − 1', f: (z) => { const z2 = C.sq(z); const z5 = C.mul(C.sq(z2), z); return C.sub(C.add(z5, z), [1, 0]) } },
]
const complexFn = (id) => (COMPLEX_FUNCS.find((f) => f.id === id) || COMPLEX_FUNCS[0]).f

const toRGB = (h) => { const s = (h || '#000000').replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }

// hsv at s=1 (verbatim from labs render.js).
function hsv(h, s, v) {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: return [v, t, p]
    case 1: return [q, v, p]
    case 2: return [p, v, t]
    case 3: return [p, q, v]
    case 4: return [t, p, v]
    default: return [v, p, q]
  }
}

const DRIFT_DIRS = [
  { value: 'right', label: 'Right', vec: [1, 0] }, { value: 'left', label: 'Left', vec: [-1, 0] },
  { value: 'up', label: 'Up', vec: [0, 1] }, { value: 'down', label: 'Down', vec: [0, -1] },
  { value: 'diag', label: 'Diagonal', vec: [0.7071, 0.7071] }, { value: 'anti', label: 'Anti-diagonal', vec: [-0.7071, 0.7071] },
]
const driftVec = (id) => (DRIFT_DIRS.find((d) => d.value === id) || DRIFT_DIRS[0]).vec

// ── Scalar heatmap — painted once per (fn, view, ramp, size), then blitted.
let heat = null // { key, canvas }
function heatCanvas(w, h, p) {
  const k = Math.min(1, HEAT_CAP / Math.max(w, h))
  const rw = Math.max(1, Math.round(w * k))
  const rh = Math.max(1, Math.round(h * k))
  const key = `${p.fn}|${p.range}|${p.low}|${p.high}|${rw}x${rh}`
  if (heat && heat.key === key) return heat.canvas
  const canvas = heat?.canvas || document.createElement('canvas')
  canvas.width = rw
  canvas.height = rh
  const bctx = canvas.getContext('2d')
  // labs paintHeat, verbatim: value ramp low→high over the sampled min/max.
  const f = fieldFn(p.fn)
  const range = p.range
  const vals = new Float64Array(rw * rh)
  let mn = Infinity
  let mx = -Infinity
  const aspect = rh / rw
  for (let py = 0; py < rh; py++) {
    const y = -(py / rh - 0.5) * range * aspect
    for (let px = 0; px < rw; px++) {
      const x = (px / rw - 0.5) * range
      let v = f(x, y)
      if (!Number.isFinite(v)) v = 0
      vals[py * rw + px] = v
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }
  const span = (mx - mn) || 1
  const A = toRGB(p.low)
  const B = toRGB(p.high)
  const img = bctx.createImageData(rw, rh)
  const data = img.data
  for (let i = 0; i < rw * rh; i++) {
    const t = (vals[i] - mn) / span
    const idx = i * 4
    data[idx] = A[0] + (B[0] - A[0]) * t
    data[idx + 1] = A[1] + (B[1] - A[1]) * t
    data[idx + 2] = A[2] + (B[2] - A[2]) * t
    data[idx + 3] = 255
  }
  bctx.putImageData(img, 0, 0)
  heat = { key, canvas }
  return canvas
}

// ── Streamlines — the pure replacement for labs' advected particles. Each
// particle owns a precomputed path (labs' per-frame integration, batched) and
// K whole traversals per loop; position at u = path[frac(o + u·K)·len].
function makeStreamlines(p, aspect) {
  const rng = mulberry32((p.seed ?? 1) >>> 0)
  const f = fieldFn(p.fn)
  const range = p.range
  const halfH = (range * aspect) / 2
  const eps = range * 0.003
  const speed = Math.max(0.05, p.flowSpeed ?? 1)
  const step = speed * range * 0.001 // labs' per-frame step at 60fps, tempo 120
  const swirl = p.swirl || 0
  const drift = p.drift || 0
  const [dvx, dvy] = driftVec(p.driftDir)
  const N = Math.max(1, Math.round(p.count ?? 700))
  const parts = []
  for (let i = 0; i < N; i++) {
    let x = (rng() - 0.5) * range
    let y = (rng() - 0.5) * halfH * 2
    const K = 3 + Math.floor(rng() * 4) // whole traversals per loop ⇒ seamless
    const L = Math.min(200, Math.round((60 * DURATION) / K)) // labs life ≈ frames
    const pts = new Float64Array((L + 1) * 2)
    pts[0] = x
    pts[1] = y
    let n = 1
    for (let s = 1; s <= L; s++) {
      const fx = (f(x + eps, y) - f(x - eps, y)) / (2 * eps)
      const fy = (f(x, y + eps) - f(x, y - eps)) / (2 * eps)
      let ux = fy
      let vy = -fx
      if (swirl) { ux += -swirl * y; vy += swirl * x }
      if (drift) { ux += drift * dvx; vy += drift * dvy }
      const m = Math.hypot(ux, vy) || 1
      x += (ux / m) * step
      y += (vy / m) * step
      if (!Number.isFinite(x) || Math.abs(x) > range / 2 || Math.abs(y) > halfH) break
      pts[n * 2] = x
      pts[n * 2 + 1] = y
      n++
    }
    if (n < 2) continue
    parts.push({ pts, n, K, o: rng(), jphase: rng() * TAU, jcyc: 4 + Math.floor(rng() * 5) })
  }
  return parts
}
const STREAMS = new Map()
function getStreamlines(p, w, h) {
  const aspect = Math.round((h / w) * 100) / 100
  const sig = [p.fn, p.range, p.count, p.seed, p.flowSpeed, p.swirl, p.drift, p.driftDir, aspect].join('|')
  let m = STREAMS.get(sig)
  if (!m) {
    m = makeStreamlines(p, aspect)
    STREAMS.set(sig, m)
    while (STREAMS.size > 4) STREAMS.delete(STREAMS.keys().next().value)
  }
  return m
}

// ── Complex field — arg + log₂|f| cached per (func, view, size); the cheap
// per-frame remap (hue/ring phase + shade) runs on the CAP-sized buffer.
let cfield = null // { key, w, h, arg, logmod, bad }
function complexField(w, h, p) {
  const k = Math.min(1, COMPLEX_CAP / Math.max(w, h))
  const rw = Math.max(1, Math.round(w * k))
  const rh = Math.max(1, Math.round(h * k))
  const key = `${p.funcId}|${p.range}|${rw}x${rh}`
  if (cfield && cfield.key === key) return cfield
  const f = complexFn(p.funcId)
  const n = rw * rh
  const arg = new Float32Array(n)
  const logmod = new Float32Array(n)
  const bad = new Uint8Array(n)
  const aspect = rh / rw
  for (let py = 0; py < rh; py++) {
    const im = -(py / rh - 0.5) * p.range * aspect
    const row = py * rw
    for (let px = 0; px < rw; px++) {
      const re = (px / rw - 0.5) * p.range
      const i = row + px
      let wr = 0
      let wi = 0
      try { const o = f([re, im]); wr = o[0]; wi = o[1] } catch { /* singular */ }
      if (!Number.isFinite(wr) || !Number.isFinite(wi)) { bad[i] = 1; continue }
      arg[i] = Math.atan2(wi, wr)
      logmod[i] = Math.log2(Math.hypot(wr, wi) + 1e-12)
    }
  }
  cfield = { key, w: rw, h: rh, arg, logmod, bad }
  return cfield
}

let cbuf = null // complex remap buffer (canvas + ImageData, reused)
function paintComplex(field, { coloring, huePhase, ringPhase, shade }) {
  const { w, h, arg, logmod, bad } = field
  if (!cbuf) cbuf = { canvas: document.createElement('canvas'), img: null }
  const canvas = cbuf.canvas
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
    cbuf.img = null
  }
  const bctx = canvas.getContext('2d')
  if (!cbuf.img) cbuf.img = bctx.createImageData(w, h)
  const data = cbuf.img.data
  const n = w * h
  const vScale = 1 - shade
  for (let i = 0; i < n; i++) {
    const idx = i * 4
    if (bad[i]) { data[idx] = data[idx + 1] = data[idx + 2] = 0; data[idx + 3] = 255; continue }
    const H = (((arg[i] / TAU) + 1 + huePhase) % 1 + 1) % 1
    let V = 1
    if (coloring === 'smooth') {
      const mod = Math.pow(2, logmod[i])
      V = 0.35 + 0.65 * (2 / Math.PI) * Math.atan(mod)
    } else {
      const k = logmod[i] + ringPhase
      V = 0.55 + 0.45 * (k - Math.floor(k))
      if (coloring === 'contour') {
        const a2 = (arg[i] + huePhase * TAU) / (Math.PI / 6)
        V *= 0.4 + 0.6 * Math.min(1, Math.abs(a2 - Math.round(a2)) * 6)
      }
    }
    const [r, g, b] = hsv(H, 1, V * vScale)
    data[idx] = r * 255
    data[idx + 1] = g * 255
    data[idx + 2] = b * 255
    data[idx + 3] = 255
  }
  bctx.putImageData(cbuf.img, 0, 0)
  return canvas
}

// Kind gates for the schema.
const isScalar = (l) => (l.kind ?? 'scalar') !== 'complex'
const isComplex = (l) => l.kind === 'complex'

export default {
  id: 'math-field',
  label: 'Field',
  group: 'math',
  kind: '2d',
  duration: DURATION,
  params: [
    { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'scalar', label: 'Scalar' }, { value: 'complex', label: 'Complex' }], default: 'scalar' },
    { key: 'fn', label: 'f(x, y)', type: 'select', options: FIELD_FN_OPTIONS.map(({ value, label }) => ({ value, label })), default: 'waves', when: isScalar },
    { key: 'funcId', label: 'f(z)', type: 'select', options: COMPLEX_FUNCS.map(({ id, label }) => ({ value: id, label })), default: 'z2-1', when: isComplex },
    { key: 'coloring', label: 'Coloring', type: 'select', options: [{ value: 'rings', label: 'Rings' }, { value: 'smooth', label: 'Smooth' }, { value: 'contour', label: 'Contour' }], default: 'rings', when: isComplex },
    { key: 'range', label: 'Range', type: 'range', min: 1, max: 40, step: 0.5, default: 8 },
    { key: 'low', label: 'Low', type: 'color', role: 'bg', default: '#0b1530', when: isScalar },
    { key: 'high', label: 'High', type: 'color', role: 'accent', default: '#ffce54', when: isScalar },
    { key: 'stroke', label: 'Particles', type: 'color', role: 'fg', default: '#ffffff', when: isScalar },
    { key: 'flow', label: 'Flow', type: 'toggle', default: true, when: isScalar },
    { key: 'dots', label: 'Dots', type: 'toggle', default: false, when: isScalar },
    { key: 'count', label: 'Count', type: 'range', min: 100, max: 3000, step: 100, default: 700, noRandom: true, when: isScalar },
    { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 99, step: 1, default: 1, noRandom: true, when: isScalar },
    // Frame (scalar: field motion · complex: whole-field motion)
    { key: 'flowSpeed', label: 'Flow speed', type: 'range', min: 0, max: 4, step: 0.1, default: 1, tab: 'anim', section: 'Frame', when: isScalar },
    { key: 'swirl', label: 'Swirl', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Frame', when: isScalar },
    { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Frame', when: isScalar },
    { key: 'driftDir', label: 'Direction', type: 'select', options: DRIFT_DIRS.map(({ value, label }) => ({ value, label })), default: 'right', tab: 'anim', section: 'Frame', when: isScalar },
    { key: 'hueSpeed', label: 'Hue speed', type: 'range', min: 0, max: 3, step: 0.1, default: 1, tab: 'anim', section: 'Frame', when: isComplex },
    { key: 'cspin', label: 'Spin', type: 'range', min: 0, max: 2, step: 0.05, default: 0, tab: 'anim', section: 'Frame', when: isComplex },
    { key: 'czoom', label: 'Zoom', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Frame', when: isComplex },
    // Form (scalar: per-particle · complex: rings + shade)
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form', when: isScalar },
    { key: 'jitter', label: 'Jitter', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form', when: isScalar },
    { key: 'ringSpeed', label: 'Ring speed', type: 'range', min: 0, max: 3, step: 0.1, default: 1, tab: 'anim', section: 'Form', when: isComplex },
    { key: 'shade', label: 'Shade', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form', when: isComplex },
  ],
  draw(ctx, u, w, h, p) {
    if (p.kind === 'complex') {
      // Rates → whole cycles/turns per loop (labs rad/s × duration, rounded).
      const hueCyc = Math.round(0.08 * (p.hueSpeed ?? 1) * DURATION)
      const ringCyc = Math.round(0.25 * (p.ringSpeed ?? 1) * DURATION)
      const spinTurns = Math.round(0.4 * (p.cspin ?? 0) * DURATION / TAU)
      const shadeCyc = Math.round(2 * DURATION / TAU)
      const zoomCyc = Math.round(1.2 * DURATION / TAU)
      const field = complexField(w, h, p)
      const buf = paintComplex(field, {
        coloring: p.coloring || 'rings',
        huePhase: u * hueCyc,
        ringPhase: -u * ringCyc,
        shade: p.shade ? p.shade * 0.5 * (1 - Math.cos(u * TAU * shadeCyc)) : 0,
      })
      const spin = u * spinTurns * TAU
      const z = 1 + (p.czoom ? p.czoom * 0.18 * Math.sin(u * TAU * zoomCyc) : 0)
      if (spinTurns || p.czoom) {
        // overscan ×√2 so the rotated square still covers the frame (constant
        // across the loop, so u=0 and u=1 frame identically)
        const cover = (spinTurns ? Math.SQRT2 : 1) * z
        ctx.save()
        ctx.translate(w / 2, h / 2)
        ctx.rotate(spin)
        ctx.scale(cover, cover)
        ctx.drawImage(buf, -w / 2, -h / 2, w, h)
        ctx.restore()
      } else {
        ctx.drawImage(buf, 0, 0, w, h)
      }
      return
    }

    // ── Scalar: blit the cached heatmap, then replay the streamlines.
    ctx.drawImage(heatCanvas(w, h, p), 0, 0, w, h)
    if (p.flow === false) return

    const parts = getStreamlines(p, w, h)
    const range = p.range
    const ppw = w / range
    const sx = (x) => w / 2 + x * ppw
    const sy = (y) => h / 2 - y * ppw
    const pulseCyc = Math.round(2 * DURATION / TAU)
    const widthPulse = 1 + (p.pulse || 0) * Math.sin(u * TAU * pulseCyc)
    const jitAmp = (p.jitter || 0) * range * 0.01
    const dotR = Math.max(1, w * 0.0016 * widthPulse)
    const stroke = toRGB(p.stroke || '#ffffff')
    ctx.lineWidth = Math.max(1, w * 0.0012 * widthPulse)
    ctx.strokeStyle = `rgba(${stroke[0]},${stroke[1]},${stroke[2]},0.55)`
    ctx.fillStyle = `rgba(${stroke[0]},${stroke[1]},${stroke[2]},0.7)`
    ctx.beginPath()
    for (const part of parts) {
      const phase = ((part.o + u * part.K) % 1 + 1) % 1
      const j = Math.max(1, Math.min(part.n - 1, Math.round(phase * (part.n - 1))))
      let x = part.pts[j * 2]
      let y = part.pts[j * 2 + 1]
      if (jitAmp) {
        const wob = Math.sin(u * TAU * part.jcyc + part.jphase)
        x += jitAmp * wob
        y += jitAmp * Math.cos(u * TAU * part.jcyc + part.jphase)
      }
      if (p.dots) {
        const X = sx(x)
        const Y = sy(y)
        ctx.moveTo(X + dotR, Y)
        ctx.arc(X, Y, dotR, 0, TAU)
      } else {
        ctx.moveTo(sx(part.pts[(j - 1) * 2]), sy(part.pts[(j - 1) * 2 + 1]))
        ctx.lineTo(sx(x), sy(y))
      }
    }
    if (p.dots) ctx.fill()
    else ctx.stroke()
  },
}
