

import { Delaunay } from 'd3-delaunay'
import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'N',      type: 'int',   min: 60,   max: 500, default: 220, step: 20,   label: 'points' },
  { key: 'speed',  type: 'range', min: 0.05, max: 1.5, default: 0.3, step: 0.05, label: 'sweep speed' },
  { key: 'jitter', type: 'range', min: 0,    max: 4,   default: 1.2, step: 0.1,  label: 'point drift' },
  { key: 'reverse', type: 'boolean', default: false, label: 'crystallize' },
]

// Circumradius for a Delaunay triangle defined by its three vertex indices
function circumradius(pts              , a        , b        , c        )         {
  const ax = pts[2 * a], ay = pts[2 * a + 1]
  const bx = pts[2 * b], by = pts[2 * b + 1]
  const cx = pts[2 * c], cy = pts[2 * c + 1]
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(D) < 1e-10) return Infinity
  const ux = ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / D
  const uy = ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / D
  return Math.hypot(ax - ux, ay - uy)
}

export const r2_geom_02_alpha            = {
  id: 'r2-geom-02-alpha',
  name: 'ALPHA-SHAPE SWEEP',
  repo: 'd3-delaunay · alpha complex',
  summary: 'One Delaunay triangulation, animated alpha threshold. High α = convex hull fills the glyph; low α = boundary shreds into archipelagos of isolated points. Reverse mode crystallizes from dust.',
  helps: 'Topological erosion driven by a single scalar — conceptually clean, cinematically striking.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    let N    = num(params, 'N', 220)
    let base                     = []
    const phases           = []

    const reseed = () => {
      N = num(params, 'N', 220)
      base = []
      phases.length = 0
      for (let i = 0; i < N; i++) {
        base.push(sampleInside(sdf, rng))
        phases.push(rng() * Math.PI * 2)
      }
    }
    reseed()

    // Pre-sort circumradii once per reseed for fast threshold filtering
    let cachedPts                      = null
    let sortedEdges                                                                  = []

    return wrapLoop(() => {
      const t       = clock.nowSeconds()
      const speed   = num(params, 'speed', 0.3)
      const jitter  = num(params, 'jitter', 1.2)
      const rev     = params['reverse']

      // Drift positions slowly
      const pts                     = base.map(([bx, by], i) => [
        bx + Math.sin(t * 0.4 + phases[i]) * jitter,
        by + Math.cos(t * 0.37 + phases[i] + 1.1) * jitter,
      ])

      const flat = Float64Array.from(pts.flat())
      const needRebuild = cachedPts === null ||
        flat.length !== cachedPts.length ||
        Math.abs(flat[0] - cachedPts[0]) > 2  // rebuild if pts drifted far enough

      if (needRebuild) {
        cachedPts = flat.slice()
        const d = new Delaunay(flat)
        sortedEdges = []
        const tris = d.triangles
        const added = new Set        ()
        for (let i = 0; i < tris.length; i += 3) {
          const a = tris[i], b = tris[i+1], c = tris[i+2]
          const cr = circumradius(flat, a, b, c)
          if (!isFinite(cr)) continue
          const pairs                     = [[a,b],[b,c],[a,c]]
          for (const [p, q] of pairs) {
            const key = p < q ? `${p}-${q}` : `${q}-${p}`
            if (added.has(key)) continue
            added.add(key)
            sortedEdges.push({
              r: cr,
              ax: flat[2*p], ay: flat[2*p+1],
              bx: flat[2*q], by: flat[2*q+1],
            })
          }
        }
        sortedEdges.sort((a, b) => a.r - b.r)
      }

      // Animate alpha: oscillate between 0 (convex hull) and max circumradius
      const maxR = sortedEdges.length ? sortedEdges[sortedEdges.length - 1].r : 80
      const phase = (Math.sin(t * speed * Math.PI) * 0.5 + 0.5)  // 0..1
      const alphaR = rev ? maxR * (1 - phase) : maxR * phase  // threshold on circumradius

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // Edges whose circumradius ≤ alphaR are inside the alpha complex
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(160,190,250,0.65)'
      ctx.lineWidth = 0.9
      for (const e of sortedEdges) {
        if (e.r > alphaR) break
        if (sdf.sample(e.ax, e.ay) >= 0 || sdf.sample(e.bx, e.by) >= 0) continue
        ctx.moveTo(e.ax * sx, e.ay * sy)
        ctx.lineTo(e.bx * sx, e.by * sy)
      }
      ctx.stroke()

      // Points
      ctx.fillStyle = 'rgba(243,200,185,0.85)'
      for (const [x, y] of pts) {
        if (sdf.sample(x, y) >= 0) continue
        ctx.beginPath()
        ctx.arc(x * sx, y * sy, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
