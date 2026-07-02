// Reaction-diffusion (Gray-Scott) — two chemicals U/V on a toroidal grid; V is
// fed by the U·V² reaction and decays, U is replenished. Different feed/kill
// pairs give maze / spots / coral / mitosis growth. CPU ping-pong (two Float32
// buffer pairs), upscaled by the canvas. Colour-mapped by V concentration.
//
// Ported from kol-labs-single optic/reaction. ⚠ NON-SCRUBBING: unlike every
// other 2d loop, this is a stateful simulation — the frame is the sim's history,
// not a function of u. draw() keeps a module-level sim (keyed by the seed
// pattern) and advances it a fixed `iters` steps per call regardless of u,
// exactly like the labs original free-ran while playing. Scrubbing/looping u
// therefore doesn't rewind the growth; changing the Seed param reseeds it
// (deterministically — scatter uses a fixed-seed PRNG). The image-dither mode
// (per-cell feed/kill from photo luma) stayed behind in labs; a loop has no
// media input.

const DU = 0.16
const DV = 0.08
const GRID_N = 170 // sim resolution (labs GRID_N); upscaled cover-fit to the frame

export const RD_PRESETS = [
  { value: 'maze', label: 'Maze', feed: 0.029, kill: 0.057 },
  { value: 'spots', label: 'Spots', feed: 0.035, kill: 0.065 },
  { value: 'coral', label: 'Coral', feed: 0.0545, kill: 0.062 },
  { value: 'mitosis', label: 'Mitosis', feed: 0.0367, kill: 0.0649 },
  { value: 'worms', label: 'Worms', feed: 0.046, kill: 0.063 },
]

export const RD_SEEDS = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'center', label: 'Center' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'grid', label: 'Grid' },
]

export const RD_PALETTES = [
  { value: 'lava', label: 'Lava', stops: ['#05010a', '#7a1f0a', '#ff6b00', '#ffd23f'] },
  { value: 'ink', label: 'Ink', stops: ['#ffffff', '#9aa6b2', '#10131a', '#000000'] },
  { value: 'jade', label: 'Jade', stops: ['#02110d', '#0b6e4f', '#2ec4b6', '#e0fbfc'] },
  { value: 'violet', label: 'Violet', stops: ['#0a0118', '#5f0f60', '#c724b1', '#ffd1ff'] },
]

const rgbStops = (hexes) => hexes.map((h) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
})

// Deterministic PRNG for the scatter seed — same layout every reseed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class GrayScott {
  constructor(n = 170) {
    this.feed = 0.0367
    this.kill = 0.0649
    this.du = DU
    this.dv = DV
    this.seed = 'scatter'
    this.gain = 3.2
    this.setSize(n)
  }

  setSize(n) {
    this.n = n
    this.u = new Float32Array(n * n)
    this.v = new Float32Array(n * n)
    this.u2 = new Float32Array(n * n)
    this.v2 = new Float32Array(n * n)
    this.reseed()
  }

  setParams({ feed, kill, du, dv, seed, gain }) {
    if (feed != null) this.feed = feed
    if (kill != null) this.kill = kill
    if (du != null) this.du = du
    if (dv != null) this.dv = dv
    if (seed != null) this.seed = seed
    if (gain != null) this.gain = gain
  }

  // Stamp a square block of V at (cx,cy).
  _stamp(cx, cy, r) {
    const { n, u, v } = this
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const xx = (cx + x + n) % n
        const yy = (cy + y + n) % n
        v[yy * n + xx] = 1
        u[yy * n + xx] = 0.5
      }
    }
  }

  reseed(rand = Math.random) {
    const { n, u, v, seed } = this
    u.fill(1)
    v.fill(0)
    if (seed === 'center') {
      this._stamp(n >> 1, n >> 1, Math.max(4, n >> 4))
    } else if (seed === 'stripe') {
      for (let y = (n >> 1) - 3; y <= (n >> 1) + 3; y++)
        for (let x = 0; x < n; x++) { v[y * n + x] = 1; u[y * n + x] = 0.5 }
    } else if (seed === 'grid') {
      const g = 5, sp = Math.floor(n / g)
      for (let gy = 0; gy < g; gy++)
        for (let gx = 0; gx < g; gx++)
          this._stamp(Math.floor((gx + 0.5) * sp), Math.floor((gy + 0.5) * sp), 3)
    } else {
      // scatter — a handful of random square seeds
      for (let s = 0; s < 14; s++)
        this._stamp(Math.floor(rand() * n), Math.floor(rand() * n), 3 + Math.floor(rand() * 4))
    }
  }

  step(iters) {
    const { n, feed, kill, du: DU, dv: DV } = this
    let U = this.u, V = this.v, U2 = this.u2, V2 = this.v2
    for (let it = 0; it < iters; it++) {
      for (let y = 0; y < n; y++) {
        const y0 = y * n
        const ym = ((y - 1 + n) % n) * n
        const yp = ((y + 1) % n) * n
        for (let x = 0; x < n; x++) {
          const xm = (x - 1 + n) % n
          const xp = (x + 1) % n
          const i = y0 + x
          const u0 = U[i], v0 = V[i]
          const lapU = U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x] - 4 * u0
          const lapV = V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x] - 4 * v0
          const uvv = u0 * v0 * v0
          U2[i] = u0 + (DU * lapU - uvv + feed * (1 - u0))
          V2[i] = v0 + (DV * lapV + uvv - (kill + feed) * v0)
        }
      }
      let t = U; U = U2; U2 = t
      t = V; V = V2; V2 = t
    }
    this.u = U; this.v = V; this.u2 = U2; this.v2 = V2
  }

  render(canvas, palette) {
    const { n, v } = this
    if (canvas.width !== n || canvas.height !== n) { canvas.width = n; canvas.height = n }
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(n, n)
    const d = img.data
    const pal = rgbStops((RD_PALETTES.find((p) => p.value === palette) || RD_PALETTES[0]).stops)
    const ns = pal.length - 1
    const gain = this.gain
    for (let i = 0; i < n * n; i++) {
      let t = v[i] * gain
      if (t > 1) t = 1
      else if (t < 0) t = 0
      const seg = Math.min(ns - 1, Math.floor(t * ns))
      const f = t * ns - seg
      const a = pal[seg], b = pal[seg + 1]
      const j = i << 2
      d[j] = a[0] + (b[0] - a[0]) * f
      d[j + 1] = a[1] + (b[1] - a[1]) * f
      d[j + 2] = a[2] + (b[2] - a[2]) * f
      d[j + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }
}

// Module-level free-running sim + its square pixel buffer (one loop renders at a
// time, same sharing rule as the field rasterizer). Keyed by the seed pattern —
// changing Seed reseeds; feed/kill/du/dv/gain morph the running sim live, exactly
// like the labs rail sliders did.
let sim = null
let simKey = ''
let buf = null

export default {
  id: 'optic-reaction',
  label: 'Reaction diffusion',
  group: 'optic',
  kind: '2d',
  duration: 8, // nominal — the sim free-runs; u only paces the transport
  params: [
    { key: 'palette', label: 'Palette', type: 'select', options: RD_PALETTES.map(({ value, label }) => ({ value, label })), default: 'lava' },
    { key: 'seed', label: 'Seed', type: 'select', options: RD_SEEDS, default: 'scatter' },
    { key: 'feed', label: 'Feed', type: 'range', min: 0.01, max: 0.08, step: 0.0005, default: 0.0367, noRandom: true },
    { key: 'kill', label: 'Kill', type: 'range', min: 0.04, max: 0.075, step: 0.0005, default: 0.0649, noRandom: true },
    { key: 'du', label: 'Diffuse U', type: 'range', min: 0.05, max: 0.3, step: 0.005, default: 0.16, noRandom: true },
    { key: 'dv', label: 'Diffuse V', type: 'range', min: 0.02, max: 0.16, step: 0.005, default: 0.08, noRandom: true },
    { key: 'iters', label: 'Speed', type: 'range', min: 1, max: 30, step: 1, default: 10, noRandom: true, tab: 'anim', section: 'Motion' },
    { key: 'gain', label: 'Contrast', type: 'range', min: 1, max: 6, step: 0.1, default: 3.2 },
  ],
  draw(ctx, u, w, h, p) {
    const key = String(p.seed)
    if (!sim || simKey !== key) {
      sim = new GrayScott(GRID_N)
      sim.setParams({ seed: p.seed })
      sim.reseed(mulberry32(0xC0FFEE))
      simKey = key
      if (!buf) buf = document.createElement('canvas')
    }
    sim.setParams({ feed: p.feed, kill: p.kill, du: p.du, dv: p.dv, gain: p.gain })
    sim.step(Math.max(1, Math.round(p.iters))) // fixed steps per draw — free-running
    sim.render(buf, p.palette)
    // cover-fit the square sim onto the frame
    const s = Math.max(w / GRID_N, h / GRID_N)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(buf, (w - GRID_N * s) / 2, (h - GRID_N * s) / 2, GRID_N * s, GRID_N * s)
  },
}
