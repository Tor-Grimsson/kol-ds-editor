

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Clifford Torus — flat torus in S³, 4D-rotated each frame, stereographic
// projected to R³, then perspective to 2D.  Two-speed rotation in xw and yz
// planes makes the torus continuously fold inside-out.
// Ref: Wikipedia — Clifford torus; Banchoff, Beyond 3D ch. 6

const PARAMS          = [
  { key: 'grid', type: 'int', min: 10, max: 50, default: 28, step: 2, label: 'grid lines' },
  { key: 'spin1', type: 'range', min: 0, max: 1.5, default: 0.4, step: 0.05, label: 'spin xw' },
  { key: 'spin2', type: 'range', min: 0, max: 1.5, default: 0.25, step: 0.05, label: 'spin yz' },
  { key: 'cam', type: 'range', min: 1.5, max: 6, default: 3.0, step: 0.1, label: 'camera dist' },
  { key: 'alpha', type: 'range', min: 0.1, max: 0.9, default: 0.45, step: 0.05, label: 'base alpha' },
]

const INV_SQRT2 = 1 / Math.sqrt(2)

// 4D rotation in xw-plane
function rxw(v                                  , a        )                                   {
  const c = Math.cos(a), s = Math.sin(a)
  return [c * v[0] - s * v[3], v[1], v[2], s * v[0] + c * v[3]]
}
// 4D rotation in yz-plane
function ryz(v                                  , a        )                                   {
  const c = Math.cos(a), s = Math.sin(a)
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2], v[3]]
}
// Stereographic S³ → R³
function stereo(v                                  )                           {
  const d = 1 - v[3]
  if (Math.abs(d) < 1e-7) return [0, 0, 0]
  return [v[0] / d, v[1] / d, v[2] / d]
}

export const r2_topo_03_clifford            = {
  id: 'r2-topo-03-clifford',
  name: 'CLIFFORD TORUS 4D',
  repo: 'Banchoff · Beyond 3D ch.6 · en.wikipedia.org/wiki/Clifford_torus',
  summary: 'Flat torus on S³ as (cosθ, sinθ, cosφ, sinφ)/√2; two independent 4D plane rotations projected stereographically then perspective to 2D wireframe.',
  helps: 'Inside-out folding motion is unlike anything else — the torus continuously inverts through itself, strong depth-cued warping.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const SC = Math.min(W, H) * 0.24
    const OX = W * 0.5, OY = H * 0.5

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const G = num(params, 'grid', 28)
      const s1 = num(params, 'spin1', 0.4)
      const s2 = num(params, 'spin2', 0.25)
      const cam = num(params, 'cam', 3.0)
      const baseAlpha = num(params, 'alpha', 0.45)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const a1 = t * s1
      const a2 = t * s2

      // Project one (θ,φ) point to canvas
      function project(theta        , phi        )                           {
        let v                                   = [
          Math.cos(theta) * INV_SQRT2,
          Math.sin(theta) * INV_SQRT2,
          Math.cos(phi) * INV_SQRT2,
          Math.sin(phi) * INV_SQRT2,
        ]
        v = rxw(v, a1)
        v = ryz(v, a2)
        const [rx, ry, rz] = stereo(v)
        const w = 1 / (cam - rz)
        return [OX + rx * SC * w, OY + ry * SC * w, rz]
      }

      // Draw constant-θ lines (latitude)
      for (let i = 0; i < G; i++) {
        const theta = (i / G) * Math.PI * 2
        ctx.beginPath()
        let first = true
        let sumZ = 0
        for (let j = 0; j <= 48; j++) {
          const phi = (j / 48) * Math.PI * 2
          const [px, py, pz] = project(theta, phi)
          sumZ += pz
          if (first) { ctx.moveTo(px, py); first = false }
          else ctx.lineTo(px, py)
        }
        const meanZ = sumZ / 49
        const depth = Math.max(0, Math.min(1, (meanZ + 2) / 4))
        ctx.strokeStyle = `rgba(160,210,255,${(baseAlpha * (0.5 + depth * 0.5)).toFixed(3)})`
        ctx.lineWidth = 0.5 + depth * 0.9
        ctx.stroke()
      }

      // Draw constant-φ lines (longitude)
      for (let j = 0; j < G; j++) {
        const phi = (j / G) * Math.PI * 2
        ctx.beginPath()
        let first = true
        let sumZ = 0
        for (let i = 0; i <= 48; i++) {
          const theta = (i / 48) * Math.PI * 2
          const [px, py, pz] = project(theta, phi)
          sumZ += pz
          const sx = px / W * sdf.w, sy = py / H * sdf.h
          if (sdf.sample(sx, sy) > 6) { first = true; continue }
          if (first) { ctx.moveTo(px, py); first = false }
          else ctx.lineTo(px, py)
        }
        const meanZ = sumZ / 49
        const depth = Math.max(0, Math.min(1, (meanZ + 2) / 4))
        ctx.strokeStyle = `rgba(255,200,140,${(baseAlpha * (0.4 + depth * 0.6)).toFixed(3)})`
        ctx.lineWidth = 0.4 + depth * 0.8
        ctx.stroke()
      }
    })
  },
}
