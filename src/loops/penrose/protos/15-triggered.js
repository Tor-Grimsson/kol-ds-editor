
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'




// Canvas starts empty. Click inside the letter to seed a DLA aggregate at
// that exact point. Each click spawns its own colored aggregate with its own
// walkers. Multiple clicks = multiple aggregates competing / filling the glyph.
// This is the brief's "trigger an expression to start growth trapped in the
// shape" in miniature.
export const triggered            = {
  id: '15-triggered',
  name: 'TRIGGERED GROWTH (CLICK)',
  repo: 'composition · interactive',
  summary:
    'Empty on load — only the outline is visible. Click inside the letter to plant a DLA seed at that point and release 60 walkers. Each click adds another seed with its own color. Walkers stick to their own aggregate when they land nearby. Multi-click → multi-layer growth.',
  helps:
    'The literal form of the brief\'s "trigger an expression" flow. User authors growth spatially; multiple triggers build up layered geometry. The scaffold everyone else plugs into.',
  params: [
    { key: 'walkers', type: 'int', min: 10, max: 300, step: 10, default: 60, label: 'walkers' },
    { key: 'cellSize', type: 'int', min: 4, max: 40, default: 14, label: 'cell size' },
    { key: 'step', type: 'range', min: 0.5, max: 5, step: 0.1, default: 1.5, label: 'step' },
    { key: 'stickDist', type: 'range', min: 1, max: 10, step: 0.5, default: 3, label: 'stick dist' },
    // EDITOR PORT: seeds planted at init — the labs trigger was a canvas
    // click, but the editor host draws into an offscreen buffer that never
    // receives pointer events. 0 restores the labs empty-until-clicked state.
    { key: 'autoSeeds', type: 'int', min: 0, max: 8, default: 3, label: 'auto seeds' },
  ],
  init({ canvas, ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { walkers: walkersPerClick, cellSize, step, stickDist } = params

    const stuck          = []
    const walkers           = []
    let seedCounter = 0

    const cs = cellSize
    const gw = Math.ceil(sdf.w / cs) + 1
    const gh = Math.ceil(sdf.h / cs) + 1
    const grid             = new Array(gw * gh)
    for (let i = 0; i < grid.length; i++) grid[i] = []
    const gi = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cs))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cs)))

    const SEED_COLORS = ['#f3c9c4', '#8b8fd6', '#f3e7cf', '#b0b4e8', '#e85b3e', '#a8d8b9']

    const plant = (cx        , cy        ) => {
      if (sdf.sample(cx, cy) >= 0) return
      const sid = seedCounter++
      const idx = stuck.length
      stuck.push({ x: cx, y: cy, parent: -1, seed: sid })
      grid[gi(cx, cy)].push(idx)
      for (let i = 0; i < walkersPerClick; i++) {
        const [x, y] = sampleInside(sdf, rng)
        walkers.push({ x, y, seed: sid })
      }
    }

    const onClick = (e            ) => {
      // offsetX/Y is canvas-local pre-transform, survives the camera's CSS transform
      plant((e.offsetX / canvas.clientWidth) * sdf.w, (e.offsetY / canvas.clientHeight) * sdf.h)
    }
    canvas.addEventListener('click', onClick)

    // EDITOR PORT (see params): plant the auto seeds up front so the growth
    // runs without interaction — the click path above is kept verbatim.
    for (let i = 0; i < (params.autoSeeds ?? 0); i++) {
      const [ax, ay] = sampleInside(sdf, rng)
      plant(ax, ay)
    }

    const rafCleanup = wrapLoop(() => {
      // simulate
      for (const w of walkers) {
        const ang = rng() * Math.PI * 2
        const nx = w.x + Math.cos(ang) * step
        const ny = w.y + Math.sin(ang) * step
        if (sdf.sample(nx, ny) >= 0) continue
        w.x = nx; w.y = ny

        const gx = Math.floor(w.x / cs), gy = Math.floor(w.y / cs)
        let hit = -1
        outer: for (let j = -1; j <= 1; j++) {
          const yy = gy + j
          if (yy < 0 || yy >= gh) continue
          for (let i = -1; i <= 1; i++) {
            const xx = gx + i
            if (xx < 0 || xx >= gw) continue
            const bucket = grid[yy * gw + xx]
            for (let k = 0; k < bucket.length; k++) {
              const s = stuck[bucket[k]]
              const dx = s.x - w.x, dy = s.y - w.y
              if (dx * dx + dy * dy < stickDist * stickDist) { hit = bucket[k]; break outer }
            }
          }
        }
        if (hit >= 0) {
          const idx = stuck.length
          stuck.push({ x: w.x, y: w.y, parent: hit, seed: stuck[hit].seed })
          grid[gi(w.x, w.y)].push(idx)
          const [rx, ry] = sampleInside(sdf, rng)
          w.x = rx; w.y = ry
        }
      }

      // render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.25)', 1.2)

      if (stuck.length === 0) {
        ctx.fillStyle = 'rgba(243, 231, 207, 0.55)'
        ctx.font = '11px ui-monospace, Monaco, monospace'
        ctx.textAlign = 'center'
        ctx.fillText('click inside the letter to seed growth', W / 2, H / 2)
        return
      }

      // walkers tinted by seed
      for (const w of walkers) {
        const color = SEED_COLORS[w.seed % SEED_COLORS.length]
        ctx.fillStyle = color + '44'
        ctx.beginPath()
        ctx.arc(w.x * sx, w.y * sy, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // edges
      ctx.lineWidth = 0.9
      for (const s of stuck) {
        if (s.parent < 0) continue
        const p = stuck[s.parent]
        const color = SEED_COLORS[s.seed % SEED_COLORS.length]
        ctx.strokeStyle = color + 'CC'
        ctx.beginPath()
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(s.x * sx, s.y * sy)
        ctx.stroke()
      }

      // stuck dots
      for (const s of stuck) {
        const color = SEED_COLORS[s.seed % SEED_COLORS.length]
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(s.x * sx, s.y * sy, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    return () => {
      canvas.removeEventListener('click', onClick)
      rafCleanup()
    }
  },
}
