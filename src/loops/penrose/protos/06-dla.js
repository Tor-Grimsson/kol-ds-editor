
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'




// Diffusion-limited aggregation. Random walkers wander until they touch the
// growing aggregate; they stick and new walkers spawn. Classic branching
// fractal, well-suited to SDF-bounded domains.
//
// Reference: jasonwebb/2d-diffusion-limited-aggregation-experiments
export const dla            = {
  id: '06-dla',
  name: 'DIFFUSION-LIMITED AGGREGATION',
  repo: 'jasonwebb/2d-diffusion-limited-aggregation-experiments',
  summary:
    'Random walkers step until they touch a stuck particle and join the aggregate. The boundary shape (SDF) bounces walkers inward. Output is organic dendritic branching — crystal-like fingers growing from a seed.',
  helps:
    'Slow, crystalline growth — most "fractal vector" of the candidates. Matches the "fractal vector points" language from the brief literally. Strong candidate for a triggered growth spell.',
  params: [
    { key: 'nWalkers', type: 'int', min: 50, max: 800, step: 10, default: 200, label: 'walkers' },
    { key: 'stickDist', type: 'range', min: 1, max: 12, step: 0.5, default: 3, label: 'stick dist' },
    { key: 'step', type: 'range', min: 0.5, max: 6, step: 0.1, default: 1.5, label: 'step' },
    { key: 'maxStuck', type: 'int', min: 500, max: 8000, step: 100, default: 4000, label: 'max stuck' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { nWalkers, stickDist, step, maxStuck } = params

    const stuck          = []
    const walkers           = []

    // seed: one particle at a random interior point
    const [sx0, sy0] = sampleInside(sdf, rng)
    stuck.push({ x: sx0, y: sy0, parent: -1 })

    const spawnWalker = ()         => {
      const [x, y] = sampleInside(sdf, rng)
      return { x, y, alive: true }
    }
    for (let i = 0; i < nWalkers; i++) walkers.push(spawnWalker())

    // spatial grid of stuck particles for O(1) neighbor checks
    const cs = 12
    const gw = Math.ceil(sdf.w / cs) + 1
    const gh = Math.ceil(sdf.h / cs) + 1
    const grid             = new Array(gw * gh)
    for (let i = 0; i < grid.length; i++) grid[i] = []
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cs))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cs)))
    grid[gi(stuck[0].x, stuck[0].y)].push(0)

    return wrapLoop(() => {
      if (stuck.length >= maxStuck) return
      for (const w of walkers) {
        if (!w.alive) continue
        // random walk
        const ang = rng() * Math.PI * 2
        const nx = w.x + Math.cos(ang) * step
        const ny = w.y + Math.sin(ang) * step
        if (sdf.sample(nx, ny) >= 0) continue // reflect: skip this step (bounce at boundary)
        w.x = nx; w.y = ny

        // collision check against stuck in nearby cells
        const gx = Math.floor(w.x / cs), gy = Math.floor(w.y / cs)
        let hit = -1
        outer: for (let j = -1; j <= 1; j++) {
          const yy = gy + j
          if (yy < 0 || yy >= gh) continue
          for (let i2 = -1; i2 <= 1; i2++) {
            const xx = gx + i2
            if (xx < 0 || xx >= gw) continue
            const bucket = grid[yy * gw + xx]
            for (let k = 0; k < bucket.length; k++) {
              const idx = bucket[k]
              const s = stuck[idx]
              const dx = s.x - w.x, dy = s.y - w.y
              if (dx * dx + dy * dy < stickDist * stickDist) { hit = idx; break outer }
            }
          }
        }
        if (hit >= 0) {
          const idx = stuck.length
          stuck.push({ x: w.x, y: w.y, parent: hit })
          grid[gi(w.x, w.y)].push(idx)
          // respawn walker elsewhere
          const nw = spawnWalker()
          w.x = nw.x; w.y = nw.y
        }
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      // walkers (dim)
      ctx.fillStyle = 'rgba(139, 143, 214, 0.35)'
      for (const w of walkers) {
        if (!w.alive) continue
        ctx.beginPath()
        ctx.arc(w.x * sx, w.y * sy, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // edges to parents
      ctx.strokeStyle = 'rgba(210, 215, 235, 0.8)'
      ctx.lineWidth = 0.9
      ctx.beginPath()
      for (const s of stuck) {
        if (s.parent < 0) continue
        const p = stuck[s.parent]
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(s.x * sx, s.y * sy)
      }
      ctx.stroke()

      // stuck dots
      ctx.fillStyle = '#f3c9c4'
      for (const s of stuck) {
        ctx.beginPath()
        ctx.arc(s.x * sx, s.y * sy, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
