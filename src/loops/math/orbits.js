import { mulberry32 } from '../gl/rng.js'
import { transport } from '../../editor/params/transport.js'

// Orbits (ported from kol-labs-single math/orbits/data/sim.js + the
// OrbitsEngine adapter in math/parametric/ParametricEditor.jsx). An orbital
// n-body sim: a heavy mass at the origin holds the bodies in (precessing)
// orbits; optional weak mutual attraction makes the cluster breathe/tangle.
// Additive ('lighter') glow dots over a fading trail buffer.
//
// STATEFUL / FREE-RUNNING — like math-spinner, this loop does NOT scrub. The
// trails are integrated history, not a function of u; draw() steps the sim
// exactly when u advances (the abstract-sims idiom, so it pauses with the
// transport) and holds while paused. State lives module-level keyed by the
// structural params + canvas size; changing count/seed or resizing rebuilds
// the system and clears the trail. gravity/mutual/trail/glow/mono act live.

const TAU = Math.PI * 2
const SOFT = 0.02 // softening so the central singularity can't blow up dt

// labs makeBodies, verbatim: velocity ⟂ radius → orbit, scaled by r.
function makeBodies(n, rng) {
  const bodies = []
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU
    const r = 0.16 + rng() * 0.34
    const speed = 0.7 + rng() * 0.7
    bodies.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      vx: -Math.sin(a) * speed * r,
      vy: Math.cos(a) * speed * r,
      hue: Math.floor(rng() * 360),
    })
  }
  return bodies
}

// labs stepBodies, verbatim: accumulate accelerations, then integrate.
function stepBodies(bodies, { gravity, mutual, dt }) {
  for (const b of bodies) {
    const d2 = b.x * b.x + b.y * b.y + SOFT
    const f = -gravity / (d2 * Math.sqrt(d2)) // central inverse-square
    let ax = f * b.x
    let ay = f * b.y
    if (mutual) {
      for (const o of bodies) {
        if (o === b) continue
        const dx = o.x - b.x
        const dy = o.y - b.y
        const dd = dx * dx + dy * dy + SOFT
        const ff = (gravity * 0.04) / (dd * Math.sqrt(dd))
        ax += ff * dx
        ay += ff * dy
      }
    }
    b.vx += ax * dt
    b.vy += ay * dt
  }
  for (const b of bodies) {
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
}

// ── Module-level state (trail buffer + bodies), keyed by structural sig.
// The transport's reset epoch is part of the sig: stop/rewind bump it, so the
// trail buffer clears and the bodies re-launch fresh (labs stop semantics).
const STATES = new Map()
function getState(w, h, p) {
  const sig = [p.count, p.seed, w | 0, h | 0, transport.getEpoch()].join('|')
  let s = STATES.get(sig)
  if (s) return s
  const buf = document.createElement('canvas')
  buf.width = Math.max(1, w | 0)
  buf.height = Math.max(1, h | 0)
  const bctx = buf.getContext('2d')
  bctx.fillStyle = p.bg || '#06070b'
  bctx.fillRect(0, 0, buf.width, buf.height)
  const bodies = makeBodies(Math.max(1, Math.round(p.count ?? 140)), mulberry32((p.seed ?? 1) >>> 0))
  s = { buf, bctx, bodies, lastU: null }
  STATES.set(sig, s)
  while (STATES.size > 4) STATES.delete(STATES.keys().next().value)
  return s
}

export default {
  id: 'math-orbits',
  label: 'Orbits',
  group: 'math',
  kind: '2d',
  duration: 12,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b' },
    { key: 'count', label: 'Bodies', type: 'range', min: 1, max: 400, step: 1, default: 140 },
    { key: 'mutual', label: 'Mutual gravity', type: 'toggle', default: false },
    { key: 'mono', label: 'Mono', type: 'toggle', default: false },
    { key: 'gravity', label: 'Gravity', type: 'range', min: 0.1, max: 3, step: 0.05, default: 0.9, tab: 'anim', section: 'Motion' },
    { key: 'trail', label: 'Trail', type: 'range', min: 0, max: 1, step: 0.01, default: 0.86, tab: 'anim', section: 'Motion' },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 30, step: 1, default: 10 },
    { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 99, step: 1, default: 1, noRandom: true },
  ],
  // u only gates stepping (pauses with the transport) — see header.
  draw(ctx, u, w, h, p) {
    const s = getState(w, h, p)
    const bctx = s.bctx

    if (u !== s.lastU) {
      s.lastU = u
      // Two half-steps per tick (labs leapfrog cadence, rate 0.016/frame).
      const dt = 0.016 * (p.speed ?? 1)
      const opts = { gravity: p.gravity ?? 0.9, mutual: !!p.mutual, dt: dt * 0.5 }
      stepBodies(s.bodies, opts)
      stepBodies(s.bodies, opts)

      // Fade the trail toward bg, then lay the glowing bodies additively.
      const scale = (Math.min(w, h) / 2) * 0.92
      const cx = w / 2
      const cy = h / 2
      bctx.globalCompositeOperation = 'source-over'
      bctx.globalAlpha = (1 - (p.trail ?? 0.86)) * 0.4 + 0.012
      bctx.fillStyle = p.bg || '#06070b'
      bctx.fillRect(0, 0, s.buf.width, s.buf.height)
      bctx.globalAlpha = 1
      bctx.globalCompositeOperation = 'lighter'
      for (const b of s.bodies) {
        const px = cx + b.x * scale
        const py = cy + b.y * scale
        const color = p.mono ? '#cfe8ff' : `hsl(${b.hue}, 90%, 66%)`
        if (p.glow > 0) { bctx.shadowBlur = p.glow; bctx.shadowColor = color }
        bctx.fillStyle = color
        bctx.beginPath()
        bctx.arc(px, py, 1.7, 0, TAU)
        bctx.fill()
      }
      bctx.shadowBlur = 0
      bctx.globalCompositeOperation = 'source-over'
    }

    ctx.drawImage(s.buf, 0, 0, w, h)
  },
}
