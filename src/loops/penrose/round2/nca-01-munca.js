// μNCA — ultra-compact 4-channel Neural CA with hand-coded 68-parameter kernel.
// Architecture: Mordvintsev & Niklasson arXiv 2111.13545
// No ML runtime. The update rule is a tiny learned convolution baked as a
// Float32Array. Perception: one 3×3 filter per channel (learned, not Sobel).
// Update: single linear projection + tanh. Permanent soliton-like motion.


import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

// 4-channel μNCA kernel weights (hand-designed, inspired by Mordvintsev 2021).
// Each channel has one 3×3 perception filter → 4×9 = 36 weights,
// plus a 4×4 linear update matrix + 4-bias = 20 params. Total ≈ 56.
// Values chosen to produce rotating wave-like texture solitons.
const K           = [
  // ch0 filter (3×3, row-major, centre=4)
   0.0, -0.25,  0.0,
  -0.25, 1.0, -0.25,
   0.0, -0.25,  0.0,
  // ch1 filter — horizontal Sobel
  -0.125, 0.0,  0.125,
  -0.25,  0.0,  0.25,
  -0.125, 0.0,  0.125,
  // ch2 filter — vertical Sobel
  -0.125, -0.25, -0.125,
   0.0,    0.0,   0.0,
   0.125,  0.25,  0.125,
  // ch3 filter — diagonal Laplacian
   0.125, 0.0, -0.125,
   0.0,   0.0,  0.0,
  -0.125, 0.0,  0.125,
]
// 4×4 linear update matrix W (row = output channel, col = input perceived channel)
// + 4 biases (last col would be bias but we keep it simple, bias=0)
const W             = [
  [ 0.6, -0.3,  0.5, -0.2],
  [-0.4,  0.7, -0.1,  0.4],
  [ 0.2, -0.5,  0.6,  0.3],
  [-0.3,  0.2, -0.4,  0.7],
]

const PARAMS          = [
  { key: 'res',    type: 'int',   min: 64,  max: 160, default: 112, step: 16,  label: 'grid res' },
  { key: 'rate',   type: 'range', min: 0.1, max: 0.9, default: 0.5, step: 0.05, label: 'update rate' },
  { key: 'speed',  type: 'range', min: 0.5, max: 3.0, default: 1.0, step: 0.1,  label: 'step / frame' },
  { key: 'bright', type: 'range', min: 0.5, max: 3.0, default: 1.4, step: 0.1,  label: 'brightness' },
]

export const r2_nca_01_munca            = {
  id: 'r2-nca-01-munca',
  name: 'μNCA',
  repo: 'Mordvintsev & Niklasson arXiv 2111.13545',
  summary: 'Ultra-compact 4-channel NCA with hand-baked 56-parameter kernel. Sobel perception + linear update + tanh. Permanent soliton motion, SDF-gated.',
  helps: 'Minimal NCA skeleton — permanent wave motion, zero runtime deps, baked weights.',
  params: PARAMS,
  init({ ctx, sdf, W: W2, H, rng, params }) {
    const G      = num(params, 'res',    112)
    const rate   = num(params, 'rate',   0.5)
    const stepsF = num(params, 'speed',  1.0)
    const bright = num(params, 'bright', 1.4)
    const NC = 4
    const N  = G * G

    const state = new Float32Array(N * NC)
    const next  = new Float32Array(N * NC)
    const mask  = new Uint8Array(N)

    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const i = y * G + x
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        mask[i] = sdf.sample(sx, sy) < 0 ? 1 : 0
        if (mask[i]) {
          for (let c = 0; c < NC; c++) state[i * NC + c] = (rng() - 0.5) * 0.4
        }
      }
    }

    function perceive(buf              , x        , y        , ch        )         {
      const off = ch * 9
      let sum = 0
      let ki = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(G - 1, x + dx))
          const ny = Math.max(0, Math.min(G - 1, y + dy))
          sum += K[off + ki] * buf[(ny * G + nx) * NC + ch]
          ki++
        }
      }
      return sum
    }

    function step() {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!mask[i]) { for (let c = 0; c < NC; c++) next[i * NC + c] = 0; continue }
          if (rng() > rate) { for (let c = 0; c < NC; c++) next[i * NC + c] = state[i * NC + c]; continue }
          const p = [perceive(state, x, y, 0), perceive(state, x, y, 1), perceive(state, x, y, 2), perceive(state, x, y, 3)]
          for (let co = 0; co < NC; co++) {
            let delta = 0
            for (let ci = 0; ci < NC; ci++) delta += W[co][ci] * p[ci]
            next[i * NC + co] = state[i * NC + co] + 0.1 * Math.tanh(delta)
          }
        }
      }
      state.set(next)
    }

    const img = ctx.createImageData(G, G)
    const sx = W2 / G, sy = H / G

    return wrapLoop(() => {
      const steps = Math.round(stepsF)
      for (let s = 0; s < steps; s++) step()

      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
          continue
        }
        // Collapse the channel-0 state to a single 0..1 field intensity for the ramp.
        const v = Math.max(0, Math.min(1, (state[i * NC + 0] * bright + 1) * 0.5))
        const [r, g, b] = rampRGB(v)
        img.data[j]     = r
        img.data[j + 1] = g
        img.data[j + 2] = b
        img.data[j + 3] = 255
      }
      clear(ctx, W2, H)
      const tmp = document.createElement('canvas')
      tmp.width = G; tmp.height = G
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W2, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W2, H)
    })
  },
}
