
import { clear, strokeOutline, wrapLoop } from '../common.js'



// Recursive quadtree subdivision against the SDF. Cells fully outside are
// dropped; cells fully inside get an inscribed circle; cells straddling the
// boundary subdivide until max depth. Animates as progressive subdivision.
//
// Reference: classic quadtree + Mondrian / "Box and Circle" generative studies.
export const quadtree            = {
  id: '08-quadtree',
  name: 'QUADTREE SUBDIVISION',
  repo: 'classic quadtree (d3-quadtree for nearest-neighbor)',
  summary:
    'Split the canvas into quads; each quad checks SDF at its 4 corners. Outside → drop. Inside → inscribe circle. Straddle → subdivide. Produces the grid-of-circles-in-box look from the ref mood. Layerable: each depth tier is its own layer.',
  helps:
    'A rectilinear / rational counterpoint to the organic packers. Each depth tier IS a layer for free, with obvious life/death rules (cell splits → parent dies, children born).',
  params: [
    { key: 'minS', type: 'int', min: 4, max: 60, default: 18, label: 'min cell' },
    { key: 'cadence', type: 'int', min: 1, max: 12, default: 3, label: 'cadence' },
    { key: 'inscribe', type: 'range', min: 0.4, max: 1, step: 0.05, default: 0.85, label: 'inscribe' },
    { key: 'dot', type: 'range', min: 0.4, max: 4, step: 0.1, default: 1.2, label: 'center dot' },
  ],
  init({ ctx, sdf, W, H, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const { minS, cadence, inscribe, dot } = params

    const q         = [{ x: 0, y: 0, s: sdf.w, mode: 'wait' }]
    const filled         = []
    let tick = 0

    const classifyAll = (c      )                            => {
      const samples           = []
      for (let j = 0; j <= 2; j++) {
        for (let i = 0; i <= 2; i++) {
          samples.push(sdf.sample(c.x + (c.s * i) / 2, c.y + (c.s * j) / 2))
        }
      }
      let nIn = 0, nOut = 0
      for (const s of samples) {
        if (s < 0) nIn++
        else nOut++
      }
      if (nOut === 0) return 'in'
      if (nIn === 0) return 'out'
      return 'straddle'
    }

    return wrapLoop(() => {
      tick++
      // One subdivision per frame → visible progression
      if (tick % cadence === 0) {
        const next         = []
        for (const c of q) {
          const kind = classifyAll(c)
          if (kind === 'in') { filled.push(c); continue }
          if (kind === 'out') continue
          if (c.s <= minS) { filled.push(c); continue }
          const h = c.s / 2
          next.push({ x: c.x, y: c.y, s: h, mode: 'wait' })
          next.push({ x: c.x + h, y: c.y, s: h, mode: 'wait' })
          next.push({ x: c.x, y: c.y + h, s: h, mode: 'wait' })
          next.push({ x: c.x + h, y: c.y + h, s: h, mode: 'wait' })
        }
        q.length = 0
        q.push(...next)
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.2)', 1)

      // draw cell rects
      ctx.strokeStyle = 'rgba(139, 143, 214, 0.4)'
      ctx.lineWidth = 0.7
      for (const c of filled) {
        ctx.strokeRect(c.x * sx, c.y * sy, c.s * sx, c.s * sy)
      }
      for (const c of q) {
        ctx.strokeRect(c.x * sx, c.y * sy, c.s * sx, c.s * sy)
      }

      // inscribe circles in filled cells
      for (const c of filled) {
        const cx = (c.x + c.s / 2) * sx
        const cy = (c.y + c.s / 2) * sy
        const r = (c.s / 2) * Math.min(sx, sy) * inscribe
        ctx.strokeStyle = 'rgba(210, 215, 235, 0.7)'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#f3c9c4'
        ctx.beginPath()
        ctx.arc(cx, cy, dot, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
