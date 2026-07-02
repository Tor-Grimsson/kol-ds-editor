// Multi-Scale Turing Patterns (McCabe) — CPU solver. The simulation + shading are
// DOM-free (only render()/export touch a canvas) so the exact engine can be run
// and rendered headless for verification.
//
// Per step: for each scale blur the field at its activator and (larger) inhibitor
// radius (separable toroidal box blur, twice ≈ smooth); per pixel keep the scale
// with the smallest |activator − inhibitor| and nudge by that scale's amount;
// renormalise the field to [-1,1]; bleed each pixel's colour toward its winning
// scale's hue. render() shades the field as a lit heightfield × that colour.

import { mstpPresetById, mstpColorsById } from './mstp.js'

export default class MSTPEngine {
  constructor(W = 240, H = 240) {
    this.W = W
    this.H = H
    const n = W * H
    this.grid = new Float32Array(n)
    this.next = new Float32Array(n)
    this.act = new Float32Array(n)
    this.inh = new Float32Array(n)
    this.tmp = new Float32Array(n)
    this.hsmooth = new Float32Array(n)
    this.bestVar = new Float32Array(n)
    this.bestScale = new Int8Array(n)
    this.color = new Float32Array(n * 3)

    this.scales = mstpPresetById('classic').scales
    this.colors = mstpColorsById('candy')
    this.colorMode = 'palette' // 'palette' (height→stops, smooth) | 'scale' (per-pixel winning scale)
    this.relief = 3
    this.heightBlur = 1        // light blur of the height field before shading → folds not crinkle
    this.colorRate = 0.06
    this.stepScale = 1
    this.paused = false
    this.time = 0

    this.canvas = null
    this.reseed()
  }

  // Browser-only render target. Headless callers skip this and use _shade().
  setCanvas(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.buf = document.createElement('canvas')
    this.buf.width = this.W
    this.buf.height = this.H
    this.bufCtx = this.buf.getContext('2d')
    this.img = this.bufCtx.createImageData(this.W, this.H)
  }

  setPreset(id) { this.scales = mstpPresetById(id).scales }
  setColors(id) { this.colors = mstpColorsById(id) }
  setColorMode(m) { this.colorMode = m }
  setRelief(v) { this.relief = v }
  setSpeed(m) { this.stepScale = m }
  setPaused(p) { this.paused = p }
  resetTime() { this.time = 0 }

  reseed(rand = Math.random) {
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rand() * 2 - 1
    this.color.fill(0)
    this.time = 0
  }

  // ── separable toroidal box blur (sliding window → O(pixels), radius-free) ──
  _box(src, dst, r, passes) {
    let a = src
    for (let p = 0; p < passes; p++) { this._boxH(a, this.tmp, r); this._boxV(this.tmp, dst, r); a = dst }
  }
  // Toroidal sliding-window sum. Wrap via conditional add/sub (single wrap, since
  // window ≤ W) — far cheaper than per-pixel modulo in the hot path.
  _boxH(src, dst, r) {
    const { W, H } = this
    const inv = 1 / (2 * r + 1)
    for (let y = 0; y < H; y++) {
      const base = y * W
      let sum = 0
      for (let k = -r; k <= r; k++) { let idx = k; if (idx < 0) idx += W; sum += src[base + idx] }
      for (let x = 0; x < W; x++) {
        dst[base + x] = sum * inv
        let ai = x + r + 1; if (ai >= W) ai -= W
        let ri = x - r; if (ri < 0) ri += W
        sum += src[base + ai] - src[base + ri]
      }
    }
  }
  _boxV(src, dst, r) {
    const { W, H } = this
    const inv = 1 / (2 * r + 1)
    for (let x = 0; x < W; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) { let idy = k; if (idy < 0) idy += H; sum += src[idy * W + x] }
      for (let y = 0; y < H; y++) {
        dst[y * W + x] = sum * inv
        let ai = y + r + 1; if (ai >= H) ai -= H
        let ri = y - r; if (ri < 0) ri += H
        sum += src[ai * W + x] - src[ri * W + x]
      }
    }
  }

  step() {
    const { grid, next, act, inh, bestVar, bestScale, scales, color, colors } = this
    const n = this.W * this.H
    const iters = Math.max(1, Math.round(this.stepScale))
    for (let it = 0; it < iters; it++) {
      for (let s = 0; s < scales.length; s++) {
        const sc = scales[s]
        this._box(grid, act, sc.act, 2)
        this._box(grid, inh, sc.inh, 2)
        if (s === 0) {
          for (let i = 0; i < n; i++) {
            bestVar[i] = Math.abs(act[i] - inh[i])
            bestScale[i] = 0
            next[i] = grid[i] + (act[i] > inh[i] ? sc.amount : -sc.amount)
          }
        } else {
          for (let i = 0; i < n; i++) {
            const v = act[i] - inh[i]
            const av = v < 0 ? -v : v
            if (av < bestVar[i]) {
              bestVar[i] = av
              bestScale[i] = s
              next[i] = grid[i] + (v > 0 ? sc.amount : -sc.amount)
            }
          }
        }
      }
      // renormalise to [-1,1]
      let mn = Infinity, mx = -Infinity
      for (let i = 0; i < n; i++) { const x = next[i]; if (x < mn) mn = x; if (x > mx) mx = x }
      const rng = (mx - mn) || 1
      for (let i = 0; i < n; i++) grid[i] = ((next[i] - mn) / rng) * 2 - 1
      // bleed colour toward the winning scale's hue
      const nc = colors.length
      const rate = this.colorRate
      for (let i = 0; i < n; i++) {
        const c = colors[bestScale[i] % nc]
        const j = i * 3
        color[j] += (c[0] - color[j]) * rate
        color[j + 1] += (c[1] - color[j + 1]) * rate
        color[j + 2] += (c[2] - color[j + 2]) * rate
      }
    }
    this.time += iters
  }

  // Fill an RGBA byte buffer by shading the (lightly smoothed) field as a lit
  // heightfield × colour. Colour is either a smooth palette over height, or the
  // accumulated per-pixel winning-scale hue.
  _shade(out) {
    const { W, H, color, relief, colorMode, colors } = this
    // smooth the height field → relief reads as folds, not pixel crinkle
    const hf = this.heightBlur > 0 ? (this._box(this.grid, this.hsmooth, this.heightBlur, 1), this.hsmooth) : this.grid
    const ncs = colors.length
    const Lx = -0.3, Ly = -0.45, Lz = 0.84
    const ll = Math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz)
    const lx = Lx / ll, ly = Ly / ll, lz = Lz / ll
    const amb = 0.36
    for (let y = 0; y < H; y++) {
      const y0 = y * W
      const yp = ((y + 1) % H) * W
      const ym = ((y - 1 + H) % H) * W
      for (let x = 0; x < W; x++) {
        const xr = (x + 1) % W
        const xl = (x - 1 + W) % W
        const i = y0 + x
        const gx = hf[y0 + xr] - hf[y0 + xl]
        const gy = hf[yp + x] - hf[ym + x]
        let nx = -gx * relief, ny = -gy * relief, nz = 1
        const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz)
        nx *= inv; ny *= inv; nz *= inv
        let d = nx * lx + ny * ly + nz * lz
        if (d < 0) d = 0
        const sh = amb + (1 - amb) * d
        let r, g, b
        if (colorMode === 'palette') {
          let t = (hf[i] + 1) * 0.5
          if (t < 0) t = 0; else if (t > 1) t = 1
          const seg = Math.min(ncs - 2, Math.floor(t * (ncs - 1)))
          const f = t * (ncs - 1) - seg
          const a = colors[seg], c = colors[seg + 1]
          r = a[0] + (c[0] - a[0]) * f
          g = a[1] + (c[1] - a[1]) * f
          b = a[2] + (c[2] - a[2]) * f
        } else {
          const j = i * 3
          r = color[j]; g = color[j + 1]; b = color[j + 2]
        }
        const k = i << 2
        out[k] = r * sh * 255
        out[k + 1] = g * sh * 255
        out[k + 2] = b * sh * 255
        out[k + 3] = 255
      }
    }
    return out
  }

  render() {
    if (!this.ctx) return
    this._shade(this.img.data)
    this.bufCtx.putImageData(this.img, 0, 0)
    this._blit(this.ctx, this.canvas.width, this.canvas.height)
  }

  _blit(ctx, w, h) {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.buf, 0, 0, w, h)
  }

  warmup(frames = 40) {
    for (let i = 0; i < frames; i++) this.step()
    this.render()
  }

  start() {
    if (this.raf) return
    const tick = () => {
      this.raf = requestAnimationFrame(tick)
      if (!this.paused) this.step()
      this.render()
    }
    this.raf = requestAnimationFrame(tick)
  }

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
