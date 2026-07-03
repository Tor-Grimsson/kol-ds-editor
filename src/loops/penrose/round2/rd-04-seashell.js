// Meinhardt Sea-Shell Growth-Front Model.
// 1D RD (activator-inhibitor) run scanline-by-scanline through the glyph,
// each row's output feeding the next as initial condition.
// Produces diagonal stripes, chevrons, and zigzag patterns — like woodcut engraving.
// Reference: Meinhardt "The Algorithmic Beauty of Sea Shells" (Springer, 2009).



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80,   max: 220, default: 180,  step: 20,   label: 'grid' },
  { key: 'dA',    type: 'range', min: 0.0,  max: 0.2, default: 0.02, step: 0.005, label: 'diffA' },
  { key: 'dB',    type: 'range', min: 0.1,  max: 2.0, default: 0.4,  step: 0.05, label: 'diffB' },
  { key: 'c',     type: 'range', min: 0.01, max: 0.2, default: 0.06, step: 0.005, label: 'autocatalysis c' },
  { key: 'mu',    type: 'range', min: 0.01, max: 0.2, default: 0.06, step: 0.005, label: 'decay mu' },
  { key: 'speed', type: 'range', min: 0.2,  max: 4.0, default: 1.0,  step: 0.1,  label: 'scroll speed' },
]

export const r2_rd_04_seashell            = {
  id: 'r2-rd-04-seashell',
  name: 'SEASHELL GROWTH FRONT',
  repo: 'Meinhardt 1995 — Algorithmic Beauty of Sea Shells',
  summary: 'Scanline-cascaded 1D RD generates diagonal stripes, chevrons, and zigzags filling the glyph like a woodcut print.',
  helps: 'Orthogonal aesthetic — looks hand-drawn/engraved, nothing like the other RD systems; trivially cheap to compute.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params, clock }) {
    const res   = num(params, 'res',   180)
    const dA    = num(params, 'dA',    0.02)
    const dB    = num(params, 'dB',    0.4)
    const c     = num(params, 'c',     0.06)
    const mu    = num(params, 'mu',    0.06)
    const speed = num(params, 'speed', 1.0)

    const rho0 = 0.001  // small baseline production keeps activator from dying out

    // 2D pixel buffer — we rebuild this every frame from the 1D cascade
    const img = ctx.createImageData(res, res)
    const tmp = document.createElement('canvas')
    tmp.width = res; tmp.height = res
    const tc = tmp.getContext('2d')

    // Mask
    const isIn = new Uint8Array(res * res)
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        isIn[y * res + x] = sdf.sample((x / res) * sdf.w, (y / res) * sdf.h) < 0 ? 1 : 0
      }
    }

    return wrapLoop(() => {
      const t = clock.nowSeconds() * speed
      // Row offset scrolls over time — gives a continuous "growing" animation
      const rowOffset = (t * res * 0.5) | 0

      // Initialise 1D arrays for the first row's state
      const A = new Float32Array(res)
      const B = new Float32Array(res)

      // Seed row 0 with noise, modulated by offset so pattern evolves
      for (let x = 0; x < res; x++) {
        // Use a simple deterministic hash based on x + rowOffset for reproducible-looking noise
        const h = Math.sin(x * 0.37 + rowOffset * 0.19) * 0.5 + 0.5
        A[x] = 0.05 + 0.1 * h
        B[x] = 0.1  + 0.1 * (1 - h)
      }

      const A2 = new Float32Array(res)
      const B2 = new Float32Array(res)

      for (let y = 0; y < res; y++) {
        // 4 forward-Euler steps per scanline row
        for (let it = 0; it < 4; it++) {
          for (let x = 0; x < res; x++) {
            const l = x > 0       ? A[x - 1] : A[x]
            const r = x < res - 1 ? A[x + 1] : A[x]
            const lapA = l + r - 2 * A[x]

            const lb = x > 0       ? B[x - 1] : B[x]
            const rb = x < res - 1 ? B[x + 1] : B[x]
            const lapB = lb + rb - 2 * B[x]

            const a = Math.max(0, A[x])
            const bv = Math.max(1e-9, B[x])
            const autocatA = c * a * a / bv
            // dA/dt = dA∇²A + autocatA − mu*A + rho0
            A2[x] = a + dA * lapA + autocatA - mu * a + rho0
            // dB/dt = dB∇²B + autocatA − mu*B
            B2[x] = bv + dB * lapB + autocatA - mu * bv
          }
          A.set(A2)
          B.set(B2)
        }

        // Write row to pixel buffer
        for (let x = 0; x < res; x++) {
          const i = y * res + x
          const j = i * 4
          if (!isIn[i]) {
            const [bgR, bgG, bgB] = roleRGB('bg')
            img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255
            continue
          }
          const v = Math.max(0, Math.min(1, A[x] * 4))
          const [r, g, b] = rampRGB(v)
          img.data[j]     = r
          img.data[j + 1] = g
          img.data[j + 2] = b
          img.data[j + 3] = 255
        }
      }

      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
