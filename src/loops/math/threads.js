import { mulberry32 } from './rng.js'

// Threads (ported from kol-labs-single math/threads: data/threads.js +
// engine.js). TWO independent layers, fully redrawn each frame:
//   1. BALLS — a windmill of BIG white balls (spokes at u=0) that spreads across
//      the surface, each orbiting at its own graduated radius + varied speed.
//   2. FORM  — a set of base curves (loops / rings / grid / stripes / radial /
//      spiral / waves / web). Every point of the form is DRAGGED toward any ball
//      within `infR`, so the moving balls haul the form around.
//
// PURE IN u — the source engine accumulated nothing (closed-form in t), so the
// port replaces t with u·duration and SNAPS every angular frequency to an
// integer number of cycles per loop at model-build time (orbit speed, radius
// wobble, form precession). frame(0) === frame(1) exactly ⇒ seamless + scrubbable.
// The snap quantises the source's continuous random speeds; character survives
// because duration (20s) gives 2–6 cycle granularity.

const TAU = Math.PI * 2
const DURATION = 20 // seconds per loop — also the cycle-snap denominator

export const FORM_OPTIONS = [
  { value: 'loops', label: 'Loops' },
  { value: 'rings', label: 'Rings' },
  { value: 'grid', label: 'Grid' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'radial', label: 'Radial' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'waves', label: 'Waves' },
  { value: 'web', label: 'Web' },
]

// ── Balls: windmill spokes at u=0, each orbiting at its own radius + varied speed.
function makeBalls(rng, wings, perWing) {
  const balls = []
  for (let wi = 0; wi < wings; wi++) {
    const spoke = (wi / wings) * TAU + (rng() - 0.5) * 0.1
    for (let k = 0; k < perWing; k++) {
      const startR = 0.12 + ((k + 0.5) / perWing) * 0.5
      const dir = rng() < 0.5 ? 1 : -1
      const w = (0.5 + rng() * 1.05) * dir
      const wob = 1.4 + rng() * 2.2
      const wobAmp = 0.12 + rng() * 0.13
      const sizeF = 0.6 + (perWing === 1 ? 0.4 : (k / (perWing - 1)) * 0.7) + (rng() - 0.5) * 0.2
      balls.push({ startR, spoke, w, wob, wobAmp, size: Math.max(0.35, sizeF) })
    }
  }
  return balls
}

// ── Form library: each returns base curves {hue, pts:[[x,y]…]} in normalized
// coords (centre 0, edge ≈ ±0.9). Closed shapes repeat the first point.
function buildForm(form, count, rng) {
  const N = Math.max(1, Math.round(count))
  const paths = []
  const hue = (i, n) => (i / Math.max(1, n)) * 360
  const closed = (fn, s = 180) => { const p = []; for (let i = 0; i <= s; i++) p.push(fn(i / s)); return p }
  const open = (fn, s = 90) => { const p = []; for (let i = 0; i <= s; i++) p.push(fn(i / s)); return p }
  const axis = (i, n) => (n === 1 ? 0 : i / (n - 1)) * 1.7 - 0.85

  if (form === 'rings') {
    for (let i = 0; i < N; i++) { const r = 0.2 + ((i + 1) / N) * 0.68; paths.push({ hue: hue(i, N), pts: closed((s) => { const a = s * TAU; return [Math.cos(a) * r, Math.sin(a) * r] }) }) }
  } else if (form === 'grid') {
    for (let i = 0; i < N; i++) {
      const v = axis(i, N)
      paths.push({ hue: hue(i, 2 * N), pts: open((s) => [s * 1.7 - 0.85, v]) })
      paths.push({ hue: hue(i + N, 2 * N), pts: open((s) => [v, s * 1.7 - 0.85]) })
    }
  } else if (form === 'stripes') {
    for (let i = 0; i < N; i++) { const v = axis(i, N); paths.push({ hue: hue(i, N), pts: open((s) => [s * 1.7 - 0.85, v]) }) }
  } else if (form === 'radial') {
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; paths.push({ hue: hue(i, N), pts: open((s) => [Math.cos(a) * (0.04 + s * 0.88), Math.sin(a) * (0.04 + s * 0.88)]) }) }
  } else if (form === 'spiral') {
    const arms = Math.max(1, Math.min(N, 5))
    for (let j = 0; j < arms; j++) { const off = (j / arms) * TAU; paths.push({ hue: hue(j, arms), pts: open((s) => { const a = off + s * TAU * 2.6; const r = s * 0.9; return [Math.cos(a) * r, Math.sin(a) * r] }, 220) }) }
  } else if (form === 'waves') {
    for (let i = 0; i < N; i++) { const y0 = axis(i, N); const freq = 2 + (i % 3); const ph = rng() * TAU; paths.push({ hue: hue(i, N), pts: open((s) => { const x = s * 1.8 - 0.9; return [x, y0 + 0.12 * Math.sin(freq * Math.PI * x + ph)] }) }) }
  } else if (form === 'web') {
    const rings = Math.max(2, Math.round(N / 2))
    for (let i = 0; i < rings; i++) { const r = 0.2 + ((i + 1) / rings) * 0.68; paths.push({ hue: hue(i, N + rings), pts: closed((s) => { const a = s * TAU; return [Math.cos(a) * r, Math.sin(a) * r] }) }) }
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; paths.push({ hue: hue(i + rings, N + rings), pts: open((s) => [Math.cos(a) * (0.04 + s * 0.88), Math.sin(a) * (0.04 + s * 0.88)]) }) }
  } else { // loops (default)
    for (let i = 0; i < N; i++) {
      const a = 0.82 + rng() * 0.12
      const b = 0.52 + rng() * 0.26
      const phi = (i / N) * Math.PI + (rng() - 0.5) * 0.4
      const wA = 0.04 + rng() * 0.06
      const wF = 2 + Math.floor(rng() * 2)
      const wP = rng() * TAU
      const cph = Math.cos(phi)
      const sph = Math.sin(phi)
      paths.push({ hue: hue(i, N), pts: closed((s) => { const th = s * TAU; const w = 1 + wA * Math.sin(wF * th + wP); const lx = w * a * Math.cos(th); const ly = w * b * Math.sin(th); return [lx * cph - ly * sph, lx * sph + ly * cph] }) })
    }
  }
  return paths
}

// Build the model and snap every angular rate to integer cycles per loop.
// Source rates (rad/s) × duration / TAU → rounded cycle counts.
function makeThreads(p) {
  const rng = mulberry32((p.seed ?? 1) >>> 0)
  const wings = Math.max(2, Math.round(p.wings ?? 3))
  const perWing = Math.max(1, Math.round(p.perWing ?? 4))
  const balls = makeBalls(rng, wings, perWing)
  const paths = buildForm(p.form || 'loops', p.lines ?? 6, rng)
  const ballSpeed = p.ballSpeed ?? 1
  const K = DURATION / TAU
  for (const b of balls) {
    const c = Math.round(b.w * ballSpeed * K)
    b.cycles = c === 0 ? (b.w < 0 ? -1 : 1) : c // never freeze an orbit
    b.wobCycles = Math.max(1, Math.round(b.wob * ballSpeed * K))
  }
  const rotTurns = Math.round((p.lineSpeed ?? 0.22) * K) // form precession, whole turns
  return { balls, paths, rotTurns }
}

// Ball position at u, NORMALIZED. On its spoke at radius startR when u=0.
function ballPosU(b, u) {
  const R = b.startR * (1 + b.wobAmp * Math.sin(b.wobCycles * TAU * u))
  const ang = b.spoke + b.cycles * TAU * u
  return [R * Math.cos(ang), R * Math.sin(ang)]
}

// Rotate a base curve by `rot` and DRAG every point toward nearby balls.
// Kernel 4·u·(1−u) is a smooth bump (0 at the ball centre AND edge, peak mid) ⇒
// the form wraps the balls without collapsing onto them or spiking.
function applyDrag(basePts, rot, ballsN, r = {}) {
  const infR = r.infR ?? 0.28
  const pull = r.pull ?? 0.18
  const maxPull = r.maxPull ?? 0.4
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const out = []
  for (let i = 0; i < basePts.length; i++) {
    let x = basePts[i][0] * c - basePts[i][1] * s
    let y = basePts[i][0] * s + basePts[i][1] * c
    if (pull > 0) {
      let ox = 0
      let oy = 0
      for (let k = 0; k < ballsN.length; k++) {
        const vx = ballsN[k][0] - x
        const vy = ballsN[k][1] - y
        const d = Math.hypot(vx, vy)
        if (d < infR && d > 1e-4) {
          const uu = d / infR
          const f = pull * 4 * uu * (1 - uu)
          ox += (vx / d) * f
          oy += (vy / d) * f
        }
      }
      const om = Math.hypot(ox, oy)
      if (om > maxPull) { ox = (ox / om) * maxPull; oy = (oy / om) * maxPull }
      x += ox
      y += oy
    }
    out.push([x, y])
  }
  return out
}

// Pure memo — the model is a deterministic function of these params, cached so
// scrubbing stays cheap. Does not break purity.
const MODELS = new Map()
function getModel(p) {
  const sig = [p.form, p.wings, p.perWing, p.lines, p.seed, p.ballSpeed, p.lineSpeed].join('|')
  let m = MODELS.get(sig)
  if (!m) {
    m = makeThreads(p)
    MODELS.set(sig, m)
    while (MODELS.size > 8) MODELS.delete(MODELS.keys().next().value)
  }
  return m
}

export default {
  id: 'math-threads',
  label: 'Threads',
  group: 'math',
  kind: '2d',
  duration: DURATION,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#050507' },
    { key: 'thread', label: 'Thread', type: 'color', role: 'fg', default: '#ffffff', when: (l) => !!l.mono },
    { key: 'mono', label: 'Mono', type: 'toggle', default: false },
    { key: 'heads', label: 'Heads', type: 'toggle', default: true },
    { key: 'form', label: 'Form', type: 'select', options: FORM_OPTIONS, default: 'loops' },
    { key: 'wings', label: 'Wings', type: 'range', min: 2, max: 6, step: 1, default: 3 },
    { key: 'perWing', label: 'Per wing', type: 'range', min: 1, max: 5, step: 1, default: 3 },
    { key: 'lines', label: 'Lines', type: 'range', min: 1, max: 24, step: 1, default: 6 },
    { key: 'reach', label: 'Reach', type: 'range', min: 0.2, max: 1, step: 0.02, default: 0.45 },
    { key: 'ballSpeed', label: 'Ball speed', type: 'range', min: 0.25, max: 3, step: 0.05, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'lineSpeed', label: 'Line speed', type: 'range', min: 0, max: 1, step: 0.01, default: 0.22, tab: 'anim', section: 'Motion' },
    { key: 'pull', label: 'Pull', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0.18 },
    { key: 'infR', label: 'Influence', type: 'range', min: 0.1, max: 0.6, step: 0.01, default: 0.28 },
    { key: 'weight', label: 'Weight', type: 'range', min: 0.5, max: 6, step: 0.1, default: 2.4 },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 24, step: 1, default: 10 },
    { key: 'ballR', label: 'Ball size', type: 'range', min: 4, max: 80, step: 1, default: 40, when: (l) => l.heads !== false },
    { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 99, step: 1, default: 1, noRandom: true },
  ],
  draw(ctx, u, w, h, p) {
    const model = getModel(p)
    const cx = w / 2
    const cy = h / 2
    const S = Math.min(w, h) * 0.5 * (p.reach ?? 0.45)

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = p.bg || '#050507'
    ctx.fillRect(0, 0, w, h)

    const mono = !!p.mono
    const thread = p.thread || '#ffffff'
    const glow = p.glow ?? 9

    // Ball positions FIRST — the form is dragged by them.
    const ballsN = model.balls.map((b) => ballPosU(b, u))
    const drag = { infR: p.infR ?? 0.28, pull: p.pull ?? 0.18 }
    const rot = model.rotTurns * TAU * u

    // ── Form (behind) — every base curve dragged by the balls, quad-smoothed.
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = p.weight ?? 2.2
    for (const path of model.paths) {
      const pts = applyDrag(path.pts, rot, ballsN, drag)
      const col = mono ? thread : `hsl(${path.hue}, 90%, 62%)`
      ctx.strokeStyle = col
      if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = col }
      ctx.beginPath()
      ctx.moveTo(cx + pts[0][0] * S, cy + pts[0][1] * S)
      for (let i = 1; i < pts.length - 1; i++) {
        const x = cx + pts[i][0] * S
        const y = cy + pts[i][1] * S
        const nx = cx + pts[i + 1][0] * S
        const ny = cy + pts[i + 1][1] * S
        ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0

    // ── Balls (front) — big glowing white, the windmill.
    if (p.heads !== false) {
      const base = p.ballR ?? 40
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(255,255,255,0.85)'
      for (let k = 0; k < ballsN.length; k++) {
        const r = base * model.balls[k].size
        ctx.shadowBlur = r * 1.2
        ctx.beginPath()
        ctx.arc(cx + ballsN[k][0] * S, cy + ballsN[k][1] * S, r, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  },
}
