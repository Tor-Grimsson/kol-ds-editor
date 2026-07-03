

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Hopf Fibration — stereographic projection of S³ fibers to R³, then
// perspective to 2D. Each fiber = one great circle; colored by latitude on S².
// Ref: Niles Johnson nilesjohnson.net/hopf.html; arXiv 2212.01642

const PARAMS          = [
  { key: 'fibers', type: 'int', min: 20, max: 180, default: 80, step: 10, label: 'fiber count' },
  { key: 'spin', type: 'range', min: 0, max: 1.5, default: 0.3, step: 0.05, label: 'spin speed' },
  { key: 'pts', type: 'int', min: 20, max: 100, default: 48, step: 4, label: 'pts/fiber' },
  { key: 'cam', type: 'range', min: 2, max: 8, default: 4.0, step: 0.2, label: 'camera dist' },
  { key: 'alpha', type: 'range', min: 0.05, max: 0.8, default: 0.3, step: 0.05, label: 'base alpha' },
]

// 4D left-quaternion rotation around xw-plane by angle e (simple Hopf spin)
function rot4xw(a                                  , e        )                                   {
  const c = Math.cos(e), s = Math.sin(e)
  return [c * a[0] - s * a[3], a[1], a[2], s * a[0] + c * a[3]]
}
function rot4yz(a                                  , e        )                                   {
  const c = Math.cos(e), s = Math.sin(e)
  return [a[0], c * a[1] - s * a[2], s * a[1] + c * a[2], a[3]]
}

// Stereographic S³ → R³ from north pole (0,0,0,1)
function stereo3(a                                  )                           {
  const d = 1 - a[3]
  if (Math.abs(d) < 1e-7) return [0, 0, 0]
  return [a[0] / d, a[1] / d, a[2] / d]
}

// Fibonacci spiral on S² for uniform base point distribution
function fibSphere(i        , n        )                   {
  const phi = Math.acos(1 - 2 * (i + 0.5) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return [theta, phi]
}

export const r2_topo_02_hopf            = {
  id: 'r2-topo-02-hopf',
  name: 'HOPF FIBRATION',
  repo: 'Niles Johnson · nilesjohnson.net/hopf · arXiv 2212.01642',
  summary: 'Pre-image fibers of the Hopf map h:S³→S², stereographically projected to R³ then perspective to 2D; animated by a 4D rotation applied each frame.',
  helps: 'Villarceau-circle fiber orbits create strong "depth through a porthole" — definitively 3D-feeling motion inside the glyph.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const SC = Math.min(W, H) * 0.22
    const OX = W * 0.5, OY = H * 0.5

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const NF = num(params, 'fibers', 80)
      const spin = num(params, 'spin', 0.3)
      const PTS = num(params, 'pts', 48)
      const cam = num(params, 'cam', 4.0)
      const baseAlpha = num(params, 'alpha', 0.3)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const e1 = t * spin
      const e2 = t * spin * 0.618

      for (let fi = 0; fi < NF; fi++) {
        const [theta, phi] = fibSphere(fi, NF)
        const lat = phi / Math.PI // 0..1
        const hue = 190 + lat * 160 // cool→warm

        ctx.beginPath()
        let first = true
        for (let j = 0; j <= PTS; j++) {
          const u = (j / PTS) * Math.PI * 2
          // Hopf fiber parameterization
          let a                                   = [
            Math.cos((u + theta) * 0.5) * Math.cos(phi * 0.5),
            Math.sin((u + theta) * 0.5) * Math.cos(phi * 0.5),
            Math.cos((u - theta) * 0.5) * Math.sin(phi * 0.5),
            Math.sin((u - theta) * 0.5) * Math.sin(phi * 0.5),
          ]
          a = rot4xw(a, e1)
          a = rot4yz(a, e2)
          const [rx, ry, rz] = stereo3(a)
          const w = 1 / (cam - rz)
          const px = OX + rx * SC * w
          const py = OY + ry * SC * w
          // SDF clip on first point check
          if (j === 0) {
            const sx = px / W * sdf.w, sy = py / H * sdf.h
            if (sdf.sample(sx, sy) > 12) { first = false; break }
          }
          if (first) { ctx.moveTo(px, py); first = false }
          else ctx.lineTo(px, py)
        }
        const depth = Math.max(0, Math.min(1, (1 - lat)))
        const alpha = baseAlpha + depth * 0.35
        ctx.strokeStyle = `hsla(${hue},75%,${55 + depth * 20}%,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.6 + depth * 0.8
        ctx.stroke()
      }
    })
  },
}
