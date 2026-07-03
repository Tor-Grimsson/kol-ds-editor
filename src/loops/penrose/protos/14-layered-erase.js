
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'




// Second layer-composition demo — this one shows SUBTRACTIVE interaction.
// Layer A: packed circles with a life counter. Layer B: wandering erasers
// that tick the life of any circle they touch down toward zero. Circles at
// life 0 vanish. This is the "life/death between layers" rule from the brief.
export const layeredErase            = {
  id: '14-layered-erase',
  name: 'LAYERED · ERASE (A ← B)',
  repo: 'composition · own code',
  summary:
    'Subtractive layer interaction. A: packed circles, each with `life` initialized to 100. B: wandering erasers do a smooth random walk bounded by SDF; each eraser decrements the `life` of every circle within reach. Circles die when `life <= 0`. Over time the glyph hollows out.',
  helps:
    'Explicit "Conway-esque" life/death rule between two layers. Subtract is one shape of interaction — additive (add to life) and resurrect (revive dead) follow the same contract. This is the scaffold for a general LayerInteraction system.',
  params: [
    { key: 'minR', type: 'int', min: 4, max: 24, default: 10, label: 'min radius' },
    { key: 'maxR', type: 'int', min: 20, max: 80, default: 42, label: 'max radius' },
    { key: 'attempts', type: 'int', min: 1000, max: 9000, step: 500, default: 3500, label: 'density' },
    { key: 'circleLife', type: 'int', min: 20, max: 300, step: 10, default: 100, label: 'circle life' },
    { key: 'erasers', type: 'int', min: 1, max: 40, default: 14, label: 'erasers' },
    { key: 'eraserReach', type: 'int', min: 6, max: 50, default: 20, label: 'eraser reach' },
    { key: 'damagePerTick', type: 'range', min: 0.1, max: 3, step: 0.1, default: 0.7, label: 'damage' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { minR, maxR, attempts, circleLife, erasers: NE, eraserReach, damagePerTick } = params

    // ---- Layer A: packed circles with life ----
    const circles           = []
    const padding = 2
    const spawnCircle = (x        , y        , r        ) =>
      circles.push({ x, y, r, life: circleLife })
    const gridCell = Math.max(minR, 2)
    const gw = Math.ceil(sdf.w / gridCell) + 1
    const gh = Math.ceil(sdf.h / gridCell) + 1
    const grid             = new Array(gw * gh)
    for (let i = 0; i < grid.length; i++) grid[i] = []
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / gridCell))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / gridCell)))
    const collides = (x        , y        , r        )          => {
      const cx = Math.floor(x / gridCell), cy = Math.floor(y / gridCell)
      const reach = Math.max(1, Math.ceil((r + maxR) / gridCell))
      for (let j = -reach; j <= reach; j++) {
        const yy = cy + j
        if (yy < 0 || yy >= gh) continue
        for (let i = -reach; i <= reach; i++) {
          const xx = cx + i
          if (xx < 0 || xx >= gw) continue
          const bucket = grid[yy * gw + xx]
          for (let k = 0; k < bucket.length; k++) {
            const c = circles[bucket[k]]
            if (c.life <= 0) continue
            const dx = c.x - x, dy = c.y - y
            const s = c.r + r + padding
            if (dx * dx + dy * dy < s * s) return true
          }
        }
      }
      return false
    }
    for (const [lo, hi] of [[maxR * 0.65, maxR], [maxR * 0.4, maxR * 0.65], [minR, maxR * 0.4]]                      ) {
      for (let i = 0; i < attempts; i++) {
        const x = rng() * sdf.w, y = rng() * sdf.h
        const s = sdf.sample(x, y)
        if (s >= 0) continue
        const maxPoss = Math.min(maxR, -s * 0.85 - padding)
        if (maxPoss < lo) continue
        const r = Math.min(maxPoss, hi)
        if (r < minR || collides(x, y, r)) continue
        const idx = circles.length
        spawnCircle(x, y, r)
        grid[gi(x, y)].push(idx)
      }
    }

    // ---- Layer B: erasers (Brownian walkers) ----
    const erasers           = []
    for (let i = 0; i < NE; i++) {
      const [x, y] = sampleInside(sdf, rng)
      erasers.push({ x, y, ang: rng() * Math.PI * 2 })
    }

    return wrapLoop(() => {
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.16)', 1)

      // update erasers
      for (const e of erasers) {
        e.ang += (rng() - 0.5) * 0.35
        const nx = e.x + Math.cos(e.ang) * 1.6
        const ny = e.y + Math.sin(e.ang) * 1.6
        if (sdf.sample(nx, ny) < 0) { e.x = nx; e.y = ny }
        else { e.ang += Math.PI * (0.5 + rng() * 0.5) }

        // damage nearby circles (cross-layer: B reads A and writes A.life)
        for (let i = 0; i < circles.length; i++) {
          const c = circles[i]
          if (c.life <= 0) continue
          const dx = c.x - e.x, dy = c.y - e.y
          const d2 = dx * dx + dy * dy
          const reach = c.r + eraserReach
          if (d2 > reach * reach) continue
          c.life -= damagePerTick
        }
      }

      // render Layer A — circles with life-driven opacity
      for (const c of circles) {
        if (c.life <= 0) continue
        const alpha = Math.max(0.05, c.life / circleLife)
        ctx.strokeStyle = `rgba(170, 174, 220, ${alpha * 0.6})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, c.r * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = `rgba(243, 201, 196, ${alpha})`
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // render Layer B — erasers (bright + trail-ish)
      ctx.fillStyle = 'rgba(232, 91, 62, 0.85)'
      for (const e of erasers) {
        ctx.beginPath()
        ctx.arc(e.x * sx, e.y * sy, 2.4, 0, Math.PI * 2)
        ctx.fill()
        // reach preview
        ctx.strokeStyle = 'rgba(232, 91, 62, 0.18)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(e.x * sx, e.y * sy, eraserReach * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.stroke()
      }
    })
  },
}
