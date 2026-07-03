

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Aizawa attractor — 6-parameter 3D system, toroidal structure.
// Projected via slow-precessing camera; trail shows orbital ring.
// Ref: https://www.algosome.com/articles/aizawa-attractor-chaos.html

const PARAMS          = [
  { key: 'a', type: 'range', min: 0.7, max: 1.2, default: 0.95, step: 0.01 },
  { key: 'b', type: 'range', min: 0.4, max: 1.0, default: 0.7, step: 0.01 },
  { key: 'c', type: 'range', min: 0.3, max: 0.9, default: 0.6, step: 0.01, label: 'c (tube)' },
  { key: 'dt', type: 'range', min: 0.005, max: 0.04, default: 0.01, step: 0.002, label: 'step dt' },
  { key: 'tail', type: 'int', min: 200, max: 4000, default: 2000, label: 'tail length' },
]

function rk4Aizawa(
  x        , y        , z        ,
  a        , b        , c        , dt        ,
)                           {
  const d = 3.5, e = 0.25, f = 0.1
  const F = (x        , y        , z        )                           => [
    (z - b) * x - d * y,
    d * x + (z - b) * y,
    c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x,
  ]
  const [k1x, k1y, k1z] = F(x, y, z)
  const [k2x, k2y, k2z] = F(x + dt/2*k1x, y + dt/2*k1y, z + dt/2*k1z)
  const [k3x, k3y, k3z] = F(x + dt/2*k2x, y + dt/2*k2y, z + dt/2*k2z)
  const [k4x, k4y, k4z] = F(x + dt*k3x, y + dt*k3y, z + dt*k3z)
  return [
    x + dt/6*(k1x+2*k2x+2*k3x+k4x),
    y + dt/6*(k1y+2*k2y+2*k3y+k4y),
    z + dt/6*(k1z+2*k2z+2*k3z+k4z),
  ]
}

export const r2_attr_02_aizawa            = {
  id: 'r2-attr-02-aizawa',
  name: 'AIZAWA TRAIL',
  repo: 'Aizawa · algosome.com/articles/aizawa-attractor-chaos.html',
  summary: '3D Aizawa toroidal attractor integrated via RK4; projected with a slowly precessing camera angle to reveal the spinning ring structure.',
  helps: 'The precessing torus orbit is the most sculptural animated motion in this set — fills letterform interiors naturally.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const maxTail = 4000
    const xs = new Float32Array(maxTail)
    const ys = new Float32Array(maxTail)
    const zs = new Float32Array(maxTail)
    let head = 0, len = 0
    let cx = 0.1 + rng() * 0.05
    let cy = rng() * 0.05
    let cz = rng() * 0.05
    // Warm up
    for (let i = 0; i < 1000; i++) [cx, cy, cz] = rk4Aizawa(cx, cy, cz, 0.95, 0.7, 0.6, 0.01)

    // xy extent ~[-1.5, 1.5]; scale to glyph
    const SC = Math.min(W, H) * 0.36
    const OX = W * 0.5, OY = H * 0.5

    return wrapLoop(() => {
      const a = num(params, 'a', 0.95)
      const b = num(params, 'b', 0.7)
      const c = num(params, 'c', 0.6)
      const dt = num(params, 'dt', 0.01)
      const tail = Math.min(maxTail, num(params, 'tail', 2000))
      const STEPS = 8

      clear(ctx, W, H, 'rgba(10,11,20,0.15)')
      strokeOutline(ctx, sdf, W, H)

      // Precess camera around [1,1,1]-axis slowly
      const t = clock.nowSeconds()
      const camAngle = t * 0.18
      const cosA = Math.cos(camAngle), sinA = Math.sin(camAngle)

      for (let s = 0; s < STEPS; s++) {
        const [nx, ny, nz] = rk4Aizawa(cx, cy, cz, a, b, c, dt)
        cx = nx; cy = ny; cz = nz
        // Rotate around z axis for camera precession
        const rx = nx * cosA - ny * sinA
        const ry = nx * sinA + ny * cosA
        xs[head] = rx; ys[head] = ry; zs[head] = nz
        head = (head + 1) % maxTail
        if (len < maxTail) len++
      }

      // Draw trail
      const drawLen = Math.min(len, tail)
      for (let i = 0; i < drawLen - 1; i++) {
        const age = i / drawLen
        const i0 = (head - 1 - i + maxTail) % maxTail
        const i1 = (head - 2 - i + maxTail) % maxTail
        const px0 = OX + xs[i0] * SC, py0 = OY + ys[i0] * SC
        const px1 = OX + xs[i1] * SC, py1 = OY + ys[i1] * SC
        // z in [-1, 1.5]; depth cue
        const depth = Math.max(0, Math.min(1, (zs[i0] + 1) / 2.5))
        const alpha = (1 - age) * (0.35 + depth * 0.55)
        const lightness = 45 + depth * 35
        ctx.strokeStyle = `hsla(170,85%,${lightness}%,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.6 + depth * 1.0
        ctx.beginPath()
        ctx.moveTo(px0, py0)
        ctx.lineTo(px1, py1)
        ctx.stroke()
      }
    })
  },
}
