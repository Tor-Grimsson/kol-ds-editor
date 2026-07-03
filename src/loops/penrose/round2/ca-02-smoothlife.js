// SmoothLife — Rafler (2011) generalization of Conway Life to continuous domain.
// Disk (inner) and ring (outer) neighborhoods with sigmoid birth/death thresholds.
// Produces smooth translating gliders in arbitrary directions.
// arXiv:1111.1567



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',  type: 'int',   min: 80,  max: 200, default: 128, step: 16, label: 'grid res' },
  { key: 'ri',   type: 'int',   min: 2,   max: 8,   default: 4,             label: 'inner radius' },
  { key: 'ro',   type: 'int',   min: 5,   max: 18,  default: 12,            label: 'outer radius' },
  { key: 'b1',   type: 'range', min: 0.2, max: 0.4, default: 0.278, step: 0.005, label: 'birth low' },
  { key: 'b2',   type: 'range', min: 0.3, max: 0.6, default: 0.365, step: 0.005, label: 'birth high' },
  { key: 'dt',   type: 'range', min: 0.05, max: 0.4, default: 0.1, step: 0.01,   label: 'timestep' },
]

// Sigmoid used by SmoothLife for threshold smoothing
function sigma(x        , a        , alpha = 0.028)         {
  return 1 / (1 + Math.exp(-(x - a) * 4 / alpha))
}
function sigmaN(x        , a        , b        )         {
  return sigma(x, a) * (1 - sigma(x, b))
}
// Transition: s(n, m) using standard SmoothLife params (d1=0.267, d2=0.445)
function transition(n        , m        , b1        , b2        )         {
  const d1 = 0.267, d2 = 0.445
  const alive = sigmaN(m, b1, b2) // birth term
  const dead  = sigmaN(m, d1, d2) // survival term
  const sn = 1 / (1 + Math.exp(-(n - 0.5) * 4 / 0.147))
  return sn * dead + (1 - sn) * alive
}

export const r2_ca_02_smoothlife            = {
  id: 'r2-ca-02-smoothlife',
  name: 'SMOOTHLIFE',
  repo: 'Rafler 2011 · arXiv:1111.1567',
  summary: 'Conway Life generalized to continuous floating-point states using disk/ring neighborhoods and sigmoid birth/death thresholds.',
  helps: 'Smooth translating gliders treat the glyph boundary as a wall — clean orbiting blobs inside letterforms.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G  = num(params, 'res', 128)
    const ri = num(params, 'ri', 4)
    const ro = num(params, 'ro', 12)
    const b1 = num(params, 'b1', 0.278)
    const b2 = num(params, 'b2', 0.365)
    const dt = num(params, 'dt', 0.1)

    const isIn = new Uint8Array(G * G)
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++)
        isIn[y * G + x] = sdf.sample((x / G) * sdf.w, (y / G) * sdf.h) < 0 ? 1 : 0

    // Precompute inner (disk) and outer (ring) kernels
    const kw = 2 * ro + 1
    const kInner = new Float32Array(kw * kw)
    const kOuter = new Float32Array(kw * kw)
    let sumI = 0, sumO = 0
    for (let ky = -ro; ky <= ro; ky++) {
      for (let kx = -ro; kx <= ro; kx++) {
        const r = Math.hypot(kx, ky)
        const ki = kw * (ky + ro) + (kx + ro)
        if (r <= ri) { kInner[ki] = 1; sumI++ }
        else if (r <= ro) { kOuter[ki] = 1; sumO++ }
      }
    }
    for (let i = 0; i < kw * kw; i++) { kInner[i] /= sumI; kOuter[i] /= sumO }

    // Seed random noise inside glyph
    const A = new Float32Array(G * G)
    for (let i = 0; i < G * G; i++)
      if (isIn[i]) A[i] = rng() < 0.4 ? rng() : 0

    const nInner = new Float32Array(G * G)
    const nOuter = new Float32Array(G * G)
    const img = ctx.createImageData(G, G)
    const offCanvas = document.createElement('canvas')
    offCanvas.width = G; offCanvas.height = G
    const offCtx = offCanvas.getContext('2d')

    return wrapLoop(() => {
      // Convolve inner & outer separately
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!isIn[i]) { nInner[i] = 0; nOuter[i] = 0; continue }
          let accI = 0, accO = 0
          for (let ky = -ro; ky <= ro; ky++) {
            const ny = y + ky; if (ny < 0 || ny >= G) continue
            for (let kx = -ro; kx <= ro; kx++) {
              const nx = x + kx; if (nx < 0 || nx >= G) continue
              const ki = (ky + ro) * kw + (kx + ro)
              const val = A[ny * G + nx]
              accI += kInner[ki] * val
              accO += kOuter[ki] * val
            }
          }
          nInner[i] = accI
          nOuter[i] = accO
        }
      }

      // Update: SmoothLife transition clamped to [0,1]
      for (let i = 0; i < G * G; i++) {
        if (!isIn[i]) { A[i] = 0; continue }
        const s = transition(nInner[i], nOuter[i], b1, b2)
        A[i] = Math.max(0, Math.min(1, A[i] + dt * (2 * s - 1)))
      }

      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < G * G; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
          continue
        }
        const v = Math.max(0, Math.min(1, A[i]))
        const [r, g, b] = rampRGB(v)
        img.data[j]     = r
        img.data[j + 1] = g
        img.data[j + 2] = b
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      offCtx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(offCanvas, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
