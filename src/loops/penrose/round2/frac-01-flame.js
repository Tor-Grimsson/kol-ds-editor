

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB } from '../common.js'

const PARAMS          = [
  { key: 'iters', type: 'int', min: 5000, max: 60000, default: 20000, step: 2500, label: 'iterations' },
  { key: 'drift', type: 'range', min: 0, max: 1, default: 0.25, step: 0.05, label: 'param drift' },
  { key: 'gamma', type: 'range', min: 0.2, max: 1.0, default: 0.45, step: 0.05, label: 'gamma' },
  { key: 'palette', type: 'select', options: ['warm', 'cool', 'ember'], default: 'warm' },
]

// Scott Draves nonlinear variations: sinusoidal, spherical, swirl
function sinusoidal(x        , y        )                   {
  return [Math.sin(x), Math.sin(y)]
}
function spherical(x        , y        )                   {
  const r2 = x * x + y * y + 1e-9
  return [x / r2, y / r2]
}
function swirl(x        , y        )                   {
  const r2 = x * x + y * y
  return [x * Math.sin(r2) - y * Math.cos(r2), x * Math.cos(r2) + y * Math.sin(r2)]
}
const VARS = [sinusoidal, spherical, swirl]

function palettePx(v        , p        )                           {
  const t = v
  if (p === 'cool') return [
    Math.floor(40 + 60 * t),
    Math.floor(100 + 120 * t),
    Math.floor(180 + 75 * t),
  ]
  if (p === 'ember') return [
    Math.floor(220 + 35 * t),
    Math.floor(80 * t * t),
    Math.floor(10 * t),
  ]
  // warm default
  return [
    Math.floor(255 * Math.min(1, t * 1.6)),
    Math.floor(200 * t * t),
    Math.floor(80 * t * t * t),
  ]
}

export const r2_frac_01_flame            = {
  id: 'r2-frac-01-flame',
  name: 'FLAME FRACTAL',
  repo: 'Scott Draves 1992 — flam3.com/flame_draves.pdf',
  summary: 'IFS with nonlinear variations (sinusoidal, spherical, swirl) rendered via log-density histogram. Affine map angles drift over time producing living, breathing filaments.',
  helps: 'Cross-scale fractal detail — zoom into any tendril and sub-tendrils appear. Log-density tone map reveals filament structure only inside the glyph.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    // 5 affine maps: [a,b,c,d,e,f] = ax+by+c, dx+ey+f; variation index; color hue; base prob
    const N = 5
    const baseA = Array.from({ length: N }, () => [
      (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.6,
      (rng() - 0.5) * 0.5, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.6,
    ])
    const varIdx = Array.from({ length: N }, (_, i) => i % VARS.length)
    const mapHue = Array.from({ length: N }, (_, i) => i / N)

    // log-density histogram
    const RES = 160
    const hist = new Float32Array(RES * RES * 2) // [freq, color] interleaved

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const drift = num(params, 'drift', 0.25)
      const iters = num(params, 'iters', 20000)
      const gamma = num(params, 'gamma', 0.45)
      const palette = String(params['palette'] ?? 'warm')

      // build drifted maps
      const maps = baseA.map((m, i) => {
        const angle = drift * Math.sin(t * 0.3 + i * 1.4)
        const ca = Math.cos(angle), sa = Math.sin(angle)
        return [
          m[0] * ca - m[3] * sa, m[1] * ca - m[4] * sa, m[2],
          m[0] * sa + m[3] * ca, m[1] * sa + m[4] * ca, m[5],
        ]
      })

      // chaos game
      hist.fill(0)
      const cx = RES / 2, cy = RES / 2
      const scaleIn = RES * 0.22
      let px = rng() * 2 - 1, py = rng() * 2 - 1, col = rng()

      for (let i = 0; i < iters; i++) {
        const mi = Math.floor(rng() * N)
        const m = maps[mi]
        let nx = m[0] * px + m[1] * py + m[2]
        let ny = m[3] * px + m[4] * py + m[5]
        const [vx, vy] = VARS[varIdx[mi]](nx, ny)
        nx = vx; ny = vy
        col = (col + mapHue[mi]) * 0.5
        px = nx; py = ny

        const sx = Math.round(cx + nx * scaleIn)
        const sy = Math.round(cy + ny * scaleIn)
        if (sx < 0 || sx >= RES || sy < 0 || sy >= RES) continue

        // SDF check: map hist pixel to canvas coords
        const wx = (sx / RES) * sdf.w
        const wy = (sy / RES) * sdf.h
        if (sdf.sample(wx, wy) >= 0) continue

        const idx = (sy * RES + sx) * 2
        hist[idx] += 1
        hist[idx + 1] += col
      }

      // find max freq
      let maxFreq = 1
      for (let i = 0; i < RES * RES; i++) if (hist[i * 2] > maxFreq) maxFreq = hist[i * 2]
      const logMax = Math.log(maxFreq + 1)

      const img = ctx.createImageData(RES, RES)
      for (let i = 0; i < RES * RES; i++) {
        const freq = hist[i * 2]
        if (freq < 1) continue
        const alpha = Math.pow(Math.log(freq + 1) / logMax, gamma)
        const [r, g, b] = rampRGB(alpha)
        img.data[i * 4] = r
        img.data[i * 4 + 1] = g
        img.data[i * 4 + 2] = b
        img.data[i * 4 + 3] = Math.floor(alpha * 255)
      }

      clear(ctx, W, H)
      // scale up from RES to canvas
      const tmp = document.createElement('canvas')
      tmp.width = RES; tmp.height = RES
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
