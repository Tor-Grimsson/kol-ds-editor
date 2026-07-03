// Lenia — continuous cellular automaton with bell-curve kernel.
// Orbium-like solitons travel inside the glyph boundary.
// Bert Chan (2018) arXiv:1812.05433



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,   max: 200, default: 128, step: 16, label: 'grid res' },
  { key: 'R',     type: 'int',   min: 5,    max: 18,  default: 12,           label: 'kernel radius' },
  { key: 'mu',    type: 'range', min: 0.1,  max: 0.5, default: 0.15, step: 0.005, label: 'growth mean' },
  { key: 'sigma', type: 'range', min: 0.01, max: 0.12, default: 0.017, step: 0.001, label: 'growth sigma' },
  { key: 'dt',    type: 'range', min: 0.05, max: 0.5,  default: 0.15, step: 0.01,  label: 'timestep' },
]

export const r2_ca_01_lenia            = {
  id: 'r2-ca-01-lenia',
  name: 'LENIA',
  repo: 'Bert Chan 2018 · arXiv:1812.05433',
  summary: 'Continuous cellular automaton with Gaussian shell kernel and bell-curve growth function producing stable Orbium-like solitons.',
  helps: 'Self-moving gliders trapped inside the glyph — literal living forms orbiting the letterform interior.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const G = num(params, 'res', 128)
    const R = num(params, 'R', 12)
    const mu = num(params, 'mu', 0.15)
    const sigma = num(params, 'sigma', 0.017)
    const dt = num(params, 'dt', 0.15)

    // Precompute SDF mask at grid resolution
    const isIn = new Uint8Array(G * G)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        isIn[y * G + x] = sdf.sample((x / G) * sdf.w, (y / G) * sdf.h) < 0 ? 1 : 0
      }
    }

    // Lenia kernel: Gaussian shell at r=0.5 (normalized radius)
    const kw = 2 * R + 1
    const kernel = new Float32Array(kw * kw)
    let ksum = 0
    for (let ky = -R; ky <= R; ky++) {
      for (let kx = -R; kx <= R; kx++) {
        const r = Math.hypot(kx, ky) / R
        if (r > 1) continue
        const v = Math.exp(-((r - 0.5) ** 2) / (2 * 0.15 ** 2))
        kernel[(ky + R) * kw + (kx + R)] = v
        ksum += v
      }
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= ksum

    // Growth function: 2*exp(-((u-mu)/sigma)^2 / 2) - 1
    function growth(u        )         {
      const d = (u - mu) / sigma
      return 2 * Math.exp(-(d * d) * 0.5) - 1
    }

    // Seed: scatter blobs of Orbium-like size inside the glyph
    const A = new Float32Array(G * G)
    for (let i = 0; i < 6; i++) {
      let sx        , sy        , tries = 0
      do {
        sx = (rng() * G) | 0
        sy = (rng() * G) | 0
        tries++
      } while (!isIn[sy * G + sx] && tries < 200)
      const blobR = Math.max(3, R * 0.7) | 0
      for (let dy = -blobR; dy <= blobR; dy++) {
        for (let dx = -blobR; dx <= blobR; dx++) {
          const nx = sx + dx, ny = sy + dy
          if (nx < 0 || nx >= G || ny < 0 || ny >= G) continue
          if (!isIn[ny * G + nx]) continue
          const r = Math.hypot(dx, dy) / blobR
          A[ny * G + nx] = Math.max(A[ny * G + nx], Math.exp(-(r * r) / 0.3))
        }
      }
    }

    const U = new Float32Array(G * G)
    const img = ctx.createImageData(G, G)
    const offCanvas = document.createElement('canvas')
    offCanvas.width = G; offCanvas.height = G
    const offCtx = offCanvas.getContext('2d')

    return wrapLoop(() => {
      // Convolution: U = K * A
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          if (!isIn[y * G + x]) { U[y * G + x] = 0; continue }
          let acc = 0
          for (let ky = -R; ky <= R; ky++) {
            const ny = y + ky
            if (ny < 0 || ny >= G) continue
            for (let kx = -R; kx <= R; kx++) {
              const nx = x + kx
              if (nx < 0 || nx >= G) continue
              acc += kernel[(ky + R) * kw + (kx + R)] * A[ny * G + nx]
            }
          }
          U[y * G + x] = acc
        }
      }

      // Update A
      for (let i = 0; i < G * G; i++) {
        if (!isIn[i]) { A[i] = 0; continue }
        A[i] = Math.max(0, Math.min(1, A[i] + dt * growth(U[i])))
      }

      // Render
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
