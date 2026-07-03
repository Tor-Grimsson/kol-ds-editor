// FitzHugh-Nagumo excitable medium.
// Two variables: fast activator u, slow recovery v.
// Produces perpetually rotating spiral waves inside the masked glyph.
// Reference: FitzHugh 1961, Nagumo 1962; Murray "Mathematical Biology II" Ch 1–2.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',    type: 'int',   min: 80,   max: 220, default: 160,  step: 20,   label: 'grid' },
  { key: 'dU',     type: 'range', min: 0.05, max: 2.0, default: 1.0,  step: 0.05, label: 'diffU' },
  { key: 'dV',     type: 'range', min: 0.0,  max: 0.5, default: 0.05, step: 0.01, label: 'diffV' },
  { key: 'eps',    type: 'range', min: 0.005, max: 0.1, default: 0.02, step: 0.005, label: 'epsilon' },
  { key: 'a',      type: 'range', min: -0.5, max: 0.5, default: 0.1,  step: 0.01, label: 'threshold a' },
  { key: 'b',      type: 'range', min: 0.1,  max: 1.5, default: 0.5,  step: 0.05, label: 'recovery b' },
]

export const r2_rd_01_fhn            = {
  id: 'r2-rd-01-fhn',
  name: 'FITZHUGH-NAGUMO',
  repo: 'FitzHugh 1961 + Nagumo 1962',
  summary: 'Excitable-medium PDE producing perpetual rotating spiral waves confined inside the SDF-masked glyph.',
  helps: 'Continuous motion — never settles. Classic cardiac-tissue dynamics render the letter as living tissue.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const res  = num(params, 'res',  160)
    const dU   = num(params, 'dU',   1.0)
    const dV   = num(params, 'dV',   0.05)
    const eps  = num(params, 'eps',  0.02)
    const a    = num(params, 'a',    0.1)
    const b    = num(params, 'b',    0.5)
    const dt   = 0.1

    const N = res * res
    const U  = new Float32Array(N)
    const V  = new Float32Array(N)
    const U2 = new Float32Array(N)
    const V2 = new Float32Array(N)
    const isIn = new Uint8Array(N)

    // Build mask
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const sx = (x / res) * sdf.w
        const sy = (y / res) * sdf.h
        isIn[y * res + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    // Seed: broken wavefront in upper half — nucleates spirals
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const i = y * res + x
        if (!isIn[i]) continue
        if (y < res * 0.5) {
          U[i] = rng() * 0.5 + 0.5
          V[i] = rng() * 0.2
        } else {
          U[i] = rng() * 0.1 - 0.5
          V[i] = rng() * 0.1
        }
      }
    }

    const img = ctx.createImageData(res, res)
    const tmp = document.createElement('canvas')
    tmp.width = res; tmp.height = res
    const tc = tmp.getContext('2d')

    const lap = (buf              , x        , y        )         => {
      const i = y * res + x
      const l = x > 0       ? buf[i - 1]   : buf[i]
      const r = x < res - 1 ? buf[i + 1]   : buf[i]
      const u = y > 0       ? buf[i - res]  : buf[i]
      const d = y < res - 1 ? buf[i + res]  : buf[i]
      return l + r + u + d - 4 * buf[i]
    }

    return wrapLoop(() => {
      for (let it = 0; it < 3; it++) {
        for (let y = 0; y < res; y++) {
          for (let x = 0; x < res; x++) {
            const i = y * res + x
            if (!isIn[i]) { U2[i] = U[i]; V2[i] = V[i]; continue }
            const u = U[i], v = V[i]
            const lu = lap(U, x, y)
            const lv = lap(V, x, y)
            // FHN: du/dt = dU∇²u − u³ + u − v
            //      dv/dt = dV∇²v + eps(u − b*v + a)
            U2[i] = u + dt * (dU * lu - u * u * u + u - v)
            V2[i] = v + dt * (dV * lv + eps * (u - b * v + a))
          }
        }
        U.set(U2)
        V.set(V2)
      }

      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
          continue
        }
        const v = Math.max(0, Math.min(1, (U[i] + 2) / 4))
        const [r, g, b] = rampRGB(v)
        img.data[j]     = r
        img.data[j + 1] = g
        img.data[j + 2] = b
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
