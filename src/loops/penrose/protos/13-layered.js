import { createNoise2D } from 'simplex-noise'

import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'




// Demonstration of layer interaction: a packed-circles layer (static structure)
// + a flow-field particle layer (live motion) whose particles are REPELLED by
// the circle centers. This is the "layer A influences layer B" contract the
// brief asks for. Here: A is structural, B is motion; later, A could also
// respond to B (e.g. circles that shrink when many particles cross them).
export const layered            = {
  id: '13-layered',
  name: 'LAYERED (PACK × FLOW)',
  repo: 'composition · own code',
  summary:
    'TWO LAYERS live on the same canvas. Layer A: packed circles (dart-throw, SDF-masked). Layer B: flow-field particles (simplex-noise angle field, SDF-respawn). Layer B READS Layer A — each particle is repelled by the nearest circle center within a radius. The brief\'s "additive / subtractive / life-death" rules plug in here as additional cross-layer forces.',
  helps:
    'The actual vision, in miniature. Two layers, one reading the other\'s positions. Everything we need to scale to N layers with named interaction contracts lives in this pattern.',
  params: [
    { key: 'minR', type: 'int', min: 4, max: 24, default: 10, label: 'min radius' },
    { key: 'maxR', type: 'int', min: 20, max: 80, default: 46, label: 'max radius' },
    { key: 'attempts', type: 'int', min: 1000, max: 12000, step: 500, default: 5000, label: 'density' },
    { key: 'particles', type: 'int', min: 100, max: 1500, step: 50, default: 500, label: 'particles' },
    { key: 'noiseScale', type: 'range', min: 0.002, max: 0.04, step: 0.001, default: 0.01, label: 'flow scale' },
    { key: 'repelR', type: 'int', min: 8, max: 60, default: 26, label: 'repel radius' },
    { key: 'repelStrength', type: 'range', min: 0, max: 4, step: 0.1, default: 1.2, label: 'repel strength' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { minR, maxR, attempts, particles, repelR, repelStrength } = params

    // ---- Layer A: packed circles (static) ----
    const circles           = []
    const padding = 2
    const cell = Math.max(minR, 2)
    const gw = Math.ceil(sdf.w / cell) + 1
    const gh = Math.ceil(sdf.h / cell) + 1
    const gridA             = new Array(gw * gh)
    for (let i = 0; i < gridA.length; i++) gridA[i] = []
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cell))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cell)))
    const collides = (x        , y        , r        )          => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell)
      const reach = Math.max(1, Math.ceil((r + maxR) / cell))
      for (let j = -reach; j <= reach; j++) {
        const yy = cy + j
        if (yy < 0 || yy >= gh) continue
        for (let i = -reach; i <= reach; i++) {
          const xx = cx + i
          if (xx < 0 || xx >= gw) continue
          const bucket = gridA[yy * gw + xx]
          for (let k = 0; k < bucket.length; k++) {
            const c = circles[bucket[k]]
            const dx = c.x - x, dy = c.y - y
            const s = c.r + r + padding
            if (dx * dx + dy * dy < s * s) return true
          }
        }
      }
      return false
    }
    for (const [lo, hi] of [[maxR * 0.7, maxR], [maxR * 0.4, maxR * 0.7], [minR, maxR * 0.4]]                      ) {
      for (let i = 0; i < attempts; i++) {
        const x = rng() * sdf.w, y = rng() * sdf.h
        const s = sdf.sample(x, y)
        if (s >= 0) continue
        const maxPoss = Math.min(maxR, -s * 0.85 - padding)
        if (maxPoss < lo) continue
        const r = Math.min(maxPoss, hi)
        if (r < minR || collides(x, y, r)) continue
        const idx = circles.length
        circles.push({ x, y, r })
        gridA[gi(x, y)].push(idx)
      }
    }

    // ---- Layer B: flow-field particles (animated, reads layer A) ----
    const noise2D = createNoise2D(rng)
    const noiseScale = params.noiseScale
    const ps             = []
    const N = particles
    const spawn = ()           => {
      const [x, y] = sampleInside(sdf, rng)
      return { x, y, px: x, py: y, life: (rng() * 160) | 0 }
    }
    for (let i = 0; i < N; i++) ps.push(spawn())

    clear(ctx, W, H)

    return wrapLoop(() => {
      ctx.fillStyle = 'rgba(10, 11, 20, 0.07)'
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.15)', 1)

      // Layer A — render circles (subtle)
      ctx.strokeStyle = 'rgba(170, 174, 220, 0.35)'
      ctx.lineWidth = 0.8
      for (const c of circles) {
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, c.r * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = '#f3c9c4'
      for (const c of circles) {
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Layer B — flow-field particles, repelled by nearest circle center
      ctx.strokeStyle = 'rgba(139, 143, 214, 0.55)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (const p of ps) {
        p.px = p.x
        p.py = p.y
        const ang = noise2D(p.x * noiseScale, p.y * noiseScale) * Math.PI * 2
        let vx = Math.cos(ang) * 1.3
        let vy = Math.sin(ang) * 1.3

        // cross-layer repulsion: find nearest circle within repelR
        const cxg = Math.floor(p.x / cell), cyg = Math.floor(p.y / cell)
        let best = -1, bestD2 = repelR * repelR
        for (let j = -1; j <= 1; j++) {
          const yy = cyg + j
          if (yy < 0 || yy >= gh) continue
          for (let i = -1; i <= 1; i++) {
            const xx = cxg + i
            if (xx < 0 || xx >= gw) continue
            const bucket = gridA[yy * gw + xx]
            for (let k = 0; k < bucket.length; k++) {
              const c = circles[bucket[k]]
              const dx = p.x - c.x, dy = p.y - c.y
              const d2 = dx * dx + dy * dy
              if (d2 < bestD2) { bestD2 = d2; best = bucket[k] }
            }
          }
        }
        if (best >= 0) {
          const c = circles[best]
          const dx = p.x - c.x, dy = p.y - c.y
          const d = Math.sqrt(bestD2) || 1
          const force = (1 - d / repelR) * repelStrength
          vx += (dx / d) * force
          vy += (dy / d) * force
        }

        p.x += vx
        p.y += vy
        p.life--
        if (p.life <= 0 || sdf.sample(p.x, p.y) >= 0) {
          const n = spawn()
          p.x = n.x; p.y = n.y; p.px = n.x; p.py = n.y; p.life = 160
          continue
        }
        ctx.moveTo(p.px * sx, p.py * sy)
        ctx.lineTo(p.x * sx, p.y * sy)
      }
      ctx.stroke()
    })
  },
}
