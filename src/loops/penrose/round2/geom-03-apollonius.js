

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'N',       type: 'int',   min: 4,   max: 24,  default: 8,   step: 1,    label: 'sources' },
  { key: 'waveSpd', type: 'range', min: 0.1, max: 3,   default: 0.8, step: 0.05, label: 'wave speed' },
  { key: 'wOffset', type: 'range', min: 0,   max: 60,  default: 20,  step: 2,    label: 'weight offset' },
  { key: 'blur',    type: 'range', min: 0,   max: 4,   default: 1,   step: 0.5,  label: 'edge softness' },
]

// Apollonius diagram (additively-weighted Voronoi) — raster CPU approach.
// Cell boundary between i and j is the hyperbola |x−cᵢ|−wᵢ = |x−cⱼ|−wⱼ.
// We rasterize by computing argmin of (|x−cᵢ|−wᵢ) per pixel at reduced
// resolution, then upscale with putImageData to canvas size.
export const r2_geom_03_apollonius            = {
  id: 'r2-geom-03-apollonius',
  name: 'APOLLONIUS DIAGRAM',
  repo: 'raster CPU · additively-weighted Voronoi',
  summary: 'Multi-source wavefront competition inside the glyph. Each seed ignites at a different time; expanding circular wavefronts compete for territory. Cell boundaries are curved hyperbolas/parabolas — distinctly non-Euclidean texture.',
  helps: 'Most visually exotic of the Voronoi family: curved boundaries, competitive territorial dynamics, maps directly to wave propagation physics.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const N = Math.min(num(params, 'N', 8), 24)
    const sites                     = []
    const ignitions           = []   // time offset per source
    for (let i = 0; i < N; i++) {
      sites.push(sampleInside(sdf, rng))
      ignitions.push(rng() * 4)      // stagger ignition 0–4 s
    }

    // Render at reduced resolution for performance
    const SCALE = 4
    const rw = Math.ceil(sdf.w / SCALE)
    const rh = Math.ceil(sdf.h / SCALE)
    const imgData = ctx.createImageData(W, H)

    // Palette: hue per source
    const hues = sites.map((_, i) => Math.round((i / N) * 360))

    function hslToRgb(h        , s        , l        )                           {
      h /= 360; s /= 100; l /= 100
      const k = (n        ) => (n + h * 12) % 12
      const a = s * Math.min(l, 1 - l)
      const f = (n        ) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
      return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
    }

    return wrapLoop(() => {
      const t      = clock.nowSeconds()
      const wspd   = num(params, 'waveSpd', 0.8)
      const woff   = num(params, 'wOffset', 20)

      // Weights grow over time: wᵢ(t) = speed * (t − ignitions[i])
      const weights = ignitions.map((ig) => Math.max(0, (t - ig) * wspd * sdf.w * 0.12 + woff))

      // Rasterise at low res
      const pixels = new Uint8ClampedArray(rw * rh * 4)
      for (let ry = 0; ry < rh; ry++) {
        for (let rx = 0; rx < rw; rx++) {
          const wx = rx * SCALE + SCALE / 2
          const wy = ry * SCALE + SCALE / 2
          if (sdf.sample(wx, wy) >= 0) {
            // outside mask — transparent
            const pi = (ry * rw + rx) * 4
            pixels[pi + 3] = 0
            continue
          }
          let bestDist = Infinity, bestI = 0
          for (let i = 0; i < N; i++) {
            const [cx, cy] = sites[i]
            const d = Math.hypot(wx - cx, wy - cy) - weights[i]
            if (d < bestDist) { bestDist = d; bestI = i }
          }
          const pi = (ry * rw + rx) * 4
          const [r, g, b] = hslToRgb(hues[bestI], 55, 38)
          pixels[pi]     = r
          pixels[pi + 1] = g
          pixels[pi + 2] = b
          pixels[pi + 3] = 200
        }
      }

      // Scale up to full canvas with nearest-neighbour
      const d = imgData.data
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const rx = Math.min(rw - 1, Math.floor(x / sx / SCALE))
          const ry = Math.min(rh - 1, Math.floor(y / sy / SCALE))
          const src = (ry * rw + rx) * 4
          const dst = (y * W + x) * 4
          d[dst]     = pixels[src]
          d[dst + 1] = pixels[src + 1]
          d[dst + 2] = pixels[src + 2]
          d[dst + 3] = pixels[src + 3]
        }
      }

      clear(ctx, W, H)
      ctx.putImageData(imgData, 0, 0)
      strokeOutline(ctx, sdf, W, H)

      // Source dots
      for (let i = 0; i < N; i++) {
        const [x, y] = sites[i]
        ctx.beginPath()
        ctx.arc(x * sx, y * sy, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `hsl(${hues[i]},80%,75%)`
        ctx.fill()
      }
    })
  },
}
