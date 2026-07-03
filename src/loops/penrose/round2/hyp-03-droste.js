

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Hyperbolic Droste / logarithmic spiral conformal warp.
// Map: z → exp(c * (log(z) + t)) where c = (2πi + log(k)) / 2πi
// Creates a self-similar infinite zoom spiral. Each frame advances t → continuous zoom.
// Texture source: draw the glyph outline + radial stripes, then warp it.

const PARAMS          = [
  { key: 'zoom', type: 'range', min: 0.3, max: 3.0, default: 1.0, step: 0.05, label: 'zoom speed' },
  { key: 'scale', type: 'range', min: 1.1, max: 4.0, default: 2.0, step: 0.05, label: 'scale factor k' },
  { key: 'twist', type: 'range', min: -1, max: 1, default: 0.25, step: 0.025, label: 'twist' },
  { key: 'bands', type: 'int', min: 2, max: 16, default: 6, label: 'radial bands' },
  { key: 'cx', type: 'range', min: -0.5, max: 0.5, default: 0.0, step: 0.01, label: 'center x' },
  { key: 'cy', type: 'range', min: -0.5, max: 0.5, default: 0.0, step: 0.01, label: 'center y' },
]

export const r2_hyp_03_droste            = {
  id: 'r2-hyp-03-droste',
  name: 'HYPERBOLIC DROSTE SPIRAL',
  repo: 'Conformal map · log-exp · Escher Print Gallery',
  summary:
    'Logarithmic conformal spiral map (exp(c·log(z)+t)) creates infinite zoom with exact self-similarity. Time parameter advances the zoom phase continuously — the glyph interior flows inward forever.',
  helps: 'Maximum zoom payoff: every frame reveals a new scale of structure with no repetition.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const zoomSpd = num(params, 'zoom', 1.0)
      const k = Math.max(1.01, num(params, 'scale', 2.0))
      const twist = num(params, 'twist', 0.25)
      const bands = Math.round(num(params, 'bands', 6))
      const ocx = num(params, 'cx', 0.0)
      const ocy = num(params, 'cy', 0.0)

      // c = (2πi + log(k)) / 2π  ... the Droste constant
      const logk = Math.log(k)
      // c complex: cx_c = logk/(2π), cy_c = 1 + twist
      const c_re = logk / (2 * Math.PI)
      const c_im = 1 + twist

      // Time drives log-domain offset → continuous zoom
      const tOffset = t * zoomSpd * logk / (2 * Math.PI)

      clear(ctx, W, H)

      const idata = ctx.createImageData(W, H)
      const d = idata.data

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          if (sdf.sample(px / sx, py / sy) >= 0) continue

          // Map to complex plane centered at (ocx, ocy)
          let zx = (px / W) * 2 - 1 - ocx
          let zy = (py / H) * 2 - 1 - ocy

          const r2 = zx * zx + zy * zy
          if (r2 < 1e-8) continue

          // log(z)
          const logR = 0.5 * Math.log(r2)
          const argZ = Math.atan2(zy, zx)

          // c * log(z) + time offset
          // c * (logR + i*argZ) = (c_re*logR - c_im*argZ) + i*(c_re*argZ + c_im*logR)
          const wre = c_re * logR - c_im * argZ + tOffset
          const wim = c_re * argZ + c_im * logR

          // exp(w)
          const expR = Math.exp(wre)
          const sampX = expR * Math.cos(wim)
          const sampY = expR * Math.sin(wim)

          // Sample a procedural radial stripe texture
          const texAngle = Math.atan2(sampY, sampX)
          const texR = Math.sqrt(sampX * sampX + sampY * sampY)

          // Bands pattern: alternate by angle + log-radius
          const bandVal = (texAngle / Math.PI + 1) * bands * 0.5 + Math.log(Math.max(1e-4, texR)) * 1.5
          const stripe = (bandVal % 1 + 1) % 1
          // Distance fade within glyph
          const sdfDist = sdf.sample(px / sx, py / sy)
          const gFade = Math.max(0, Math.min(1, -sdfDist / 20))

          const hue = (texAngle / (Math.PI * 2) + 0.5 + t * 0.03) % 1
          // HSL-ish: pick two complementary colors
          const bright = 0.4 + 0.6 * (stripe < 0.5 ? stripe * 2 : (1 - stripe) * 2)
          const r = Math.sin(hue * Math.PI * 2) * 0.5 + 0.5
          const g = Math.sin(hue * Math.PI * 2 + 2.094) * 0.5 + 0.5
          const b = Math.sin(hue * Math.PI * 2 + 4.189) * 0.5 + 0.5

          const idx = (py * W + px) * 4
          d[idx]     = r * bright * gFade * 255
          d[idx + 1] = g * bright * gFade * 255
          d[idx + 2] = b * bright * gFade * 255
          d[idx + 3] = 255
        }
      }

      ctx.putImageData(idata, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
