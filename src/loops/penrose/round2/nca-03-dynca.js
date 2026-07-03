// DyNCA — motion-directed dynamic texture CA.
// Architecture: Pajouheshgar, Xu, Süsstrunk CVPR 2023 (arXiv 2211.11417)
// Key feature: externally controllable motion direction. State = 3 appearance
// channels + 2 motion channels. The motion field is injected as a Sobel
// projection aligned to a user-steerable angle, advecting the appearance channels.
// Cells outside the SDF are zeroed; permanent directed flow inside.


import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',    type: 'int',   min: 64,   max: 160,  default: 112,  step: 16,  label: 'grid res' },
  { key: 'angle',  type: 'range', min: 0,    max: 360,  default: 45,   step: 5,   label: 'flow angle°' },
  { key: 'speed',  type: 'range', min: 0.05, max: 0.5,  default: 0.15, step: 0.05, label: 'flow speed' },
  { key: 'rate',   type: 'range', min: 0.2,  max: 1.0,  default: 0.5,  step: 0.05, label: 'update rate' },
  { key: 'bright', type: 'range', min: 0.5,  max: 3.0,  default: 1.6,  step: 0.1,  label: 'brightness' },
]

// Sobel-x and Sobel-y — combine to project along arbitrary direction
const SX = [-0.125, 0, 0.125, -0.25, 0, 0.25, -0.125, 0, 0.125]
const SY = [-0.125, -0.25, -0.125, 0, 0, 0, 0.125, 0.25, 0.125]

export const r2_nca_03_dynca            = {
  id: 'r2-nca-03-dynca',
  name: 'DyNCA',
  repo: 'Pajouheshgar et al CVPR 2023 arXiv 2211.11417',
  summary: 'Motion-directed NCA: 3 appearance + 2 motion channels. Flow angle is live-steerable. Sobel perception projected onto motion vector drives appearance advection. Permanent directed flow.',
  helps: 'Choreographed letterform fill — strokes flow along glyph axes rather than randomly.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G      = num(params, 'res',    112)
    const NC_A   = 3   // appearance
    const NC_M   = 2   // motion (vx, vy)
    const NC     = NC_A + NC_M
    const N      = G * G

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
          for (let c = 0; c < NC_A; c++) state[i * NC + c] = (rng() - 0.5) * 0.5
          state[i * NC + NC_A + 0] = (rng() - 0.5) * 0.2
          state[i * NC + NC_A + 1] = (rng() - 0.5) * 0.2
        }
      }
    }

    function conv3ch(buf              , x        , y        , ch        , f          )         {
      let s = 0, k = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(G - 1, x + dx))
          const ny = Math.max(0, Math.min(G - 1, y + dy))
          s += f[k++] * buf[(ny * G + nx) * NC + ch]
        }
      }
      return s
    }

    // Bilinear sample of appearance channel at sub-pixel position
    function sampleApp(buf              , fx        , fy        , ch        )         {
      const x0 = Math.floor(fx), y0 = Math.floor(fy)
      const tx = fx - x0, ty = fy - y0
      const x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1)
      const xx0 = Math.max(0, x0), yy0 = Math.max(0, y0)
      const v00 = buf[(yy0 * G + xx0) * NC + ch]
      const v10 = buf[(yy0 * G + x1)  * NC + ch]
      const v01 = buf[(y1  * G + xx0) * NC + ch]
      const v11 = buf[(y1  * G + x1)  * NC + ch]
      return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
    }

    return wrapLoop(() => {
      const ang    = num(params, 'angle', 45) * (Math.PI / 180)
      const spd    = num(params, 'speed', 0.15)
      const rate   = num(params, 'rate',  0.5)
      const bright = num(params, 'bright', 1.6)
      const cos    = Math.cos(ang), sin = Math.sin(ang)

      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!mask[i]) { for (let c = 0; c < NC; c++) next[i * NC + c] = 0; continue }
          if (rng() > rate) { for (let c = 0; c < NC; c++) next[i * NC + c] = state[i * NC + c]; continue }

          // Motion perception: project Sobel onto flow direction
          const gx0 = conv3ch(state, x, y, 0, SX), gy0 = conv3ch(state, x, y, 0, SY)
          const gx1 = conv3ch(state, x, y, 1, SX), gy1 = conv3ch(state, x, y, 1, SY)
          const vx = state[i * NC + NC_A + 0], vy = state[i * NC + NC_A + 1]

          // Update motion channels toward external direction
          const mvx = 0.9 * vx + 0.1 * (cos * spd)
          const mvy = 0.9 * vy + 0.1 * (sin * spd)
          next[i * NC + NC_A + 0] = mask[i] ? mvx : 0
          next[i * NC + NC_A + 1] = mask[i] ? mvy : 0

          // Advect appearance channels along motion field
          for (let c = 0; c < NC_A; c++) {
            const gx = c === 0 ? gx0 : c === 1 ? gx1 : conv3ch(state, x, y, 2, SX)
            const gy = c === 0 ? gy0 : c === 1 ? gy1 : conv3ch(state, x, y, 2, SY)
            const adv = sampleApp(state, x - mvx, y - mvy, c)
            next[i * NC + c] = adv + 0.05 * Math.tanh(-gx * cos - gy * sin)
          }
          // enforce SDF mask
          if (!mask[i]) for (let c = 0; c < NC; c++) next[i * NC + c] = 0
        }
      }
      state.set(next)

      // render
      const img = ctx.createImageData(G, G)
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!mask[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j + 1] = bg; img.data[j + 2] = bb; img.data[j + 3] = 255
          continue
        }
        const r = Math.max(0, Math.min(1, state[i * NC + 0] * bright * 0.5 + 0.5))
        const g = Math.max(0, Math.min(1, state[i * NC + 1] * bright * 0.5 + 0.5))
        const b = Math.max(0, Math.min(1, state[i * NC + 2] * bright * 0.5 + 0.5))
        const intensity = (r + g + b) / 3
        const [cr, cg, cb] = rampRGB(intensity)
        img.data[j]     = cr
        img.data[j + 1] = cg
        img.data[j + 2] = cb
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = G; tmp.height = G
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
