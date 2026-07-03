
import { clear, wrapLoop, rampRGB, roleRGB } from '../common.js'

// Gray-Scott reaction-diffusion on a 220×220 grid (one-dim per channel).
// Mask limits the reactive region to SDF<0. Rendered via an ImageData put
// scaled into the canvas.
//
// Reference: jasonwebb/reaction-diffusion-playground ·
// https://karlsims.com/rd.html (Karl Sims) · mrob.com/pub/comp/xmorphia (Mrob)
export const reactionDiff            = {
  id: '10-reaction-diffusion',
  name: 'REACTION-DIFFUSION (GRAY-SCOTT)',
  repo: 'jasonwebb/reaction-diffusion-playground',
  summary:
    'Gray-Scott partial-differential equations solved on a coarse grid, masked by the SDF. Produces coral / zebra / spots / leopard depending on feed/kill rates. Slower iteration than vector algos; here CPU-bound at ~30fps, fine for demo. A pixel pattern layer instead of vector.',
  helps:
    'The odd one out — raster, not vector. Shows what off-brief looks like. Probably not the fit for this project, but worth seeing the comparison.',
  params: [
    { key: 'feed', type: 'range', min: 0.01, max: 0.1, step: 0.001, default: 0.055, label: 'feed' },
    { key: 'kill', type: 'range', min: 0.04, max: 0.08, step: 0.001, default: 0.062, label: 'kill' },
    { key: 'dA', type: 'range', min: 0.2, max: 1.5, step: 0.05, default: 1.0, label: 'diffuse a' },
    { key: 'dB', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5, label: 'diffuse b' },
    { key: 'iter', type: 'int', min: 1, max: 8, default: 2, label: 'iterations' },
    { key: 'seeds', type: 'int', min: 1, max: 80, default: 20, label: 'seeds' },
  ],
  init({ ctx, sdf, W, H, params }) {
    const { feed, kill, dA, dB, iter, seeds } = params
    const GRID = 220
    const A = new Float32Array(GRID * GRID)
    const B = new Float32Array(GRID * GRID)
    const A2 = new Float32Array(GRID * GRID)
    const B2 = new Float32Array(GRID * GRID)
    const isIn = new Uint8Array(GRID * GRID)
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const sx = (x / GRID) * sdf.w
        const sy = (y / GRID) * sdf.h
        isIn[y * GRID + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
        A[y * GRID + x] = 1
      }
    }
    // seed with a few random spots inside
    for (let i = 0; i < seeds; i++) {
      const x = (Math.random() * GRID) | 0
      const y = (Math.random() * GRID) | 0
      if (!isIn[y * GRID + x]) continue
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || xx >= GRID || yy < 0 || yy >= GRID) continue
          if (!isIn[yy * GRID + xx]) continue
          B[yy * GRID + xx] = 1
        }
      }
    }

    const dt = 1

    const img = ctx.createImageData(GRID, GRID)

    const laplace = (buf              , x        , y        , i        )         => {
      const l = x > 0 ? buf[i - 1] : buf[i]
      const r = x < GRID - 1 ? buf[i + 1] : buf[i]
      const u = y > 0 ? buf[i - GRID] : buf[i]
      const d = y < GRID - 1 ? buf[i + GRID] : buf[i]
      return l + r + u + d - 4 * buf[i]
    }

    return wrapLoop(() => {
      // iterations per frame
      for (let it = 0; it < iter; it++) {
        for (let y = 1; y < GRID - 1; y++) {
          for (let x = 1; x < GRID - 1; x++) {
            const i = y * GRID + x
            if (!isIn[i]) { A2[i] = A[i]; B2[i] = B[i]; continue }
            const a = A[i], b = B[i]
            const ab2 = a * b * b
            A2[i] = a + (dA * laplace(A, x, y, i) - ab2 + feed * (1 - a)) * dt
            B2[i] = b + (dB * laplace(B, x, y, i) + ab2 - (kill + feed) * b) * dt
          }
        }
        A.set(A2)
        B.set(B2)
      }

      // render via ImageData scaled
      const [bgR, bgG, bgB] = roleRGB('bg')
      for (let i = 0; i < GRID * GRID; i++) {
        const j = i * 4
        if (!isIn[i]) { img.data[j] = bgR; img.data[j + 1] = bgG; img.data[j + 2] = bgB; img.data[j + 3] = 255; continue }
        const v = Math.max(0, Math.min(1, A[i] - B[i]))
        const [r, g, b] = rampRGB(v)
        img.data[j] = r
        img.data[j + 1] = g
        img.data[j + 2] = b
        img.data[j + 3] = 255
      }
      clear(ctx, W, H)
      const tmp = document.createElement('canvas')
      tmp.width = GRID; tmp.height = GRID
      tmp.getContext('2d') .putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
    })
  },
}
