
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'



// Differential curve growth. Closed polyline where each node is repelled by
// nearby nodes and attracted to its two neighbors. When an edge grows too long
// it splits; the SDF keeps the whole system trapped inside the glyph.
//
// Reference: inconvergent/differential-line (Anders Hoff).
// http://www.codeplastic.com/2017/07/22/differential-line-growth-with-processing/
export const diffgrow            = {
  id: '02-diffgrow',
  name: 'DIFFERENTIAL CURVE GROWTH',
  repo: 'inconvergent/differential-line',
  summary:
    'One closed curve that folds and branches as it fills the glyph. Per-node: repulsion from neighbors (radius), spring to adjacent chain neighbors, inward SDF force. Edges subdivide when stretched → length increases exponentially → organic folded fill.',
  helps:
    'Closest to the "alive, growing, trapped" vision from the brief. Natural exponential growth over time. Can be a single triggered "expression" that fills the letter.',
  params: [
    { key: 'seedN', type: 'int', min: 6, max: 48, default: 18, label: 'seed nodes' },
    { key: 'repulRadius', type: 'range', min: 4, max: 20, step: 0.5, default: 9, label: 'repel radius' },
    { key: 'repulStrength', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.42, label: 'repel strength' },
    { key: 'springTarget', type: 'range', min: 2, max: 14, step: 0.5, default: 6, label: 'spring length' },
    { key: 'springStrength', type: 'range', min: 0.02, max: 0.6, step: 0.01, default: 0.2, label: 'spring strength' },
    { key: 'splitAt', type: 'range', min: 4, max: 24, step: 0.5, default: 10, label: 'split length' },
    { key: 'maxNodes', type: 'int', min: 1000, max: 12000, step: 500, default: 6000, label: 'max nodes' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { seedN, repulRadius, repulStrength, springTarget, springStrength, splitAt, maxNodes } = params

    // seed with a small circle at a random interior point
    const [cx, cy] = sampleInside(sdf, rng)
    const seedR = 14
    const nodes         = []
    for (let i = 0; i < seedN; i++) {
      const a = (i / seedN) * Math.PI * 2
      nodes.push({ x: cx + Math.cos(a) * seedR, y: cy + Math.sin(a) * seedR, vx: 0, vy: 0 })
    }

    const damping = 0.75
    const sdfMargin = 4

    return wrapLoop(() => {
      const n = nodes.length
      // Reset forces (use vx/vy as accumulators this tick)
      for (let i = 0; i < n; i++) {
        nodes[i].vx *= damping
        nodes[i].vy *= damping
      }

      // Repulsion (spatial grid for perf)
      const cs = repulRadius
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = new Array(gw * gh)
      for (let i = 0; i < grid.length; i++) grid[i] = []
      for (let i = 0; i < n; i++) {
        const gx = Math.max(0, Math.min(gw - 1, Math.floor(nodes[i].x / cs)))
        const gy = Math.max(0, Math.min(gh - 1, Math.floor(nodes[i].y / cs)))
        grid[gy * gw + gx].push(i)
      }
      for (let i = 0; i < n; i++) {
        const a = nodes[i]
        const gx = Math.floor(a.x / cs), gy = Math.floor(a.y / cs)
        for (let j = -1; j <= 1; j++) {
          const yy = gy + j
          if (yy < 0 || yy >= gh) continue
          for (let i2 = -1; i2 <= 1; i2++) {
            const xx = gx + i2
            if (xx < 0 || xx >= gw) continue
            const bucket = grid[yy * gw + xx]
            for (let k = 0; k < bucket.length; k++) {
              const idx = bucket[k]
              if (idx === i) continue
              const b = nodes[idx]
              const dx = a.x - b.x, dy = a.y - b.y
              const d2 = dx * dx + dy * dy
              if (d2 > repulRadius * repulRadius || d2 < 1e-6) continue
              const d = Math.sqrt(d2)
              const f = ((repulRadius - d) / repulRadius) * repulStrength
              a.vx += (dx / d) * f
              a.vy += (dy / d) * f
            }
          }
        }
      }

      // Spring to chain neighbors (closed loop)
      for (let i = 0; i < n; i++) {
        const a = nodes[i]
        const prev = nodes[(i - 1 + n) % n]
        const next = nodes[(i + 1) % n]
        for (const o of [prev, next]) {
          const dx = o.x - a.x, dy = o.y - a.y
          const d = Math.hypot(dx, dy) || 1e-6
          const delta = d - springTarget
          const f = delta * springStrength
          a.vx += (dx / d) * f
          a.vy += (dy / d) * f
        }
      }

      // SDF boundary force (push inward when near or outside boundary)
      for (let i = 0; i < n; i++) {
        const a = nodes[i]
        const s = sdf.sample(a.x, a.y)
        if (s > -sdfMargin) {
          const hStep = 1.5
          const gx = sdf.sample(a.x + hStep, a.y) - sdf.sample(a.x - hStep, a.y)
          const gy = sdf.sample(a.x, a.y + hStep) - sdf.sample(a.x, a.y - hStep)
          const m = Math.hypot(gx, gy) || 1e-6
          const push = Math.max(0, s + sdfMargin) * 0.25
          a.vx -= (gx / m) * push
          a.vy -= (gy / m) * push
        }
      }

      // Integrate
      for (let i = 0; i < n; i++) {
        const a = nodes[i]
        a.x += a.vx
        a.y += a.vy
      }

      // Edge split (insert midpoint on long edges)
      if (nodes.length < maxNodes) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i]
          const b = nodes[(i + 1) % nodes.length]
          const dx = b.x - a.x, dy = b.y - a.y
          if (dx * dx + dy * dy > splitAt * splitAt) {
            nodes.splice(i + 1, 0, {
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              vx: 0, vy: 0,
            })
            i++
          }
        }
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      ctx.strokeStyle = '#8b8fd6'
      ctx.lineWidth = 1.1
      ctx.beginPath()
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        if (i === 0) ctx.moveTo(a.x * sx, a.y * sy)
        else ctx.lineTo(a.x * sx, a.y * sy)
      }
      ctx.closePath()
      ctx.stroke()

      ctx.fillStyle = '#f3c9c4'
      for (const p of nodes) {
        ctx.beginPath()
        ctx.arc(p.x * sx, p.y * sy, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
