// Surfaces (ported from kol-labs-single math/surfaces/render.js — surfaceRender
// + attractorRender — plus the hand-rolled lookAt/perspective projector from
// math/uzumaki/engine/camera.js and orbitEye from lib/orbit.js). Genuinely
// canvas2d: the labs "Viewport3D" is NOT three.js, just this projector.
//
// PURE IN u. What changed vs labs:
//   • mathjs expression evaluation did NOT come along — the surface z=f(x,y) is
//     a select over the three SURFACE_PRESETS expressions, frozen to plain JS.
//   • resolveRate (expression-rate params) dropped — domain/height/weight are
//     plain numbers.
//   • Camera: a fixed yaw/pitch/dist orbit that spins `spin` whole turns per
//     loop; morph/ripple/fade wobbles snapped to integer cycles of u ⇒ seamless.
//   • Attractors: the full precomputed trajectory is drawn (the labs draw-in
//     "playing" head is transport state, not a function of u). Trajectories are
//     memoized by (attractor, steps) — pure caching, scrub-safe.

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const NB = 18

// ── Frozen surface functions (from labs SURFACE_PRESETS exprs, mathjs dropped).
export const FN_OPTIONS = [
  { value: 'ripple', label: 'Ripple', fn: (x, y) => Math.sin(x * 1.6) * Math.cos(y * 1.6) },
  { value: 'saddle', label: 'Saddle', fn: (x, y) => (x * x - y * y) * 0.25 },
  { value: 'bell', label: 'Bell', fn: (x, y) => Math.cos(x) * Math.cos(y) * Math.exp(-(x * x + y * y) * 0.08) },
]

// ── Strange attractors (ported verbatim from math/attractor/data/attractors.js).
export const ATTRACTORS = [
  {
    id: 'lorenz', label: 'Lorenz',
    init: [0.01, 0, 0], dt: 0.006,
    deriv: ([x, y, z]) => { const s = 10, r = 28, b = 8 / 3; return [s * (y - x), x * (r - z) - y, x * y - b * z] },
  },
  {
    id: 'rossler', label: 'Rössler',
    init: [0.1, 0, 0], dt: 0.02,
    deriv: ([x, y, z]) => { const a = 0.2, b = 0.2, c = 5.7; return [-y - z, x + a * y, b + z * (x - c)] },
  },
  {
    id: 'aizawa', label: 'Aizawa',
    init: [0.1, 0, 0], dt: 0.01,
    deriv: ([x, y, z]) => {
      const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1
      return [(z - b) * x - d * y, d * x + (z - b) * y, c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x]
    },
  },
  {
    id: 'thomas', label: 'Thomas',
    init: [0.1, 0, 0], dt: 0.04,
    deriv: ([x, y, z]) => { const b = 0.208186; return [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z] },
  },
  {
    id: 'halvorsen', label: 'Halvorsen',
    init: [-1.48, -1.51, 2.04], dt: 0.008,
    deriv: ([x, y, z]) => {
      const a = 1.89
      return [-a * x - 4 * y - 4 * z - y * y, -a * y - 4 * z - 4 * x - z * z, -a * z - 4 * x - 4 * y - x * x]
    },
  },
]

const rk4 = (f, p, dt) => {
  const k1 = f(p)
  const k2 = f([p[0] + k1[0] * dt / 2, p[1] + k1[1] * dt / 2, p[2] + k1[2] * dt / 2])
  const k3 = f([p[0] + k2[0] * dt / 2, p[1] + k2[1] * dt / 2, p[2] + k2[2] * dt / 2])
  const k4 = f([p[0] + k3[0] * dt, p[1] + k3[1] * dt, p[2] + k3[2] * dt])
  return [
    p[0] + (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt / 6,
    p[1] + (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt / 6,
    p[2] + (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * dt / 6,
  ]
}

// RK4-integrate into centered points + maxExtent (for the camera auto-fit).
function integrate(att, steps, dt = att.dt, warm = 600) {
  const f = att.deriv
  let p = att.init.slice()
  for (let i = 0; i < warm; i++) p = rk4(f, p, dt) // discard the transient
  const pts = []
  for (let i = 0; i < steps; i++) { p = rk4(f, p, dt); pts.push({ x: p[0], y: p[1], z: p[2] }) }

  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity
  for (const q of pts) {
    if (q.x < minx) minx = q.x; if (q.y < miny) miny = q.y; if (q.z < minz) minz = q.z
    if (q.x > maxx) maxx = q.x; if (q.y > maxy) maxy = q.y; if (q.z > maxz) maxz = q.z
  }
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2
  let ext = 1e-6
  for (const q of pts) {
    q.x -= cx; q.y -= cy; q.z -= cz
    const e = Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z))
    if (e > ext) ext = e
  }
  return { pts, ext }
}

// Pure memo — a trajectory is a deterministic function of (attractor, steps).
const TRAJS = new Map()
function trajectory(p) {
  const att = ATTRACTORS.find((a) => a.id === p.attractor) || ATTRACTORS[0]
  const steps = Math.max(500, Math.round(p.steps ?? 6000))
  const key = `${att.id}|${steps}`
  let t = TRAJS.get(key)
  if (!t) {
    t = integrate(att, steps)
    TRAJS.set(key, t)
    while (TRAJS.size > 6) TRAJS.delete(TRAJS.keys().next().value)
  }
  return t
}

// ── Camera (from uzumaki/engine/camera.js + lib/orbit.js, verbatim math).
const v = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  },
}

export function orbitEye(yaw, pitch, dist, target = [0, 0, 0]) {
  const cp = Math.cos(pitch)
  return [
    target[0] + dist * cp * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * cp * Math.cos(yaw),
  ]
}

// Build a world-point → [screenX, screenY] projector for a camera state.
// Real lookAt basis + perspective divide; auto-fits the figure's extent.
// (Exported — curves.js drives the same projector; keep ONE copy.)
export function projector(eye, target, W, H, ext) {
  const up = [0, 1, 0]
  const forward = v.norm(v.sub(target, eye))
  let right = v.cross(forward, up)
  if (v.len(right) < 1e-6) right = [1, 0, 0]
  right = v.norm(right)
  const camUp = v.cross(right, forward)
  const dist = v.len(v.sub(target, eye)) || 1
  const f = 2.0 // focal — ~53° fov, enough perspective to read depth
  // auto-fit: a point at radius `ext` near the focus fills ~0.4 of the frame
  const k = (0.4 * Math.min(W, H) * dist) / (Math.max(1e-6, ext) * f)
  const cx = W / 2
  const cy = H / 2
  const minZ = dist * 0.05
  return (p) => {
    const rx = p.x - eye[0]
    const ry = p.y - eye[1]
    const rz = p.z - eye[2]
    const x = rx * right[0] + ry * right[1] + rz * right[2]
    const y = rx * camUp[0] + ry * camUp[1] + rz * camUp[2]
    let z = rx * forward[0] + ry * forward[1] + rz * forward[2]
    if (z < minZ) z = minZ
    const s = (f * k) / z
    return [cx + x * s, cy - y * s]
  }
}

// ── Colour helpers (from surfaces/render.js).
const toRGB = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }
const lerpHex = (a, b, u) => {
  const A = toRGB(a)
  const B = toRGB(b)
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * u)},${Math.round(A[1] + (B[1] - A[1]) * u)},${Math.round(A[2] + (B[2] - A[2]) * u)})`
}

// z = f(x,y) wireframe / filled heightfield + optional contours. Form wobbles
// (morph = height breathe, ripple = travelling radial wave, fade = opacity
// breathe) run integer cycles of u — all default 0 ⇒ static render, seamless.
function surfaceRender(ctx, proj, u, eye, p) {
  const fn = (FN_OPTIONS.find((f) => f.value === p.fn) || FN_OPTIONS[0]).fn
  const R = Math.max(8, Math.round(p.res))
  const D = p.domain
  const hs = p.height * (1 + p.morph * Math.sin(TAU * u))
  const xs = new Float64Array(R)
  for (let i = 0; i < R; i++) xs[i] = -D + (2 * D * i) / (R - 1)
  const SX = new Float64Array(R * R)
  const SY = new Float64Array(R * R)
  const Z = new Float64Array(R * R)
  let zmin = Infinity
  let zmax = -Infinity
  for (let j = 0; j < R; j++) {
    const yy = xs[j]
    for (let i = 0; i < R; i++) {
      let z = fn(xs[i], yy)
      if (!Number.isFinite(z)) z = 0
      if (p.ripple) z += p.ripple * Math.sin(Math.hypot(xs[i], yy) * 2 - TAU * u)
      z *= hs
      const idx = j * R + i
      Z[idx] = z
      const [sx, sy] = proj({ x: xs[i], y: z, z: yy })
      SX[idx] = sx
      SY[idx] = sy
      if (z < zmin) zmin = z
      if (z > zmax) zmax = z
    }
  }
  const span = (zmax - zmin) || 1
  const norm = (z) => (z - zmin) / span

  if (p.fade) ctx.globalAlpha = 1 - p.fade * 0.5 * (1 - Math.cos(TAU * u))

  if (p.mode === 'fill') {
    const quads = []
    for (let j = 0; j < R - 1; j++) {
      for (let i = 0; i < R - 1; i++) {
        const a = j * R + i, b = j * R + i + 1, c = (j + 1) * R + i + 1, e = (j + 1) * R + i
        const hh = (Z[a] + Z[b] + Z[c] + Z[e]) / 4
        const dx = (xs[i] + xs[i + 1]) / 2 - eye[0]
        const dy = hh - eye[1]
        const dz = (xs[j] + xs[j + 1]) / 2 - eye[2]
        quads.push({ a, b, c, e, h: hh, depth: dx * dx + dy * dy + dz * dz })
      }
    }
    quads.sort((p2, q) => q.depth - p2.depth)
    ctx.lineWidth = 1
    for (const q of quads) {
      ctx.fillStyle = lerpHex(p.low, p.high, norm(q.h))
      ctx.strokeStyle = ctx.fillStyle
      ctx.beginPath()
      ctx.moveTo(SX[q.a], SY[q.a]); ctx.lineTo(SX[q.b], SY[q.b]); ctx.lineTo(SX[q.c], SY[q.c]); ctx.lineTo(SX[q.e], SY[q.e]); ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  } else {
    const buckets = Array.from({ length: NB }, () => [])
    const addSeg = (a, b) => {
      const bk = Math.max(0, Math.min(NB - 1, Math.floor(norm((Z[a] + Z[b]) / 2) * NB)))
      buckets[bk].push(a, b)
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < R - 1; i++) addSeg(j * R + i, j * R + i + 1)
    for (let i = 0; i < R; i++) for (let j = 0; j < R - 1; j++) addSeg(j * R + i, (j + 1) * R + i)
    ctx.lineWidth = p.weight
    ctx.lineJoin = 'round'
    for (let b = 0; b < NB; b++) {
      const seg = buckets[b]
      if (!seg.length) continue
      ctx.strokeStyle = lerpHex(p.low, p.high, b / (NB - 1))
      ctx.beginPath()
      for (let s = 0; s < seg.length; s += 2) { ctx.moveTo(SX[seg[s]], SY[seg[s]]); ctx.lineTo(SX[seg[s + 1]], SY[seg[s + 1]]) }
      ctx.stroke()
    }
  }

  if (p.contours) {
    const NL = 10
    ctx.lineWidth = 1
    // labs used the style-panel gridColor; frozen here to the high colour.
    ctx.strokeStyle = `rgba(${toRGB(p.high).join(',')},0.6)`
    ctx.beginPath()
    for (let l = 1; l < NL; l++) {
      const level = zmin + (span * l) / NL
      for (let j = 0; j < R - 1; j++) {
        for (let i = 0; i < R - 1; i++) {
          const idx = [j * R + i, j * R + i + 1, (j + 1) * R + i + 1, (j + 1) * R + i]
          const hh = idx.map((k) => Z[k])
          const cr = []
          for (let e = 0; e < 4; e++) {
            const ha = hh[e]
            const hb = hh[(e + 1) % 4]
            if ((ha - level) * (hb - level) < 0) {
              const tt = (level - ha) / (hb - ha)
              const ka = idx[e]
              const kb = idx[(e + 1) % 4]
              cr.push([SX[ka] + (SX[kb] - SX[ka]) * tt, SY[ka] + (SY[kb] - SY[ka]) * tt])
            }
          }
          if (cr.length >= 2) { ctx.moveTo(cr[0][0], cr[0][1]); ctx.lineTo(cr[1][0], cr[1][1]) }
        }
      }
    }
    ctx.stroke()
  }

  if (p.fade) ctx.globalAlpha = 1
}

// Strange-attractor polyline — full trajectory; `morph` breathes the stroke
// weight in place. Glow was already stripped in labs (shadowBlur tanked FPS).
function attractorRender(ctx, proj, u, p, traj) {
  const pts = traj.pts
  if (!pts || !pts.length) return
  const count = pts.length - 1
  ctx.lineWidth = Math.max(0.3, p.weight * (1 + p.morph * 0.6 * Math.sin(TAU * u)))
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (p.fade) ctx.globalAlpha = 1 - p.fade * 0.5 * (1 - Math.cos(TAU * u))
  if (p.gradient) {
    const NBANDS = 24
    for (let b = 0; b < NBANDS; b++) {
      const i0 = Math.floor((b / NBANDS) * count)
      const i1 = Math.floor(((b + 1) / NBANDS) * count)
      if (i1 <= i0) continue
      ctx.strokeStyle = `hsl(${200 + (b / NBANDS) * 200}, 72%, 62%)`
      ctx.beginPath()
      for (let i = i0; i <= i1; i++) {
        const [x, y] = proj(pts[i])
        if (i === i0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = p.stroke
    ctx.beginPath()
    for (let i = 0; i <= count; i++) {
      const [x, y] = proj(pts[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  if (p.fade) ctx.globalAlpha = 1
}

// Kind gates — surfaceRender-only vs attractorRender-only params (see draw()).
const isSurf = (l) => (l.kind ?? 'surface') !== 'attractor'
const isAtt = (l) => l.kind === 'attractor'

export default {
  id: 'math-surface',
  label: 'Surface',
  group: 'math',
  kind: '2d',
  duration: 12,
  params: [
    { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'surface', label: 'Surface' }, { value: 'attractor', label: 'Attractor' }], default: 'surface' },
    { key: 'fn', label: 'Function', type: 'select', options: FN_OPTIONS.map(({ value, label }) => ({ value, label })), default: 'ripple', when: isSurf },
    { key: 'attractor', label: 'Attractor', type: 'select', options: ATTRACTORS.map((a) => ({ value: a.id, label: a.label })), default: 'lorenz', when: isAtt },
    { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'wire', label: 'Wire' }, { value: 'fill', label: 'Fill' }], default: 'wire', when: isSurf },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#050506' },
    { key: 'low', label: 'Low', type: 'color', role: 'accent', default: '#1b2b4a', when: isSurf },
    { key: 'high', label: 'High', type: 'color', role: 'fg', default: '#ffd23f', when: isSurf },
    { key: 'stroke', label: 'Stroke', type: 'color', role: 'fg', default: '#9ec1ff', when: (l) => isAtt(l) && !l.gradient },
    { key: 'res', label: 'Resolution', type: 'range', min: 12, max: 72, step: 2, default: 46, noRandom: true, when: isSurf },
    { key: 'domain', label: 'Domain', type: 'range', min: 1, max: 8, step: 0.2, default: 3.2, when: isSurf },
    { key: 'height', label: 'Height', type: 'range', min: 0.1, max: 4, step: 0.1, default: 1, when: isSurf },
    { key: 'contours', label: 'Contours', type: 'toggle', default: false, when: isSurf },
    { key: 'morph', label: 'Breathe', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'ripple', label: 'Ripple', type: 'range', min: 0, max: 1, step: 0.01, default: 0, when: isSurf },
    { key: 'fade', label: 'Fade', type: 'range', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'steps', label: 'Steps', type: 'range', min: 2000, max: 12000, step: 500, default: 6000, noRandom: true, when: isAtt },
    { key: 'weight', label: 'Weight', type: 'range', min: 0.3, max: 4, step: 0.1, default: 1.1, when: (l) => isAtt(l) || (l.mode ?? 'wire') === 'wire' },
    { key: 'gradient', label: 'Rainbow', type: 'toggle', default: false, when: isAtt },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: 0, max: 3, step: 1, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'yaw', label: 'Yaw', type: 'range', min: 0, max: 360, step: 1, default: 325 },
    { key: 'pitch', label: 'Pitch', type: 'range', min: -80, max: 80, step: 1, default: 26 },
    { key: 'dist', label: 'Distance', type: 'range', min: 1.5, max: 6, step: 0.1, default: 3 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const isAtt = p.kind === 'attractor'
    const traj = isAtt ? trajectory(p) : null
    const ext = isAtt ? traj.ext : p.domain
    const target = [0, 0, 0]
    // Integer orbit turns per loop ⇒ frame(0) === frame(1).
    const yaw = (p.yaw + u * Math.round(p.spin) * 360) * DEG
    const eye = orbitEye(yaw, p.pitch * DEG, p.dist * ext, target)
    const proj = projector(eye, target, w, h, ext)

    if (isAtt) attractorRender(ctx, proj, u, p, traj)
    else surfaceRender(ctx, proj, u, eye, p)
  },
}
