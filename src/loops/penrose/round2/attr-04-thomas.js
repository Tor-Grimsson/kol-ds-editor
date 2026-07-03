

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Thomas' Cyclically Symmetric Attractor (René Thomas, 1999).
// 3-fold symmetric; projected down [1,1,1] axis + slow orbit rotation.
// Ref: https://medium.com/@rh.h.rad/thomas-attractor-exploring-the-beauty-of-chaotic-dynamics

const PARAMS          = [
  { key: 'b', type: 'range', min: 0.10, max: 0.25, default: 0.19, step: 0.002, label: 'b (dissip)' },
  { key: 'dt', type: 'range', min: 0.01, max: 0.1, default: 0.05, step: 0.005, label: 'step dt' },
  { key: 'trails', type: 'int', min: 1, max: 6, default: 3, label: 'trail count' },
  { key: 'tail', type: 'int', min: 200, max: 4000, default: 1500, label: 'tail length' },
  { key: 'spin', type: 'range', min: 0, max: 0.5, default: 0.08, step: 0.01, label: 'cam spin' },
]

function rk4Thomas(x        , y        , z        , b        , dt        )                           {
  const F = (x        , y        , z        )                           => [
    Math.sin(y) - b * x,
    Math.sin(z) - b * y,
    Math.sin(x) - b * z,
  ]
  const [k1x, k1y, k1z] = F(x, y, z)
  const [k2x, k2y, k2z] = F(x+dt/2*k1x, y+dt/2*k1y, z+dt/2*k1z)
  const [k3x, k3y, k3z] = F(x+dt/2*k2x, y+dt/2*k2y, z+dt/2*k2z)
  const [k4x, k4y, k4z] = F(x+dt*k3x, y+dt*k3y, z+dt*k3z)
  return [
    x + dt/6*(k1x+2*k2x+2*k3x+k4x),
    y + dt/6*(k1y+2*k2y+2*k3y+k4y),
    z + dt/6*(k1z+2*k2z+2*k3z+k4z),
  ]
}

// Orthographic project onto plane perpendicular to [1,1,1]
// Two basis vectors in that plane: u=[1,-1,0]/√2, v=[1,1,-2]/√6
const U = [1/Math.SQRT2, -1/Math.SQRT2, 0]
const V = [1/Math.sqrt(6), 1/Math.sqrt(6), -2/Math.sqrt(6)]

function project(x        , y        , z        , angle        )                   {
  const pu = x*U[0] + y*U[1] + z*U[2]
  const pv = x*V[0] + y*V[1] + z*V[2]
  // rotate in projected plane
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return [pu*cos - pv*sin, pu*sin + pv*cos]
}

export const r2_attr_04_thomas            = {
  id: 'r2-attr-04-thomas',
  name: 'THOMAS CYCLIC',
  repo: 'Thomas 1999 · dynamicmath.xyz/strange-attractors',
  summary: '3D Thomas cyclically symmetric attractor; RK4-integrated trails projected onto the [1,1,1] perpendicular plane with slow camera precession revealing 3-fold symmetry.',
  helps: 'The 3-lobe rotation is visually interpretable as a spinning object — clean rhythmic motion for the letterform.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const maxTail = 4000
    const maxTrails = 6
    const bufs = Array.from({ length: maxTrails }, (_, i) => ({
      pxs: new Float32Array(maxTail),
      pys: new Float32Array(maxTail),
      zs: new Float32Array(maxTail), // depth
      head: 0, len: 0,
      cx: 0.1 + (i - maxTrails/2) * 0.12,
      cy: (i - maxTrails/2) * 0.08,
      cz: 0.05 * i,
    }))
    // Warm up all trails
    for (const tr of bufs) {
      let [x, y, z] = [tr.cx, tr.cy, tr.cz]
      for (let i = 0; i < 800; i++) [x, y, z] = rk4Thomas(x, y, z, 0.19, 0.05)
      tr.cx = x; tr.cy = y; tr.cz = z
    }

    // Thomas extent roughly [-4, 4]; scale to glyph
    const SC = Math.min(W, H) * 0.115
    const OX = W * 0.5, OY = H * 0.5

    return wrapLoop(() => {
      const b = num(params, 'b', 0.19)
      const dt = num(params, 'dt', 0.05)
      const nTrails = Math.min(maxTrails, num(params, 'trails', 3))
      const tail = Math.min(maxTail, num(params, 'tail', 1500))
      const spin = num(params, 'spin', 0.08)
      const STEPS = 6

      clear(ctx, W, H, 'rgba(10,11,20,0.18)')
      strokeOutline(ctx, sdf, W, H)

      const angle = clock.nowSeconds() * spin

      for (let ti = 0; ti < nTrails; ti++) {
        const tr = bufs[ti]
        for (let s = 0; s < STEPS; s++) {
          const [nx, ny, nz] = rk4Thomas(tr.cx, tr.cy, tr.cz, b, dt)
          tr.cx = nx; tr.cy = ny; tr.cz = nz
          const [pu, pv] = project(nx, ny, nz, angle)
          // depth: component along [1,1,1]
          const depth = (nx + ny + nz) / (3 * Math.sqrt(3))
          tr.pxs[tr.head] = pu
          tr.pys[tr.head] = pv
          tr.zs[tr.head] = depth
          tr.head = (tr.head + 1) % maxTail
          if (tr.len < maxTail) tr.len++
        }
        const drawLen = Math.min(tr.len, tail)
        const hue = 255 + ti * 35
        for (let i = 0; i < drawLen - 1; i++) {
          const age = i / drawLen
          const i0 = (tr.head - 1 - i + maxTail) % maxTail
          const i1 = (tr.head - 2 - i + maxTail) % maxTail
          const px0 = OX + tr.pxs[i0]*SC, py0 = OY + tr.pys[i0]*SC
          const px1 = OX + tr.pxs[i1]*SC, py1 = OY + tr.pys[i1]*SC
          const d = Math.max(0, Math.min(1, tr.zs[i0] * 0.5 + 0.5))
          const alpha = (1 - age) * (0.3 + d * 0.55)
          ctx.strokeStyle = `hsla(${hue},80%,${50+d*30}%,${alpha.toFixed(3)})`
          ctx.lineWidth = 0.5 + d * 0.9
          ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke()
        }
      }
    })
  },
}
