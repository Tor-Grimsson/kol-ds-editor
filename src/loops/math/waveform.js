// Waveforms (ported from kol-labs-single math/waveforms/WaveformsEditor.jsx +
// math/fourier/FourierScope.jsx). Fourier epicycle synthesis: a chain of
// rotating circles — each a Fourier term projected from f(t) — synthesises a
// periodic wave whose value scrolls right as the trace.
//
// PURE IN u. What changed vs labs:
//   • The wave f(t) is a select over the labs FUNC_EXAMPLES frozen to plain
//     JS PLUS 'Custom…' — a free-text f(t) compiled by ./mathfn.js (hardened
//     compileVars) and fed through the same DFT (termsFromFn samples one
//     period 0..2π, so any f(t) drops in). While a custom string doesn't
//     compile the slot keeps the last good fn. Harmonics/rolloff still shape
//     the DFT.
//   • The labs trace was ACCUMULATED (one tip sample unshifted per rAF frame).
//     Here it is closed-form: the sample at column i is the tip Y re-evaluated
//     at the past phase u − i/(60·duration) — identical geometry at 60fps, but
//     scrubbable. Seamless because every phase term below is periodic in u.
//   • Rates snapped to integer cycles per loop (the threads-port idiom):
//     rotation = round(speed·duration) wave cycles; the Form oscillators
//     (pulse/swing/stagger/fade) run whole cycles; Frame flow pans whole frame
//     sizes per loop (integer flow × PAN_VEC ⇒ toroidal wrap lands exactly).

import { compileSlot } from './mathfn.js'
import { drawAxes2D, AXIS_2D_OPTIONS } from './axes.js'

const TAU = Math.PI * 2
const DURATION = 10 // seconds per loop — also the cycle-snap denominator
const PX_RATE = 60 // trace samples (columns) per second — labs sampled per rAF frame

// ── Frozen wave functions (labs FUNC_EXAMPLES).
export const WAVE_OPTIONS = [
  { value: 'square', label: 'Square', fn: (t) => Math.sign(Math.sin(t)) },
  { value: 'sawtooth', label: 'Sawtooth', fn: (t) => ((t / Math.PI) % 2 + 2) % 2 - 1 },
  { value: 'triangle', label: 'Triangle', fn: (t) => (2 / Math.PI) * Math.asin(Math.sin(t)) },
  { value: 'sine', label: 'Sine', fn: (t) => Math.sin(t) },
  { value: 'organ', label: 'Organ', fn: (t) => Math.sin(t) + 0.5 * Math.sin(3 * t) + 0.25 * Math.sin(5 * t) },
  { value: 'softsq', label: 'Soft square', fn: (t) => Math.tanh(3 * Math.sin(t)) },
]

// Labs FUNC_EXAMPLES expression strings, verbatim — quick-fill list for the
// custom f(t) (the text param carries one as its placeholder). f is sampled
// over one period t = 0..2π.
export const WAVE_EXPR_EXAMPLES = [
  'sign(sin(t))',
  'mod(t/PI, 2) - 1',
  '2/PI*asin(sin(t))',
  'sin(t) + 0.5*sin(3*t) + 0.25*sin(5*t)',
  'tanh(3*sin(t))',
]

// Numerical Fourier synthesis (verbatim from labs termsFromFn): sample f(t)
// over one period and project onto the first N harmonics → epicycle terms
// {k, amp, phase}; amp folds in both cos/sin parts so the y-projection of the
// rotating-vector sum is f(t).
function termsFromFn(fn, n, rolloff = 0, samples = 512) {
  const N = Math.max(1, Math.round(n))
  if (!fn) return [{ k: 1, amp: 1, phase: 0 }]
  const a = new Array(N + 1).fill(0)
  const b = new Array(N + 1).fill(0)
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * TAU
    const v = fn(t)
    if (!Number.isFinite(v)) continue
    for (let k = 1; k <= N; k++) { a[k] += v * Math.cos(k * t); b[k] += v * Math.sin(k * t) }
  }
  const terms = []
  for (let k = 1; k <= N; k++) {
    let amp = Math.hypot(a[k], b[k]) * (2 / samples)
    if (rolloff) amp *= Math.pow(k, -rolloff)
    if (amp > 1e-3) terms.push({ k, amp, phase: Math.atan2(a[k], b[k]) })
  }
  return terms.length ? terms : [{ k: 1, amp: 1, phase: 0 }]
}

// Pure memo — terms are a deterministic function of (wave, harmonics,
// rolloff) plus, for a custom wave, the expression text + layer (last-good
// fns diverge per layer, so the cache must too).
const TERMS = new Map()
function getTerms(p) {
  const custom = p.wave === 'custom'
  const key = `${custom ? `custom:${p.id ?? ''}:${p.expr ?? ''}` : p.wave}|${p.harmonics}|${p.rolloff}`
  let t = TERMS.get(key)
  if (!t) {
    const fn = custom
      ? (compileSlot(`math-waveform:${p.id ?? ''}:expr`, p.expr, ['t']) || WAVE_OPTIONS[3].fn)
      : (WAVE_OPTIONS.find((w) => w.value === p.wave) || WAVE_OPTIONS[0]).fn
    t = termsFromFn(fn, p.harmonics, p.rolloff)
    TERMS.set(key, t)
    while (TERMS.size > 12) TERMS.delete(TERMS.keys().next().value)
  }
  return t
}

const PAN_VEC = {
  right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
  diag: [1, 1], anti: [-1, 1],
}
const DIR_OPTIONS = [
  { value: 'right', label: 'Right' }, { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' },
  { value: 'diag', label: 'Diagonal' }, { value: 'anti', label: 'Anti-diagonal' },
]

const toRGB = (h) => { const s = (h || '#ffffff').replace('#', ''); return `${parseInt(s.slice(0, 2), 16)},${parseInt(s.slice(2, 4), 16)},${parseInt(s.slice(4, 6), 16)}` }

// Form oscillator cycle counts — labs ran these at fixed rad/s on the free
// clock (pulse 0.35·TAU, swing 0.4·TAU, stagger 0.5·TAU, fade 0.5·TAU per s);
// snapped to whole cycles per loop so frame(0) === frame(1).
const PULSE_CYC = Math.round(0.35 * DURATION)
const SWING_CYC = Math.round(0.4 * DURATION)
const STAG_CYC = Math.round(0.5 * DURATION)
const FADE_CYC = Math.round(0.5 * DURATION)

// Module-level figure buffer (transient scratch — reused, never accumulates).
let fig = null

export default {
  id: 'math-waveform',
  label: 'Waveform',
  group: 'math',
  kind: '2d',
  duration: DURATION,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0c0a06' },
    { key: 'fg', label: 'Foreground', type: 'color', role: 'fg', default: '#ffb35c' },
    { key: 'wave', label: 'Wave', type: 'select', options: [...WAVE_OPTIONS.map(({ value, label }) => ({ value, label })), { value: 'custom', label: 'Custom…' }], default: 'square' },
    { key: 'expr', label: 'f(t) =', type: 'text', rows: 2, default: WAVE_EXPR_EXAMPLES[3], placeholder: WAVE_EXPR_EXAMPLES[4], when: (l) => l.wave === 'custom' },
    { key: 'harmonics', label: 'Harmonics', type: 'range', min: 1, max: 24, step: 1, default: 8 },
    { key: 'rolloff', label: 'Rolloff', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0 },
    { key: 'phase', label: 'Phase', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    // Trace — three elements, each with its own weight + opacity (0 hides).
    { key: 'circlesWeight', label: 'Circles weight', type: 'range', min: 0.25, max: 12, step: 0.05, default: 1 },
    { key: 'circlesOpacity', label: 'Circles opacity', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'loopWeight', label: 'Loop weight', type: 'range', min: 0.25, max: 12, step: 0.05, default: 1 },
    { key: 'loopOpacity', label: 'Loop opacity', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'graphWeight', label: 'Graph weight', type: 'range', min: 0.5, max: 12, step: 0.05, default: 1.25 },
    { key: 'graphOpacity', label: 'Graph opacity', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
    { key: 'graphLength', label: 'Graph length', type: 'range', min: 0.05, max: 1, step: 0.05, default: 1 },
    { key: 'graphDot', label: 'Dot size', type: 'range', min: 0, max: 4, step: 0.1, default: 1 },
    // Transform (static placement)
    { key: 'posX', label: 'Position X', type: 'range', min: -1, max: 1, step: 0.02, default: 0 },
    { key: 'posY', label: 'Position Y', type: 'range', min: -1, max: 1, step: 0.02, default: 0 },
    { key: 'baseScale', label: 'Scale', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1 },
    // Frame (whole-figure sweep; flow pans whole frames ⇒ seamless)
    { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 3, step: 1, default: 0, tab: 'anim', section: 'Frame' },
    { key: 'panDir', label: 'Direction', type: 'select', options: DIR_OPTIONS, default: 'right', tab: 'anim', section: 'Frame' },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1, tab: 'anim', section: 'Frame' },
    { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0, tab: 'anim', section: 'Frame' },
    // Form (in-place wave modulation; speed snaps to whole wave cycles)
    { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 2, step: 0.05, default: 0.3, tab: 'anim', section: 'Form' },
    { key: 'stagger', label: 'Stagger', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form' },
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form' },
    { key: 'fade', label: 'Fade', type: 'range', min: 0, max: 1, step: 0.05, default: 0, tab: 'anim', section: 'Form' },
    { key: 'swing', label: 'Swing', type: 'range', min: 0, max: 90, step: 1, default: 0, tab: 'anim', section: 'Form' },
    // Reference axes/grid (labs StylePanel AXIS_2D; new on this loop — labs
    // waveforms had no axis system, spec'd in with a fixed 8-unit reference
    // frame). Static screen-space: the Frame pan/zoom moves the figure over
    // the grid, not the grid.
    { key: 'axes', label: 'Axes', type: 'select', options: AXIS_2D_OPTIONS, default: 'none', section: 'Reference' },
    { key: 'gridColor', label: 'Grid color', type: 'color', role: 'fg', default: '#ffffff', section: 'Reference', when: (l) => l.axes && l.axes !== 'none' },
    { key: 'gridOpacity', label: 'Grid opacity', type: 'range', min: 0, max: 1, step: 0.02, default: 0.12, section: 'Reference', when: (l) => l.axes && l.axes !== 'none' },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)
    drawAxes2D(ctx, w, h, { axis: p.axes, gridColor: p.gridColor, gridOpacity: p.gridOpacity }, { cx: 0, cy: 0, range: 8 })

    const terms = getTerms(p)
    const fg = p.fg || '#e5dfcf'
    const cOp = p.circlesOpacity ?? 0.6
    const lOp = p.loopOpacity ?? 0.6
    const gOp = p.graphOpacity ?? 1
    const cShow = cOp > 0.004
    const lShow = lOp > 0.004
    const gShow = gOp > 0.004

    // Wave rotation: whole cycles per loop (never 0 while speed > 0).
    const cyc = p.speed > 0 ? Math.max(1, Math.round(p.speed * DURATION)) : 0

    let maxAmp = 0
    for (const t of terms) { const a = Math.abs(t.amp); if (a > maxAmp) maxAmp = a }
    const maxR = Math.min(h * 0.4, w * 0.4) * Math.max(0.1, p.baseScale)
    const phaseRad = (p.phase * Math.PI) / 180

    // Tip position (x for the head dot; y is the synthesized value) at loop
    // phase uu, with every Form modulation evaluated AT that time — the trace
    // then replays history exactly as it was drawn (labs recorded samples).
    const tip = (uu, originX, cy, wantX) => {
      const pulseScale = 1 - p.pulse * 0.5 * (1 - Math.cos(uu * TAU * PULSE_CYC))
      const baseR = (maxR / (maxAmp || 1)) * pulseScale
      const swingRad = ((p.swing * Math.PI) / 180) * Math.sin(uu * TAU * SWING_CYC)
      const staggerOsc = p.stagger * Math.sin(uu * TAU * STAG_CYC)
      const tt = uu * TAU * cyc
      let x = originX
      let y = cy
      for (const term of terms) {
        const r = Math.abs(term.amp) * baseR
        const ang = term.k * tt + term.phase + (term.amp < 0 ? Math.PI : 0)
          + phaseRad + swingRad + staggerOsc * term.k * 0.25
        if (wantX) x += r * Math.cos(ang)
        y += r * Math.sin(ang)
      }
      return [x, y]
    }

    // ── Figure (chain + trace) on a transparent scratch buffer; the main pass
    // composites it under the framing transform + toroidal pan.
    if (!fig) fig = document.createElement('canvas')
    const fw = Math.max(1, Math.ceil(w))
    const fh = Math.max(1, Math.ceil(h))
    if (fig.width !== fw || fig.height !== fh) { fig.width = fw; fig.height = fh }
    const f = fig.getContext('2d')
    f.setTransform(1, 0, 0, 1, 0, 0)
    f.clearRect(0, 0, fw, fh)

    const originX = (gShow ? maxR + 4 : w / 2) + p.posX * w * 0.45
    const cy = h / 2 + p.posY * h * 0.45

    // epicycle chain (at the current phase u)
    {
      const pulseScale = 1 - p.pulse * 0.5 * (1 - Math.cos(u * TAU * PULSE_CYC))
      const baseR = (maxR / (maxAmp || 1)) * pulseScale
      const swingRad = ((p.swing * Math.PI) / 180) * Math.sin(u * TAU * SWING_CYC)
      const staggerOsc = p.stagger * Math.sin(u * TAU * STAG_CYC)
      const tt = u * TAU * cyc
      let x = originX
      let y = cy
      const cStroke = `rgba(${toRGB(fg)},${cOp})`
      const lStroke = `rgba(${toRGB(fg)},${lOp})`
      const cW = Math.max(0.25, p.circlesWeight ?? 1)
      const lW = Math.max(0.25, p.loopWeight ?? 1)
      for (const term of terms) {
        const px = x
        const py = y
        const r = Math.abs(term.amp) * baseR
        const ang = term.k * tt + term.phase + (term.amp < 0 ? Math.PI : 0)
          + phaseRad + swingRad + staggerOsc * term.k * 0.25
        x += r * Math.cos(ang)
        y += r * Math.sin(ang)
        if (cShow) { f.strokeStyle = cStroke; f.lineWidth = cW; f.beginPath(); f.arc(px, py, r, 0, TAU); f.stroke() }
        if (lShow) { f.strokeStyle = lStroke; f.lineWidth = lW; f.beginPath(); f.moveTo(px, py); f.lineTo(x, y); f.stroke() }
      }

      // trace — closed-form history: column i = the tip Y of PX_RATE·duration
      // samples ago, periodic in u ⇒ the loop closes exactly.
      const traceAlpha = 1 - p.fade * 0.6 * (1 - Math.cos(u * TAU * FADE_CYC)) * 0.5
      if (gShow) {
        const waveX0 = originX + 8
        const maxLen = Math.max(1, Math.floor((w - waveX0 - 8) * Math.max(0.02, p.graphLength ?? 1)))
        f.save()
        f.globalAlpha = Math.max(0.02, gOp * traceAlpha)
        f.strokeStyle = fg
        f.lineWidth = p.graphWeight ?? 1.25
        f.beginPath()
        let first = 0
        for (let i = 0; i < maxLen; i++) {
          const [, Y] = tip(u - i / (PX_RATE * DURATION), 0, cy, false)
          if (i === 0) { f.moveTo(waveX0, Y); first = Y }
          else f.lineTo(waveX0 + i, Y)
        }
        f.stroke()
        f.restore()
        if (lShow) {
          f.strokeStyle = `rgba(${toRGB(fg)},${lOp})`
          f.lineWidth = Math.max(0.25, p.loopWeight ?? 1)
          f.beginPath()
          f.moveTo(x, y)
          f.lineTo(waveX0, first)
          f.stroke()
        }
        f.save()
        f.globalAlpha = Math.max(0.02, gOp)
        f.fillStyle = fg
        f.beginPath()
        f.arc(x, y, ((p.graphWeight ?? 1.25) + 0.75) * Math.max(0.1, p.graphDot ?? 1), 0, TAU)
        f.fill()
        f.restore()
      }
    }

    // ── Composite: framing transform + toroidal pan (whole frames per loop).
    ctx.save()
    if (p.zoom !== 1 || p.angle) {
      ctx.translate(w / 2, h / 2)
      ctx.rotate((p.angle * Math.PI) / 180)
      ctx.scale(p.zoom || 1, p.zoom || 1)
      ctx.translate(-w / 2, -h / 2)
    }
    const flow = Math.round(p.flow || 0)
    if (flow > 0) {
      const [dx, dy] = PAN_VEC[p.panDir] || PAN_VEC.right
      const ox = ((u * flow * dx * w) % w + w) % w
      const oy = ((u * flow * dy * h) % h + h) % h
      const margin = (p.zoom && p.zoom < 1) ? Math.ceil(1 / p.zoom) : 0
      for (let gx = ox - w * (1 + margin); gx < w * (1 + margin); gx += w)
        for (let gy = oy - h * (1 + margin); gy < h * (1 + margin); gy += h)
          ctx.drawImage(fig, gx, gy, w, h)
    } else {
      ctx.drawImage(fig, 0, 0, w, h)
    }
    ctx.restore()
  },
}
