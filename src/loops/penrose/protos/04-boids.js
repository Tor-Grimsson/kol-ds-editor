
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common.js'



// Reynolds boids (1986): separation + alignment + cohesion + SDF boundary.
// Produces "life" — swirling, flocking, drifting — inside the glyph.
// No external repo; algorithm is textbook (Reynolds, red3d.com/cwr/boids/).
export const boids            = {
  id: '04-boids',
  name: 'BOIDS / FLOCKING',
  repo: 'red3d.com/cwr/boids (Reynolds 1986)',
  summary:
    'N autonomous agents with separation, alignment, cohesion forces + SDF inward force. Reads as a school or swarm drifting inside the letter. Ideal as a motion layer over a static pack (layer 1 structure, layer 2 life).',
  helps:
    'The "motion over structure" layer — boids drift over a static packed base. Cross-layer rules (predator/prey between layers) map cleanly onto boid weights.',
  params: [
    { key: 'N', type: 'int', min: 50, max: 1200, step: 10, default: 450, label: 'count' },
    { key: 'neighbor', type: 'int', min: 8, max: 60, default: 22, label: 'neighbor radius' },
    { key: 'sepR', type: 'range', min: 2, max: 24, step: 0.5, default: 9, label: 'separation dist' },
    { key: 'sepW', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.18, label: 'separation' },
    { key: 'aliW', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.05, label: 'alignment' },
    { key: 'cohW', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.02, label: 'cohesion' },
    { key: 'maxSpeed', type: 'range', min: 0.5, max: 6, step: 0.1, default: 2.2, label: 'max speed' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { N, neighbor, sepR, sepW, aliW, cohW, maxSpeed } = params

    const boids         = []
    for (let i = 0; i < N; i++) {
      const [x, y] = sampleInside(sdf, rng)
      const a = rng() * Math.PI * 2
      boids.push({ x, y, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8 })
    }

    const sdfMargin = 8

    return wrapLoop(() => {
      const cs = neighbor
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = new Array(gw * gh)
      for (let i = 0; i < grid.length; i++) grid[i] = []
      for (let i = 0; i < boids.length; i++) {
        const gx = Math.max(0, Math.min(gw - 1, Math.floor(boids[i].x / cs)))
        const gy = Math.max(0, Math.min(gh - 1, Math.floor(boids[i].y / cs)))
        grid[gy * gw + gx].push(i)
      }

      for (let i = 0; i < boids.length; i++) {
        const b = boids[i]
        let sepX = 0, sepY = 0
        let aliX = 0, aliY = 0
        let cohX = 0, cohY = 0
        let cnt = 0
        const gx = Math.floor(b.x / cs), gy = Math.floor(b.y / cs)
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
              const o = boids[idx]
              const dx = o.x - b.x, dy = o.y - b.y
              const d2 = dx * dx + dy * dy
              if (d2 > neighbor * neighbor || d2 < 1e-6) continue
              const d = Math.sqrt(d2)
              // separation (push away if too close)
              if (d < sepR) {
                sepX -= dx / d
                sepY -= dy / d
              }
              // alignment (match velocity)
              aliX += o.vx
              aliY += o.vy
              // cohesion (toward center)
              cohX += o.x
              cohY += o.y
              cnt++
            }
          }
        }
        if (cnt > 0) {
          aliX /= cnt; aliY /= cnt
          cohX = cohX / cnt - b.x
          cohY = cohY / cnt - b.y
        }

        b.vx += sepX * sepW + aliX * aliW + cohX * cohW
        b.vy += sepY * sepW + aliY * aliW + cohY * cohW

        // SDF boundary force — pushes inward when near or past boundary
        const s = sdf.sample(b.x, b.y)
        if (s > -sdfMargin) {
          const [gX, gY] = sdfGrad(sdf, b.x, b.y)
          const m = Math.hypot(gX, gY) || 1e-6
          const push = (Math.max(0, s + sdfMargin) / sdfMargin) * 1.5
          b.vx -= (gX / m) * push
          b.vy -= (gY / m) * push
        }

        // clamp speed
        const sp = Math.hypot(b.vx, b.vy)
        if (sp > maxSpeed) { b.vx = (b.vx / sp) * maxSpeed; b.vy = (b.vy / sp) * maxSpeed }

        b.x += b.vx
        b.y += b.vy
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      ctx.fillStyle = '#f3c9c4'
      for (const b of boids) {
        // tiny triangle oriented by velocity
        const ang = Math.atan2(b.vy, b.vx)
        const cx = b.x * sx, cy = b.y * sy
        const s1 = 4, s2 = 2
        const x0 = cx + Math.cos(ang) * s1
        const y0 = cy + Math.sin(ang) * s1
        const x1 = cx + Math.cos(ang + 2.4) * s2
        const y1 = cy + Math.sin(ang + 2.4) * s2
        const x2 = cx + Math.cos(ang - 2.4) * s2
        const y2 = cy + Math.sin(ang - 2.4) * s2
        ctx.beginPath()
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath()
        ctx.fill()
      }
    })
  },
}
