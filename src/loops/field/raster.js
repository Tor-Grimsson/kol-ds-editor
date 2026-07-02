import { lerp } from '../lib/util.js'

// Shared rasterizer for continuous field loops: fill a buffer via a per-sample
// colour fn, then upscale to the canvas. The buffer resolution ADAPTS to the
// display width (capped) so the field is sampled near 1:1 — no more 10× upscale
// pixelation — while big exports stay bounded in cost. Seamlessness is the field
// fn's job (periodic phase). One shared buffer; only one loop renders at a time.

const CAP = 1000 // max buffer short-/long-edge — crisp on-screen, sane export cost

let buf = null
let bctx = null
let img = null
let key = ''

function ensure(rw, rh) {
  const k = `${rw}x${rh}`
  if (key === k) return
  buf = document.createElement('canvas')
  buf.width = rw
  buf.height = rh
  bctx = buf.getContext('2d')
  img = bctx.createImageData(rw, rh)
  key = k
}

// colorAt(i, j, W, H) → [r, g, b] (0–255). W/H are the buffer dims; sample in
// SCREEN space via (i/W)*w so the look is resolution-independent.
export function raster(ctx, w, h, colorAt) {
  const rw = Math.max(64, Math.min(CAP, Math.round(w)))
  const rh = Math.max(1, Math.round((rw * h) / w))
  ensure(rw, rh)
  const data = img.data
  for (let j = 0; j < rh; j++) {
    for (let i = 0; i < rw; i++) {
      const c = colorAt(i, j, rw, rh)
      const idx = (j * rw + i) * 4
      data[idx] = c[0]
      data[idx + 1] = c[1]
      data[idx + 2] = c[2]
      data[idx + 3] = 255
    }
  }
  bctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(buf, 0, 0, w, h)
}

// [r,g,b] ramp helpers (operate on rgb arrays, return an rgb array).
export const mix2 = (f, A, B) => [lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f)]
export const mix3 = (f, A, B, C) => (f < 0.5 ? mix2(f * 2, A, B) : mix2((f - 0.5) * 2, B, C))
