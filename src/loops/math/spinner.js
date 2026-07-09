import { mulberry32 } from '../gl/rng.js'
import { transport } from '../../editor/params/transport.js'

// Thread Spinner (ported from kol-labs-single math/spinner: data/spinner.js +
// engine.js, after polyhop's "Thread Spinner"). A dozen-ish balls each ride a
// BIG looping orbit — a two-vector epicycle detuned slightly off an integer
// frequency ratio (`drift`), so the loop never exactly closes; it precesses and
// fills space over time = the entropy build. Each ball's glowing thread
// accumulates on an offscreen buffer; the white heads are drawn fresh each
// frame over a blit of the buffer.
//
// STATEFUL / FREE-RUNNING — this loop does NOT scrub. The accumulated threads
// are history, not a function of u, so draw() ignores u and advances the sim a
// fixed dt per call. State lives module-level, keyed by the structural params +
// canvas size; changing a structural param (count/drift/span/reach/seed) or
// resizing rebuilds the field and clears the accumulation. Cosmetic params
// (speed/persist/weight/glow/ballR/mono/heads/thread/bg) take effect live.

const TAU = Math.PI * 2
// Second-vector frequency ratios → the loop's shape (oval / clover / figure-8…).
const RATIOS = [2, -2, 3, -3, 2, -1, 3, -2]

function makeSpinner(opts = {}, seed = 1) {
  const rng = mulberry32((seed ?? 1) >>> 0)
  const count = Math.max(1, Math.round(opts.count ?? 12))
  const drift = opts.drift ?? 0.05 // detune from the integer ratio ⇒ slow precession
  const span = opts.span ?? 1 // loop-size multiplier

  const balls = []
  for (let i = 0; i < count; i++) {
    const a1 = (0.36 + rng() * 0.14) * span // primary loop radius (fraction of reach)
    const a2 = (0.18 + rng() * 0.16) * span // secondary vector ⇒ the loop's character
    const dir = rng() < 0.5 ? 1 : -1
    const w1 = dir * (0.85 + rng() * 0.3) // base orbit speed (gentle spread ⇒ slow relative drift)
    const ratio = RATIOS[i % RATIOS.length]
    const detune = drift * (rng() - 0.5) * 2 // near-integer ⇒ the loop slowly precesses
    const w2 = w1 * (ratio + detune)
    const p1 = (i / count) * TAU // evenly phased ⇒ ordered start
    const p2 = rng() * TAU
    balls.push({ a1, a2, w1, w2, p1, p2, hue: (i / count) * 360, px: 0, py: 0, started: false })
  }
  return balls
}

// Ball position at time t, scaled to canvas: centre (cx,cy), `reach` = px of the
// half-frame the loops fill.
function ballPos(b, t, cx, cy, reach) {
  const x = b.a1 * Math.cos(b.w1 * t + b.p1) + b.a2 * Math.cos(b.w2 * t + b.p2)
  const y = b.a1 * Math.sin(b.w1 * t + b.p1) + b.a2 * Math.sin(b.w2 * t + b.p2)
  return [cx + x * reach, cy + y * reach]
}

// ── Module-level state (buffer + balls + sim time), keyed by structural sig.
// The transport's reset epoch is part of the sig: stop/rewind bump it, so the
// accumulated threads clear and the sim restarts fresh (labs stop semantics).
const STATES = new Map()

function getState(w, h, p) {
  const sig = [p.count, p.drift, p.span, p.reach, p.seed, w | 0, h | 0, transport.getEpoch()].join('|')
  let s = STATES.get(sig)
  if (s) return s
  const buf = document.createElement('canvas')
  buf.width = Math.max(1, w | 0)
  buf.height = Math.max(1, h | 0)
  const bctx = buf.getContext('2d')
  bctx.fillStyle = p.bg || '#060608'
  bctx.fillRect(0, 0, buf.width, buf.height)
  const balls = makeSpinner({ count: p.count, drift: p.drift, span: p.span }, p.seed ?? 1)
  // Seed head positions so the first composite shows real heads.
  const reach = Math.min(w, h) * 0.5 * (p.reach ?? 0.92)
  for (const b of balls) {
    const [x, y] = ballPos(b, 0, w / 2, h / 2, reach)
    b.px = x
    b.py = y
    b.started = true
  }
  s = { buf, bctx, balls, t: 0 }
  STATES.set(sig, s)
  while (STATES.size > 4) STATES.delete(STATES.keys().next().value)
  return s
}

export default {
  id: 'math-spinner',
  label: 'Spinner',
  group: 'math',
  kind: '2d',
  duration: 12,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#060608' },
    { key: 'thread', label: 'Thread', type: 'color', role: 'fg', default: '#ffffff', when: (l) => !!l.mono },
    { key: 'mono', label: 'Mono', type: 'toggle', default: false },
    { key: 'heads', label: 'Heads', type: 'toggle', default: true },
    { key: 'count', label: 'Balls', type: 'range', min: 2, max: 24, step: 1, default: 12 },
    { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.05 },
    { key: 'span', label: 'Span', type: 'range', min: 0.5, max: 1.5, step: 0.05, default: 1 },
    { key: 'reach', label: 'Reach', type: 'range', min: 0.4, max: 1, step: 0.02, default: 0.92 },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.05, default: 1, tab: 'anim', section: 'Motion' },
    { key: 'persist', label: 'Persist', type: 'range', min: 0.8, max: 1, step: 0.005, default: 1, noRandom: true },
    { key: 'weight', label: 'Weight', type: 'range', min: 0.5, max: 6, step: 0.1, default: 2 },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 24, step: 1, default: 8 },
    { key: 'ballR', label: 'Ball size', type: 'range', min: 2, max: 20, step: 1, default: 9, when: (l) => l.heads !== false },
    { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 99, step: 1, default: 1, noRandom: true },
  ],
  // u is intentionally unused — free-running accumulation (see header).
  draw(ctx, u, w, h, p) {
    const s = getState(w, h, p)
    const bctx = s.bctx

    // ── Step: advance the sim by a fixed dt and lay each ball's thread segment.
    const persist = p.persist ?? 1
    bctx.globalCompositeOperation = 'source-over'
    if (persist < 1) {
      bctx.globalAlpha = (1 - persist) * 0.5
      bctx.fillStyle = p.bg || '#060608'
      bctx.fillRect(0, 0, s.buf.width, s.buf.height)
      bctx.globalAlpha = 1
    }

    s.t += (1 / 60) * (p.speed ?? 1)
    const cx = w / 2
    const cy = h / 2
    const reach = Math.min(w, h) * 0.5 * (p.reach ?? 0.92)
    const mono = !!p.mono
    const thread = p.thread || '#ffffff'
    const glow = p.glow ?? 8

    bctx.lineWidth = p.weight ?? 2
    bctx.lineCap = 'round'
    bctx.lineJoin = 'round'
    for (const b of s.balls) {
      const [x, y] = ballPos(b, s.t, cx, cy, reach)
      if (b.started) {
        const col = mono ? thread : `hsl(${b.hue}, 90%, 62%)`
        bctx.strokeStyle = col
        if (glow > 0) { bctx.shadowBlur = glow; bctx.shadowColor = col }
        bctx.beginPath()
        bctx.moveTo(b.px, b.py)
        bctx.lineTo(x, y)
        bctx.stroke()
      }
      b.px = x
      b.py = y
      b.started = true
    }
    bctx.shadowBlur = 0

    // ── Composite: accumulated threads + the current glowing heads.
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(s.buf, 0, 0, w, h)
    if (p.heads !== false) {
      const r = p.ballR ?? 9
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(255,255,255,0.85)'
      ctx.shadowBlur = r * 1.6
      for (const b of s.balls) {
        ctx.beginPath()
        ctx.arc(b.px, b.py, r, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  },
}
