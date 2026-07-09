import { orbitEye, projector } from './surface.js'
import { compileSlot } from './mathfn.js'
import { drawAxes3D, AXIS_3D_OPTIONS } from './axes.js'

// Parametric curves (ported from kol-labs-single math/uzumaki: data/clips.js +
// engine/sample.js, hosted in labs by the ClipEditor). A clip = a parametric
// figure (epicycle / polar / param2d / param3d / points / maurer, shaped by
// repeat/spiral modifiers) explored by the same hand-rolled perspective
// projector the surface loop uses.
//
// PURE IN u. What changed vs labs:
//   • Stock clips stay frozen JS, but the labs ClipEditor authoring layer came
//     along: picking 'Custom' (or forking a stock clip via the CurveEditor
//     inspector) reads the layer's `custom` def — kind + ranges + expression
//     STRINGS compiled by ./mathfn.js (the hardened funcgen port; variables:
//     polar r(th) · param x/y/z(t) · points a/r(k)). Each stock clip carries
//     its expressions as `src` strings so a fork starts from the real curve,
//     not a blank. While a custom string doesn't compile, the slot keeps the
//     last good fn. The shared CLIPS table is never mutated — a fork lives
//     entirely in layer params.
//   • ClipForm's modifiers/show flags are layer params: copies (1–24 rotated
//     copies; >1 overrides a stock clip's authored mod.repeat), spiral
//     (wind-out; >0 overrides mod.spiral), fill + outline + fillOpacity.
//   • The labs keyframe timeline (draw-in + Catmull-Rom camera flight) is
//     transport choreography, not a function of u. The port replaces it with
//     loopable motion: `mode` picks how the figure animates —
//       reveal — draw-in that retracts (triangle 0→1→0; the labs draw-in,
//                looped), the construction head riding the tip
//       comet  — a sliding window traverses the curve, wrapping seamlessly
//       full   — the whole figure, camera motion only (no head — an open
//                curve's head can't wrap seamlessly)
//     and the camera is the surface loop's fixed yaw/pitch/dist orbit spinning
//     whole turns per loop.
//   • Clip style colours collapsed into the `stroke` param (themable/bindable);
//     the two registry presets restore their clips' authored colours.

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const PI = Math.PI
const PHI = 1.618033988749895

// ── Clip library (labs CLIPS, expressions frozen to JS + the Animate rose).
// epicycle: {turns, terms} · polar: {range, r(θ)} · param2d/3d: {range, x,y,z}
// points: {count, a(k), r(k)} · maurer: {n, d} · mod: {repeat, spiral}
// `src` = the frozen fns as expression strings (labs data/clips.js exprs) —
// what a CurveEditor fork starts from; the fns stay the render fast path.
export const CLIPS = [
  { id: 'circle-to-sine', label: 'Circle to sine', kind: 'epicycle', turns: 2, terms: [{ amp: 1, freq: 1 }], guides: true },
  { id: 'four-petal', label: 'Four petal', kind: 'epicycle', turns: 1, terms: [{ amp: 1, freq: 1 }, { amp: 0.5, freq: -3 }], guides: true },
  { id: 'looped-square', label: 'Looped square', kind: 'epicycle', turns: 1, terms: [{ amp: 1, freq: 1 }, { amp: 0.5, freq: -3 }, { amp: 0.3, freq: 5 }], guides: true },
  { id: 'two-rotating-axes', label: 'Two rotating axes', kind: 'epicycle', turns: 1, terms: [{ amp: 1.75, freq: -5 }, { amp: 1.25, freq: 7 }], guides: true },
  { id: 'pi-irrational', label: 'Pi irrational', kind: 'epicycle', turns: 60, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: PI }], guides: true },
  { id: 'phi-irrational', label: 'Phi irrational', kind: 'epicycle', turns: 80, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: PHI }], guides: true },
  { id: 'sqrt2-weave', label: 'Root-2 weave', kind: 'epicycle', turns: 70, terms: [{ amp: 1, freq: 1 }, { amp: 1, freq: Math.SQRT2 }], guides: true },
  { id: 'spirograph-close', label: 'Spirograph', kind: 'epicycle', turns: 40, terms: [{ amp: 1, freq: 1 }, { amp: 0.7, freq: 7.3 }], guides: true },
  { id: 'rose-24-25', label: 'Rose 24/25', kind: 'polar', range: [0, 50 * TAU], r: (th) => 4 * Math.sin(24 * th / 25) + 10, src: { r: '4*sin(24*th/25) + 10' } },
  { id: 'rose-608', label: 'Rose 6.08', kind: 'polar', range: [0, 50 * TAU], r: (th) => 3 * Math.sin(6.08 * th), src: { r: '3*sin(6.08*th)' } },
  { id: 'maurer-rose', label: 'Maurer rose', kind: 'maurer', n: 6, d: 71 },
  { id: 'archimedean', label: 'Archimedean spiral', kind: 'polar', range: [0, 10 * TAU], r: (th) => 0.5 * th, src: { r: '0.5*th' } },
  { id: 'golden-spiral', label: 'Golden spiral', kind: 'polar', range: [0, 4 * TAU], r: (th) => Math.pow(PHI, 2 * th / PI), src: { r: 'pow(PHI, 2*th/PI)' } },
  { id: 'log-spiral-e', label: 'Log spiral', kind: 'polar', range: [0, 6 * TAU], r: (th) => Math.exp(0.15 * th), src: { r: 'exp(0.15*th)' } },
  { id: 'phyllotaxis', label: 'Phyllotaxis', kind: 'points', count: 1400, a: (k) => k * TAU / (PHI * PHI), r: (k) => Math.sqrt(k), src: { a: 'k*TAU/(PHI*PHI)', r: 'sqrt(k)' } },
  { id: 'repeat-mandala', label: 'Mandala', kind: 'polar', range: [0, TAU], r: (th) => 4 + 2 * Math.cos(5 * th), mod: { repeat: 6 }, src: { r: '4 + 2*cos(5*th)' } },
  { id: 'spiral-modifier', label: 'Spiral wind-out', kind: 'polar', range: [0, 16 * TAU], r: (th) => 3 + Math.sin(5 * th), mod: { spiral: 4 }, src: { r: '3 + sin(5*th)' } },
  { id: 'helix-3d', label: 'Helix 3D', kind: 'param3d', range: [0, 6 * TAU], x: (t) => Math.cos(t), y: (t) => Math.sin(t), z: (t) => 0.3 * t, src: { x: 'cos(t)', y: 'sin(t)', z: '0.3*t' } },
  { id: 'imz-sin-pi-t', label: 'Complex spiral 3D', kind: 'param3d', range: [0, 4], x: (t) => Math.cos(PI * t), y: (t) => Math.sin(PI * t), z: (t) => t, src: { x: 'cos(PI*t)', y: 'sin(PI*t)', z: 't' } },
  { id: 'lissajous-3d', label: 'Lissajous 3D', kind: 'param3d', range: [0, TAU], x: (t) => Math.sin(3 * t), y: (t) => Math.sin(4 * t), z: (t) => Math.sin(5 * t), src: { x: 'sin(3*t)', y: 'sin(4*t)', z: 'sin(5*t)' } },
  { id: 'lissajous-2d', label: 'Lissajous 2D', kind: 'param2d', range: [0, TAU], x: (t) => Math.sin(3 * t), y: (t) => Math.sin(2 * t + 0.6), src: { x: 'sin(3*t)', y: 'sin(2*t + 0.6)' } },
  {
    id: 'butterfly', label: 'Butterfly', kind: 'param2d', range: [0, 12 * PI],
    x: (t) => Math.sin(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5)),
    y: (t) => Math.cos(t) * (Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5)),
    src: {
      x: 'sin(t)*(exp(cos(t)) - 2*cos(4*t) - pow(sin(t/12), 5))',
      y: 'cos(t)*(exp(cos(t)) - 2*cos(4*t) - pow(sin(t/12), 5))',
    },
  },
  // The Waveforms "Animate" tool's base clip (labs AnimateView, r(θ)=3·sin 6θ).
  { id: 'animate-rose', label: 'Animate rose', kind: 'polar', range: [0, 6 * TAU], r: (th) => 3 * Math.sin(6 * th), src: { r: '3*sin(6*th)' } },
]
const clipById = (id) => CLIPS.find((c) => c.id === id) || CLIPS[0]

// ── Custom clip defs (the CurveEditor inspector's document; lives in the
// layer's `custom` param — the shared CLIPS table above is never mutated).
// Expression fields are STRINGS; variables: r(th) · x/y/z(t) · a/r(k).
export const CURVE_KINDS = [
  { value: 'epicycle', label: 'Epicycle' },
  { value: 'polar', label: 'Polar' },
  { value: 'param2d', label: 'Parametric 2D' },
  { value: 'param3d', label: 'Parametric 3D' },
  { value: 'points', label: 'Points' },
  { value: 'maurer', label: 'Maurer rose' },
]

// Fresh per-kind defaults (labs CurveControls onKind semantics).
export function defaultCustomFor(kind) {
  switch (kind) {
    case 'epicycle': return { kind, turns: 2, terms: [{ amp: 1, freq: 1, phase: 0 }] }
    case 'param2d': return { kind, range: [0, TAU], x: 'sin(3*t)', y: 'sin(2*t + 0.6)' }
    case 'param3d': return { kind, range: [0, 6 * TAU], x: 'cos(t)', y: 'sin(t)', z: '0.3*t' }
    case 'points': return { kind, count: 1400, a: 'k*TAU/(PHI*PHI)', r: 'sqrt(k)' }
    case 'maurer': return { kind, n: 6, d: 71 }
    default: return { kind: 'polar', range: [0, 6 * TAU], r: '3*sin(6*th)' }
  }
}

// Fork a stock clip into an editable custom def (+ its modifier params).
// Expressions come from the clip's `src` strings; epicycle/maurer are data.
export function forkClipDef(clipId) {
  const c = clipById(clipId)
  const s = c.src || {}
  const def = { kind: c.kind }
  if (c.kind === 'epicycle') {
    def.turns = c.turns ?? 1
    def.terms = (c.terms || []).map((tm) => ({ amp: tm.amp, freq: tm.freq, phase: tm.phase ?? 0 }))
  } else if (c.kind === 'polar') {
    def.range = [...(c.range || [0, TAU])]
    def.r = s.r ?? '3*sin(6*th)'
  } else if (c.kind === 'param2d' || c.kind === 'param3d') {
    def.range = [...(c.range || [0, TAU])]
    def.x = s.x ?? 'cos(t)'
    def.y = s.y ?? 'sin(t)'
    if (c.kind === 'param3d') def.z = s.z ?? '0.3*t'
  } else if (c.kind === 'points') {
    def.count = c.count ?? 1400
    def.a = s.a ?? 'k*TAU/(PHI*PHI)'
    def.r = s.r ?? 'sqrt(k)'
  } else if (c.kind === 'maurer') {
    def.n = c.n ?? 6
    def.d = c.d ?? 71
  }
  return { def, copies: c.mod?.repeat || 1, spiral: c.mod?.spiral || 0 }
}

// Compile a custom def into a clip-shaped object (fns from expression
// slots — a broken string keeps the field's last good fn; a never-good
// field falls back to a visible default, not a blank).
function materializeCustom(def, layerId) {
  const d = def && typeof def === 'object' ? def : defaultCustomFor('polar')
  const kind = CURVE_KINDS.some((k) => k.value === d.kind) ? d.kind : 'polar'
  const slot = (field, args, fallback) =>
    compileSlot(`math-curves:${layerId ?? ''}:${field}`, d[field], args) || fallback
  const rangeOf = (fb) => {
    const r = Array.isArray(d.range) ? d.range : fb
    const a = Number(r[0])
    const b = Number(r[1])
    return [Number.isFinite(a) ? a : fb[0], Number.isFinite(b) ? b : fb[1]]
  }
  if (kind === 'epicycle') {
    const terms = (Array.isArray(d.terms) ? d.terms : [])
      .map((tm) => ({ amp: Number(tm.amp) || 0, freq: Number(tm.freq) || 0, phase: Number(tm.phase) || 0 }))
    return { kind, turns: Math.max(0.1, Number(d.turns) || 1), terms: terms.length ? terms : [{ amp: 1, freq: 1, phase: 0 }], guides: true }
  }
  if (kind === 'param2d' || kind === 'param3d') {
    return {
      kind,
      range: rangeOf([0, TAU]),
      x: slot('x', ['t'], Math.cos),
      y: slot('y', ['t'], Math.sin),
      z: kind === 'param3d' ? slot('z', ['t'], () => 0) : undefined,
    }
  }
  if (kind === 'points') {
    return {
      kind,
      count: Math.max(1, Math.min(6000, Math.round(Number(d.count) || 1400))),
      a: slot('a', ['k'], (k) => k * TAU / (PHI * PHI)),
      r: slot('r', ['k'], Math.sqrt),
    }
  }
  if (kind === 'maurer') {
    return { kind, n: Number(d.n) || 6, d: Number(d.d) || 71 }
  }
  return { kind: 'polar', range: rangeOf([0, 6 * TAU]), r: slot('r', ['th'], (th) => 3 * Math.sin(6 * th)) }
}

// ── Sampler (labs engine/sample.js; custom clips arrive pre-compiled via
// materializeCustom). Object-space points + maxExtent for the camera
// auto-fit; the spiral modifier winds radius outward.
function sampleClip(clip, spiral) {
  const pts = []
  let maxExtent = 1e-6
  const spiralG = spiral || 0
  const push = (x, y, z, t) => {
    const sp = spiralG ? 1 + spiralG * t : 1
    const X = x * sp
    const Y = y * sp
    const Z = z * sp
    pts.push({ x: X, y: Y, z: Z })
    const e = Math.max(Math.abs(X), Math.abs(Y), Math.abs(Z))
    if (e > maxExtent) maxExtent = e
  }
  if (clip.kind === 'epicycle') {
    const range = (clip.turns || 1) * TAU
    const M = 2200
    for (let i = 0; i <= M; i++) {
      const s = (range * i) / M
      let x = 0
      let y = 0
      for (const tm of clip.terms) {
        const a = tm.freq * s + (tm.phase || 0)
        x += tm.amp * Math.cos(a)
        y += tm.amp * Math.sin(a)
      }
      push(x, y, 0, i / M)
    }
  } else if (clip.kind === 'polar') {
    const [a, b] = clip.range
    const M = 2000
    for (let i = 0; i <= M; i++) {
      const th = a + ((b - a) * i) / M
      const r = clip.r(th)
      push(r * Math.cos(th), r * Math.sin(th), 0, i / M)
    }
  } else if (clip.kind === 'param2d' || clip.kind === 'param3d') {
    const [a, b] = clip.range
    const M = 2400
    for (let i = 0; i <= M; i++) {
      const t = a + ((b - a) * i) / M
      push(clip.x(t), clip.y(t), clip.z ? clip.z(t) : 0, i / M)
    }
  } else if (clip.kind === 'points') {
    for (let i = 0; i < clip.count; i++) {
      const ang = clip.a(i)
      const r = clip.r(i)
      push(r * Math.cos(ang), r * Math.sin(ang), 0, i / clip.count)
    }
  } else if (clip.kind === 'maurer') {
    for (let i = 0; i <= 360; i++) {
      const th = i * clip.d * DEG
      const r = Math.sin(clip.n * th)
      push(r * Math.cos(th), r * Math.sin(th), 0, i / 360)
    }
  }
  return { pts, maxExtent }
}

// Pure memo — a clip's geometry is a deterministic function of the clip def
// + the effective spiral. Custom clips key on the def JSON + layer (per-layer
// last-good fns can diverge under the same broken string).
const SAMPLES = new Map()
function getSample(p, clip, spiral) {
  const key = p.clip === 'custom'
    ? `custom|${p.id ?? ''}|${JSON.stringify(p.custom ?? null)}|${spiral}`
    : `${clip.id}|${spiral}`
  let s = SAMPLES.get(key)
  if (!s) {
    s = sampleClip(clip, spiral)
    SAMPLES.set(key, s)
    while (SAMPLES.size > 8) SAMPLES.delete(SAMPLES.keys().next().value)
  }
  return s
}

const MODE_OPTIONS = [
  { value: 'reveal', label: 'Reveal' },
  { value: 'comet', label: 'Comet' },
  { value: 'full', label: 'Full' },
]

// Epicycle construction (labs epicycleJoints): origin → tip of each summed
// vector at curve parameter s — the arms + joint dots riding the head.
function joints(terms, s) {
  const out = [[0, 0]]
  let x = 0
  let y = 0
  for (const tm of terms) {
    const a = tm.freq * s + (tm.phase || 0)
    x += tm.amp * Math.cos(a)
    y += tm.amp * Math.sin(a)
    out.push([x, y])
  }
  return out
}

export default {
  id: 'math-curves',
  label: 'Curves',
  group: 'math',
  kind: '2d',
  duration: 12,
  /* Param-camera contract (see surface.js — same projector, same rig). */
  cameraKeys: { yaw: 'yaw', pitch: 'pitch', dist: 'dist' },
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#050506' },
    { key: 'stroke', label: 'Stroke', type: 'color', role: 'fg', default: '#9ec1ff' },
    { key: 'clip', label: 'Shape', type: 'select', options: [...CLIPS.map(({ id, label }) => ({ value: id, label })), { value: 'custom', label: 'Custom' }], default: 'circle-to-sine' },
    { key: 'mode', label: 'Motion', type: 'select', options: MODE_OPTIONS, default: 'reveal' },
    { key: 'tail', label: 'Comet tail', type: 'range', min: 0.05, max: 0.9, step: 0.05, default: 0.35, when: (l) => l.mode === 'comet' },
    { key: 'weight', label: 'Weight', type: 'range', min: 0.5, max: 6, step: 0.1, default: 1.6 },
    { key: 'guides', label: 'Construction', type: 'toggle', default: true },
    // Modifiers (labs ClipForm) — copies/spiral default to the stock clip's
    // authored mod; a non-default value overrides it.
    { key: 'copies', label: 'Copies', type: 'range', min: 1, max: 24, step: 1, default: 1, section: 'Modifiers' },
    { key: 'spiral', label: 'Spiral', type: 'range', min: 0, max: 8, step: 0.1, default: 0, section: 'Modifiers' },
    { key: 'fill', label: 'Fill', type: 'toggle', default: false, section: 'Modifiers' },
    { key: 'outline', label: 'Outline', type: 'toggle', default: false, section: 'Modifiers', when: (l) => !!l.fill },
    { key: 'fillOpacity', label: 'Fill opacity', type: 'range', min: 0, max: 1, step: 0.05, default: 1, section: 'Modifiers', when: (l) => !!l.fill },
    // Reference axes/box (labs StylePanel AXIS_3D + axes3d.js overlay).
    { key: 'axes', label: 'Axes', type: 'select', options: AXIS_3D_OPTIONS, default: 'none', section: 'Reference' },
    { key: 'gridColor', label: 'Grid color', type: 'color', role: 'fg', default: '#ffffff', section: 'Reference', when: (l) => l.axes && l.axes !== 'none' },
    { key: 'gridOpacity', label: 'Grid opacity', type: 'range', min: 0, max: 1, step: 0.02, default: 0.1, section: 'Reference', when: (l) => l.axes && l.axes !== 'none' },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: 0, max: 3, step: 1, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'cycles', label: 'Trace cycles', type: 'range', min: 1, max: 4, step: 1, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'yaw', label: 'Yaw', type: 'range', min: 0, max: 360, step: 1, default: 340 },
    { key: 'pitch', label: 'Pitch', type: 'range', min: -80, max: 80, step: 1, default: 18 },
    { key: 'dist', label: 'Distance', type: 'range', min: 1.5, max: 6, step: 0.1, default: 3 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const clip = p.clip === 'custom' ? materializeCustom(p.custom, p.id) : clipById(p.clip)
    // Effective modifiers — the layer's copies/spiral params override a stock
    // clip's authored mod when moved off their defaults (1 / 0).
    const copies = Math.round(p.copies ?? 1)
    const spiral = (p.spiral ?? 0) > 0 ? p.spiral : (clip.mod?.spiral || 0)
    const { pts, maxExtent } = getSample(p, clip, spiral)
    const n = pts.length
    if (n < 2) return

    // Integer orbit turns per loop ⇒ frame(0) === frame(1).
    const yaw = (p.yaw + u * Math.round(p.spin) * 360) * DEG
    const eye = orbitEye(yaw, p.pitch * DEG, p.dist * maxExtent)
    const proj = projector(eye, [0, 0, 0], w, h, maxExtent)

    // Reference axes / box under the figure (planar kinds skip the z axis).
    drawAxes3D(ctx, proj, maxExtent, {
      axis: p.axes, gridColor: p.gridColor, gridOpacity: p.gridOpacity,
      space: clip.kind === 'param3d' ? '3D' : '2D',
    })

    // Repeat modifier — k rotated copies in the object x/y plane.
    const repeat = copies > 1 ? copies : Math.max(1, clip.mod?.repeat || 1)
    const project = (pt, ci) => {
      if (ci === 0) return proj(pt)
      const a = (ci / repeat) * TAU
      const c = Math.cos(a)
      const s = Math.sin(a)
      return proj({ x: pt.x * c - pt.y * s, y: pt.x * s + pt.y * c, z: pt.z })
    }

    // Trace phase — whole traversal cycles per loop keeps every mode seamless.
    const cyc = Math.max(1, Math.round(p.cycles ?? 1))
    const phase = ((u * cyc) % 1 + 1) % 1
    // reveal: triangle draw-in that retracts · comet: sliding window · full: 1
    const mode = p.mode || 'reveal'
    const isPoints = clip.kind === 'points'

    ctx.strokeStyle = p.stroke
    ctx.fillStyle = p.stroke
    ctx.lineWidth = p.weight ?? 1.6
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    // Index ranges to draw: list of [i0, i1] runs (comet may wrap → two runs).
    let runs
    let headIdx = null
    if (mode === 'comet') {
      const span = Math.max(2, Math.round((p.tail ?? 0.35) * (n - 1)))
      const end = Math.round(phase * (n - 1))
      const start = end - span
      runs = start >= 0 ? [[start, end]] : [[(n - 1) + start, n - 1], [0, end]]
      headIdx = end
    } else if (mode === 'full') {
      runs = [[0, n - 1]]
    } else {
      const dr = 1 - Math.abs(1 - 2 * phase) // 0 → 1 → 0
      const end = Math.round(dr * (n - 1))
      runs = end > 0 ? [[0, end]] : []
      headIdx = end
    }

    for (let ci = 0; ci < repeat; ci++) {
      if (isPoints) {
        const r = Math.max(1, (p.weight ?? 1.6) * 1.1)
        ctx.beginPath()
        for (const [i0, i1] of runs) {
          for (let i = i0; i <= i1; i++) {
            const [x, y] = project(pts[i], ci)
            ctx.moveTo(x + r, y)
            ctx.arc(x, y, r, 0, TAU)
          }
        }
        ctx.fill()
      } else {
        for (const [i0, i1] of runs) {
          if (i1 <= i0) continue
          ctx.beginPath()
          for (let i = i0; i <= i1; i++) {
            const [x, y] = project(pts[i], ci)
            if (i === i0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          // Fill + optional outline (labs ClipForm show.fill/outline/
          // fillOpacity; the fill colour is the clip's stroke colour).
          if (p.fill) {
            ctx.closePath()
            const a = ctx.globalAlpha
            ctx.globalAlpha = a * (p.fillOpacity ?? 1)
            ctx.fill()
            ctx.globalAlpha = a
            if (p.outline) ctx.stroke()
          } else {
            ctx.stroke()
          }
        }
      }
    }

    // Construction guides — epicycle arms + joint dots riding the head (labs
    // show.arms/dots). Head only exists in reveal/comet (see header).
    if (headIdx != null && !isPoints) {
      if (p.guides !== false && clip.kind === 'epicycle' && clip.guides) {
        const range = (clip.turns || 1) * TAU
        const js = joints(clip.terms, (headIdx / (n - 1)) * range)
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.lineWidth = Math.max(0.5, (p.weight ?? 1.6) * 0.6)
        ctx.beginPath()
        for (let i = 0; i < js.length; i++) {
          const [x, y] = proj({ x: js[i][0], y: js[i][1], z: 0 })
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        for (const [jx, jy] of js) {
          const [x, y] = proj({ x: jx, y: jy, z: 0 })
          ctx.beginPath()
          ctx.arc(x, y, Math.max(1.5, (p.weight ?? 1.6)), 0, TAU)
          ctx.fill()
        }
        ctx.restore()
      }
      // Drawing head dot.
      const [hx, hy] = project(pts[Math.min(headIdx, n - 1)], 0)
      ctx.beginPath()
      ctx.arc(hx, hy, Math.max(2, (p.weight ?? 1.6) * 1.6), 0, TAU)
      ctx.fill()
    }
  },
}
