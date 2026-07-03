// Curve-Shortening Flow (Gage–Hamilton–Grayson 1986/1987)
// Each vertex moves along the inward normal at speed = curvature κ.
// SDF confines the curve; reverse-direction (outward) inflates a small seed.
// Remeshes to uniform arc-length every REMESH_INTERVAL steps.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'N0',      type: 'int',   min: 20,  max: 300, default: 80,  step: 10,   label: 'seed nodes' },
  { key: 'dt',      type: 'range', min: 0.01, max: 0.5, default: 0.12, step: 0.01, label: 'timestep' },
  { key: 'sdfPull', type: 'range', min: 0,   max: 3,   default: 0.8,  step: 0.05, label: 'sdf pull' },
  { key: 'outward', type: 'boolean', default: true,                                label: 'inflate outward' },
  { key: 'seedR',   type: 'int',   min: 4,   max: 60,  default: 12,  step: 2,    label: 'seed radius' },
]



function remesh(pts      , targetN        )       {
  const n = pts.length
  if (n < 3) return pts
  // compute total length
  let total = 0
  const lens           = []
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    lens.push(l)
    total += l
  }
  if (total < 1e-6) return pts
  const seg = total / targetN
  const out       = []
  let acc = 0
  let idx = 0
  for (let k = 0; k < targetN; k++) {
    const target = k * seg
    while (acc + lens[idx] < target && idx < n - 1) { acc += lens[idx]; idx++ }
    const t = lens[idx] > 1e-9 ? (target - acc) / lens[idx] : 0
    const a = pts[idx], b = pts[(idx + 1) % n]
    out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
  }
  return out
}

export const r2_curve_01_csf            = {
  id: 'r2-curve-01-csf',
  name: 'CURVE SHORTENING FLOW',
  repo: 'Gage–Hamilton–Grayson',
  summary: 'Closed polyline evolves along its inward normal at rate κ. Outward mode inflates a seed ring until it hits the SDF wall; inward mode erodes complex shapes to smooth ovals.',
  helps: 'Smooth geometric decay / bloom. SDF-bounded shrinking and inflation from a seed.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N0      = num(params, 'N0', 80)
    const dt      = num(params, 'dt', 0.12)
    const sdfPull = num(params, 'sdfPull', 0.8)
    const outward = params['outward'] !== false
    const seedR   = num(params, 'seedR', 12)

    const [cx, cy] = sampleInside(sdf, rng)
    let pts       = []
    for (let i = 0; i < N0; i++) {
      const a = (i / N0) * Math.PI * 2
      pts.push({ x: cx + Math.cos(a) * seedR, y: cy + Math.sin(a) * seedR })
    }

    let step = 0
    const REMESH = 30
    const dir = outward ? -1 : 1  // -1 = outward inflation, +1 = classic shrink

    return wrapLoop(() => {
      const n = pts.length
      const delta       = new Array(n)

      for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n]
        const next = pts[(i + 1) % n]
        const p = pts[i]

        // tangent and normal
        const tx = next.x - prev.x, ty = next.y - prev.y
        const tl = Math.hypot(tx, ty) || 1e-6
        const nx = -ty / tl, ny = tx / tl  // inward normal (left of tangent)

        // discrete curvature: turn angle / mean segment length
        const l1 = Math.hypot(p.x - prev.x, p.y - prev.y) || 1e-9
        const l2 = Math.hypot(next.x - p.x, next.y - p.y) || 1e-9
        const lm = (l1 + l2) * 0.5
        const cross = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x)
        const kappa = cross / (l1 * l2 * lm + 1e-9)

        let fx = dir * kappa * nx * dt
        let fy = dir * kappa * ny * dt

        // SDF pull: push away from boundary (inward)
        const sv = sdf.sample(p.x, p.y)
        if (sv > -8) {
          const [gx, gy] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gx, gy) || 1
          fx -= (gx / gm) * sdfPull * Math.max(0, sv + 8) * 0.05
          fy -= (gy / gm) * sdfPull * Math.max(0, sv + 8) * 0.05
        }

        delta[i] = { x: fx, y: fy }
      }

      for (let i = 0; i < n; i++) {
        pts[i].x += delta[i].x
        pts[i].y += delta[i].y
      }

      step++
      if (step % REMESH === 0) pts = remesh(pts, N0)

      // render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const nn = pts.length
      ctx.strokeStyle = '#7ec8d4'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i < nn; i++) {
        const p = pts[i]
        if (i === 0) ctx.moveTo(p.x * sx, p.y * sy)
        else ctx.lineTo(p.x * sx, p.y * sy)
      }
      ctx.closePath()
      ctx.stroke()
    })
  },
}
