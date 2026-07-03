

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB } from '../common.js'

const PARAMS          = [
  { key: 'samples', type: 'int', min: 1000, max: 20000, default: 5000, step: 1000, label: 'samples/frame' },
  { key: 'maxIter', type: 'int', min: 50, max: 800, default: 200, step: 50, label: 'max iter' },
  { key: 'decay', type: 'range', min: 0.90, max: 1.0, default: 0.97, step: 0.01, label: 'trail decay' },
  { key: 'nebula', type: 'boolean', default: true, label: 'nebulabrot (RGB)' },
]

const RES = 150

function runBuddha(
  rng              ,
  sdf                                                                    ,
  samples        ,
  maxIter        ,
  hist              ,
  sampleInGlyph         ,
) {
  const orbit = new Float32Array(maxIter * 2)

  for (let s = 0; s < samples; s++) {
    let cr        , ci
    if (sampleInGlyph) {
      // sample c from inside glyph
      let tries = 0
      do {
        cr = rng() * 3 - 2.2
        ci = rng() * 2.4 - 1.2
        const sx = ((cr + 2.2) / 3) * sdf.w
        const sy = ((ci + 1.2) / 2.4) * sdf.h
        if (sdf.sample(sx, sy) < 0) break
        tries++
      } while (tries < 20)
    } else {
      cr = rng() * 3 - 2.2
      ci = rng() * 2.4 - 1.2
    }

    let zr = 0, zi = 0, n = 0
    let escaped = false
    while (n < maxIter) {
      const zr2 = zr * zr, zi2 = zi * zi
      if (zr2 + zi2 > 4) { escaped = true; break }
      const nzr = zr2 - zi2 + cr
      zi = 2 * zr * zi + ci
      zr = nzr
      orbit[n * 2] = zr
      orbit[n * 2 + 1] = zi
      n++
    }
    if (!escaped) continue

    for (let k = 0; k < n; k++) {
      const ox = orbit[k * 2], oy = orbit[k * 2 + 1]
      const hx = Math.floor(((ox + 2.2) / 3.5) * RES)
      const hy = Math.floor(((oy + 1.75) / 3.5) * RES)
      if (hx < 0 || hx >= RES || hy < 0 || hy >= RES) continue
      hist[hy * RES + hx] += 1
    }
  }
}

export const r2_frac_02_buddhabrot            = {
  id: 'r2-frac-02-buddhabrot',
  name: 'BUDDHABROT',
  repo: 'Melinda Green 1993 — superliminal.com/fractals/bbrot/',
  summary: 'Accumulates escaping Mandelbrot orbit density into a progressive histogram. Nebulabrot mode maps 3 iter-depth histograms to RGB for a cosmic nebula look. Samples drift their c-window over time.',
  helps: 'Progressive density painting coalesces live each frame. Glyph SDF biases c-sampling toward the letterform, concentrating orbit density inside the shape.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const histR = new Float32Array(RES * RES)
    const histG = new Float32Array(RES * RES)
    const histB = new Float32Array(RES * RES)

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const samples = num(params, 'samples', 5000)
      const maxIter = num(params, 'maxIter', 200)
      const decay = num(params, 'decay', 0.97)
      const nebula = params['nebula'] !== false

      // Drift sampling window via time — slowly pans c-plane
      const driftRng = ()         => {
        const base = rng()
        return base + Math.sin(t * 0.08) * 0.15
      }

      // Decay histograms for motion trail
      for (let i = 0; i < RES * RES; i++) {
        histR[i] *= decay
        histG[i] *= decay
        histB[i] *= decay
      }

      if (nebula) {
        runBuddha(driftRng, sdf, Math.floor(samples * 0.5), maxIter, histR, true)
        runBuddha(driftRng, sdf, Math.floor(samples * 0.3), Math.floor(maxIter * 0.1), histG, false)
        runBuddha(driftRng, sdf, Math.floor(samples * 0.2), Math.floor(maxIter * 0.01), histB, false)
      } else {
        runBuddha(driftRng, sdf, samples, maxIter, histR, true)
        for (let i = 0; i < RES * RES; i++) { histG[i] = histR[i] * 0.6; histB[i] = histR[i] * 0.3 }
      }

      let maxR = 1, maxG = 1, maxB = 1
      for (let i = 0; i < RES * RES; i++) {
        if (histR[i] > maxR) maxR = histR[i]
        if (histG[i] > maxG) maxG = histG[i]
        if (histB[i] > maxB) maxB = histB[i]
      }
      const logR = Math.log(maxR + 1), logG = Math.log(maxG + 1), logB = Math.log(maxB + 1)

      const img = ctx.createImageData(RES, RES)
      for (let i = 0; i < RES * RES; i++) {
        const px = i % RES, py = Math.floor(i / RES)
        const wx = (px / RES) * sdf.w, wy = (py / RES) * sdf.h
        if (sdf.sample(wx, wy) >= 0) continue
        const dR = Math.pow(Math.log(histR[i] + 1) / logR, 0.5)
        const dG = Math.pow(Math.log(histG[i] + 1) / logG, 0.5)
        const dB = Math.pow(Math.log(histB[i] + 1) / logB, 0.5)
        const intensity = Math.max(0, Math.min(1, (dR + dG + dB) / 3))
        const [r, g, b] = rampRGB(intensity)
        img.data[i * 4] = r
        img.data[i * 4 + 1] = g
        img.data[i * 4 + 2] = b
        img.data[i * 4 + 3] = Math.min(255, intensity > 0 ? 220 : 0)
      }

      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = RES; tmp.height = RES
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
