// Generalised reaction-diffusion solver — CPU ping-pong on a toroidal n×n grid,
// driven by a MODEL from data/models.js (model.deriv supplies the per-cell rate,
// model.dt/steps the integration). One renderer for every Turing variation.
//
// Render auto-normalises the displayed field to the palette each frame (temporally
// smoothed) so models with wildly different value ranges all read without per-model
// tuning. Square sim buffer is scaled to fill the visible canvas (page owns its
// pixel size / aspect).

import { RD_MODELS, RD_PALETTES, MODEL_DEFAULTS } from './models.js'

const rgbStops = (hexes) => hexes.map((h) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
})

export default class RDEngine {
  constructor(canvas, n = 180) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.n = n
    this.buf = document.createElement('canvas')
    this.buf.width = n
    this.buf.height = n
    this.bufCtx = this.buf.getContext('2d')
    this.img = this.bufCtx.createImageData(n, n)

    this.u = new Float32Array(n * n)
    this.v = new Float32Array(n * n)
    this.u2 = new Float32Array(n * n)
    this.v2 = new Float32Array(n * n)

    this.modelId = 'gray-scott'
    this.model = RD_MODELS[this.modelId]
    this.params = { ...MODEL_DEFAULTS[this.modelId] }
    this.seedStyle = 'scatter'
    this.palette = 'lava'
    this.stepScale = 1
    this.paused = false
    this.time = 0
    this.lo = 0
    this.hi = 1
    this.fk = null      // optional per-cell {feed,kill} maps (image dither)
    this._cp = {}       // reused per-cell params object (no per-cell GC)

    this.reseed()
  }

  // Drive feed/kill per cell from an image (Gray-Scott dither). feed/kill are
  // Float32Arrays of length n·n; null clears back to the scalar params.
  setImageField(feed, kill) { this.fk = feed && kill ? { feed, kill } : null }
  clearImageField() { this.fk = null }

  // Switch to a variation (model + its params + palette + seed). Reseeds.
  setVariation(v) {
    this.modelId = v.model
    this.model = RD_MODELS[v.model]
    this.params = { ...MODEL_DEFAULTS[v.model], ...(v.params || {}) }
    if (v.palette) this.palette = v.palette
    if (v.seed) this.seedStyle = v.seed
    this.lo = 0
    this.hi = 1
    this.reseed()
  }

  setParams(patch) { Object.assign(this.params, patch) }
  setPalette(p) { this.palette = p }
  setSeed(s) { this.seedStyle = s; this.reseed() }
  setSpeed(mult) { this.stepScale = mult }
  setPaused(p) { this.paused = p }
  resetTime() { this.time = 0 }

  _stamp(cx, cy, r) {
    const { n, u, v, model } = this
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const xx = (cx + x + n) % n
        const yy = (cy + y + n) % n
        const i = yy * n + xx
        u[i] = model.stamp.u
        v[i] = model.stamp.v
      }
    }
  }

  reseed(rand = Math.random) {
    const { n, u, v, model, seedStyle } = this
    const noise = model.noise || 0
    for (let i = 0; i < n * n; i++) {
      u[i] = model.bg.u + (noise ? (rand() - 0.5) * 2 * noise : 0)
      v[i] = model.bg.v + (noise ? (rand() - 0.5) * 2 * noise : 0)
    }
    if (seedStyle === 'center') {
      this._stamp(n >> 1, n >> 1, Math.max(4, n >> 4))
    } else if (seedStyle === 'stripe') {
      for (let y = (n >> 1) - 3; y <= (n >> 1) + 3; y++)
        for (let x = 0; x < n; x++) this._stamp(x, y, 0)
    } else if (seedStyle === 'grid') {
      const g = 5
      const sp = Math.floor(n / g)
      for (let gy = 0; gy < g; gy++)
        for (let gx = 0; gx < g; gx++)
          this._stamp(Math.floor((gx + 0.5) * sp), Math.floor((gy + 0.5) * sp), 3)
    } else {
      for (let s = 0; s < 14; s++)
        this._stamp(Math.floor(rand() * n), Math.floor(rand() * n), 3 + Math.floor(rand() * 4))
    }
    this.time = 0
  }

  step() {
    const { n, model, params } = this
    const dt = model.dt
    const iters = Math.max(1, Math.round(model.steps * this.stepScale))
    const clamp = model.clamp // optional [lo,hi] bound (stiff models) applied each substep
    const fk = this.fk        // per-cell feed/kill maps (image dither) override params
    const cp = this._cp
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
          let p = params
          if (fk) { cp.feed = fk.feed[i]; cp.kill = fk.kill[i]; p = cp }
          const d = model.deriv(u0, v0, lapU, lapV, p)
          let nu = u0 + dt * d[0]
          let nv = v0 + dt * d[1]
          if (clamp) {
            if (nu < clamp[0]) nu = clamp[0]; else if (nu > clamp[1]) nu = clamp[1]
            if (nv < clamp[0]) nv = clamp[0]; else if (nv > clamp[1]) nv = clamp[1]
          }
          U2[i] = nu
          V2[i] = nv
        }
      }
      let t = U; U = U2; U2 = t
      t = V; V = V2; V2 = t
    }
    this.u = U; this.v = V; this.u2 = U2; this.v2 = V2
    this.time += dt * iters
  }

  render() {
    const { n, model } = this
    const field = model.display === 'u' ? this.u : this.v
    let mn = Infinity
    let mx = -Infinity
    for (let i = 0; i < n * n; i++) {
      const x = field[i]
      if (!Number.isFinite(x)) continue
      if (x < mn) mn = x
      if (x > mx) mx = x
    }
    if (!Number.isFinite(mn)) { mn = 0; mx = 1 }
    // temporal smoothing of the normalisation window → no per-frame flicker
    this.lo += (mn - this.lo) * 0.1
    this.hi += (mx - this.hi) * 0.1
    const range = (this.hi - this.lo) || 1

    const pal = rgbStops((RD_PALETTES.find((p) => p.value === this.palette) || RD_PALETTES[0]).stops)
    const ns = pal.length - 1
    const d = this.img.data
    for (let i = 0; i < n * n; i++) {
      let t = (field[i] - this.lo) / range
      if (!Number.isFinite(t)) t = 0
      else if (t > 1) t = 1
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
    this.bufCtx.putImageData(this.img, 0, 0)
    this._blit(this.ctx, this.canvas.width, this.canvas.height)
  }

  _blit(ctx, w, h) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.buf, 0, 0, w, h)
  }

  // Develop the pattern to a static still without animating — so the default
  // (paused) first frame reads as a real pattern, not seed noise. No autoplay:
  // this runs once on seed, the rAF loop stays paused until the user hits play.
  warmup(frames = 70) {
    for (let i = 0; i < frames; i++) this.step()
    this.render()
  }

  // ── self-driving loop ──
  start() {
    if (this.raf) return
    const tick = () => {
      this.raf = requestAnimationFrame(tick)
      if (!this.paused) this.step()
      this.render()
    }
    this.raf = requestAnimationFrame(tick)
  }

  // ── export ──
  async exportBlob() { return await new Promise((res) => this.canvas.toBlob(res, 'image/png')) }
  async exportBlobAt(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    this._blit(c.getContext('2d'), w, h)
    return await new Promise((res) => c.toBlob(res, 'image/png'))
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = null
  }
}
