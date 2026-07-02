import { TAU } from '../../lib/util.js'

const frac = (t) => { const f = t / TAU; return f - Math.floor(f) }

// PROFILE library — the edge silhouette of an organic band. Each is periodic
// (period TAU, range ~-1..1) so bands tile and stay seamless under whole-cycle
// phase. Like a Photoshop/Blender curve preset: smooth → harsh, simple → complex.
//   smooth   sine · blob · hump · swell
//   complex  double · ripple
//   harsh    triangle · ridge · pinch · saw · step
const PROFILES = {
  sine:   (t) => Math.sin(t),
  blob:   (t) => { const f = frac(t), s = f < 0.5 ? f * 2 : (1 - f) * 2; return 2 * (s * s * (3 - 2 * s)) - 1 },
  hump:   (t) => { const s = Math.sin(t); return Math.sign(s) * Math.pow(Math.abs(s), 0.5) },
  swell:  (t) => Math.sin(t - 0.6 * Math.sin(t)),
  double: (t) => 0.78 * Math.sin(t) + 0.42 * Math.sin(2 * t),
  ripple: (t) => 0.62 * Math.sin(t) + 0.3 * Math.sin(2 * t) + 0.16 * Math.sin(3 * t + 1),
  tri:    (t) => { const f = frac(t); return 1 - 4 * Math.abs(f - 0.5) },
  ridge:  (t) => { const c = 0.5 + 0.5 * Math.cos(t); return 1 - 2 * Math.pow(c, 0.4) },
  pinch:  (t) => { const s = Math.sin(t); return Math.sign(s) * Math.pow(Math.abs(s), 2.4) },
  saw:    (t) => 2 * frac(t) - 1,
  step:   (t) => (frac(t) < 0.5 ? -1 : 1),
}
const profileFn = (kind) => PROFILES[kind] || PROFILES.sine
export const PROFILE_KEYS = Object.keys(PROFILES)
// Sample one period of a profile to N points (for previews) — y up, range ~-1..1.
export const sampleProfile = (kind, n = 48) => { const f = profileFn(kind); return Array.from({ length: n }, (_, i) => f((i / (n - 1)) * TAU)) }

// ── Custom profile — an editable bezier curve (ProfileEditor). Nodes live in
// normalized space x∈[0,1] (one period) · y∈[-1,1], each with in/out handle offsets
// (hl/hr). Endpoints (x=0,1) share y so the profile tiles. The engine bakes it to a
// lookup table and samples it like any other profile.
export const DEFAULT_CURVE = [
  { x: 0,    y: 0,  hlx: -0.10, hly: 0, hrx: 0.10, hry: 0 },
  { x: 0.25, y: 1,  hlx: -0.10, hly: 0, hrx: 0.10, hry: 0 },
  { x: 0.5,  y: 0,  hlx: -0.10, hly: 0, hrx: 0.10, hry: 0 },
  { x: 0.75, y: -1, hlx: -0.10, hly: 0, hrx: 0.10, hry: 0 },
  { x: 1,    y: 0,  hlx: -0.10, hly: 0, hrx: 0.10, hry: 0 },
]
const cube = (a, b, c, d, t) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d }
export function sampleCurveLUT(nodes, N = 129) {
  const pts = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1], STEPS = 24
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS
      pts.push([cube(a.x, a.x + a.hrx, b.x + b.hlx, b.x, t), cube(a.y, a.y + a.hry, b.y + b.hly, b.y, t)])
    }
  }
  pts.sort((p, q) => p[0] - q[0])
  const lut = new Array(N)
  let j = 0
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1)
    while (j < pts.length - 2 && pts[j + 1][0] < x) j++
    const p0 = pts[j], p1 = pts[j + 1] || p0
    const dx = p1[0] - p0[0]
    lut[i] = Math.max(-1.5, Math.min(1.5, dx > 1e-6 ? p0[1] + (p1[1] - p0[1]) * ((x - p0[0]) / dx) : p0[1]))
  }
  return lut
}
// Convert a named profile into editable bezier nodes (Catmull-Rom handles) so the
// ProfileEditor can be seeded from ANY profile and tweaked right away. Endpoints share
// y so the curve still tiles.
export function profileToNodes(kind, N = 7) {
  const f = profileFn(kind)
  const xs = Array.from({ length: N }, (_, i) => i / (N - 1))
  const ys = xs.map((x) => Math.max(-1, Math.min(1, f(x * TAU))))
  const ye = (ys[0] + ys[N - 1]) / 2; ys[0] = ye; ys[N - 1] = ye
  return xs.map((x, i) => {
    const xp = xs[i - 1] ?? (x - 0.14), xn = xs[i + 1] ?? (x + 0.14)
    const yp = ys[i - 1] ?? ys[i], yn = ys[i + 1] ?? ys[i]
    const slope = (yn - yp) / (xn - xp || 1)
    const dL = (x - xp) / 3, dR = (xn - x) / 3
    return { x, y: ys[i], hlx: -dL, hly: -slope * dL, hrx: dR, hry: slope * dR }
  })
}
let _lut = null, _lutKey = ''
function customWave(nodes) {
  const key = JSON.stringify(nodes)
  if (key !== _lutKey) { _lut = sampleCurveLUT(nodes); _lutKey = key }
  const N = _lut.length
  return (t) => { const x = frac(t / TAU) * (N - 1), i = Math.floor(x); return _lut[i] + (_lut[Math.min(i + 1, N - 1)] - _lut[i]) * (x - i) }
}

// Organic — parallel bands with a wavy edge PROFILE (not blobs). Drawn as filled
// VECTOR paths (one per band); all boundaries share one wave so the bands stay
// parallel and a whole-period drift is seamless. Palette cycles the bands.
//   waveAmp  undulation depth (× pitch)   waveFreq  waves across   waveProfile  edge shape
// Two motion layers, both seamless:
//   FRAME — the whole pattern drifts ACROSS the bands, in/out of frame (camFlow).
//   FORM  — each band moves INDIVIDUALLY: Sway shifts a band, Stagger phases it by
//           colour index (×π ⇒ odd/even opposite at 1).
export function drawOrganic(ctx, u, w, h, p) {
  const cols = [p.color, p.color2 || p.color, p.color3 || p.color2 || p.color]
  const bands = Math.max(1, Math.round(p.bandCount || 2))
  const pitch = Math.max(8, p.stripePitch || 90)
  const freq = p.waveFreq == null ? 1.5 : p.waveFreq
  const amp = (p.waveAmp == null ? 0.4 : p.waveAmp) * pitch
  const z = p.camZoom || 1
  const split = p.panDir === 'split'
  const dir = (p.panDir === 'left' || p.panDir === 'up' || p.panDir === 'anti') ? -1 : 1
  const wave = (p.waveProfile === 'custom' && Array.isArray(p.waveCurve) && p.waveCurve.length > 1)
    ? customWave(p.waveCurve) : profileFn(p.waveProfile)
  // Frame moves on BOTH axes, independently & seamlessly:
  //   ACROSS (camFlow) — drift the bands in/out of frame (whole colour-periods).
  //   ALONG  (waveFlow) — the wave travels along the bands (whole wave-cycles).
  // Split applies the across-scroll per-band by parity (odd/even counter-march).
  const scroll = u * Math.round(p.camFlow || 0) * bands
  const drift = (split ? 0 : scroll * dir) + (p.offsetX || 0) * bands
  const wavePhase = u * TAU * Math.round(p.waveFlow || 0) * dir // along-axis travel
  // Per-band Form (seamless): phase keyed to colour index (n mod bands) so it
  // composes with the Frame drift without breaking the loop.
  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
  const stag = (p.fieldStagger || 0) * Math.PI
  const sway = (p.fieldSway || 0) * pitch * 0.5
  const bandPhase = (n) => tphase - (((n % bands) + bands) % bands) * stag

  // Split opens gaps between counter-marching bands; `fillMode` fills them: 'off' =
  // ground (p.bg) · 'solid' = a chosen colour · 'extend' = each band stretches to its
  // neighbour (its right edge uses the next band's shift — handled below).
  if (split && p.fillMode === 'solid') { ctx.fillStyle = p.fillColor || p.bg; ctx.fillRect(0, 0, w, h) }

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((p.camAngle || 0) * Math.PI / 180)
  ctx.scale(z, z)
  ctx.rotate((p.stripeAngle || 0) * Math.PI / 180) // band-local: x = band normal, y = along band
  ctx.translate(0, (p.offsetY || 0) * pitch * bands) // Offset Y: shift the wave along the bands

  const reach = (Math.hypot(w, h) / 2) / z + pitch * 2
  const k = (TAU * freq) / (reach * 2)            // ~freq waves across the visible span
  const step = Math.max(4, (reach * 2) / 72)       // path sampling along y
  // boundary m's x at along-coord y — shared by the two bands meeting on it; carries
  // the Frame drift + the band's own Sway.
  // Edge x at along-coord y for band `n` (shiftBands counter-marches it in Split).
  const bx = (m, y, shiftBands) => (m - drift - shiftBands) * pitch + amp * wave(k * y + wavePhase) + sway * Math.sin(bandPhase(m))
  const ext = split ? Math.round(p.camFlow || 0) * bands + 2 : 0 // max shift over the loop (constant ⇒ stable range)
  const nLo = Math.floor(-reach / pitch + drift) - 1 - ext
  const nHi = Math.ceil(reach / pitch + drift) + 1 + ext
  // 'extend': a static abutting base layer (the MOST-BACK layer) — the marching
  // bands reveal the pattern continuing behind them in the gaps, not a stretched front.
  if (split && p.fillMode === 'extend') {
    for (let n = nLo; n <= nHi; n++) {
      ctx.fillStyle = cols[((n % bands) + bands) % bands]
      ctx.beginPath()
      ctx.moveTo(bx(n, -reach, 0), -reach)
      for (let y = -reach; y <= reach; y += step) ctx.lineTo(bx(n, y, 0), y)
      for (let y = reach; y >= -reach; y -= step) ctx.lineTo(bx(n + 1, y, 0), y)
      ctx.closePath()
      ctx.fill()
    }
  }
  for (let n = nLo; n <= nHi; n++) {
    // Split: the whole band n counter-marches by parity (odd vs even opposite).
    const sh = split ? (n & 1 ? -1 : 1) * scroll : 0
    ctx.fillStyle = cols[((n % bands) + bands) % bands]
    ctx.beginPath()
    ctx.moveTo(bx(n, -reach, sh), -reach)
    for (let y = -reach; y <= reach; y += step) ctx.lineTo(bx(n, y, sh), y)
    for (let y = reach; y >= -reach; y -= step) ctx.lineTo(bx(n + 1, y, sh), y)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}
