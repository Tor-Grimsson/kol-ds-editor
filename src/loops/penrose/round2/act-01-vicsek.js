// Vicsek polar bands (Grégoire & Chaté 2004)
// Polar alignment with noise tuned to the coexistence window → propagating
// high-density bands sweep through the glyph interior.
// Key deviation from Boids: no cohesion, no separation — only angle-averaging.
// The interesting regime is near the order–disorder transition where bands nucleate.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'N',     type: 'int',   min: 300,  max: 3000, default: 1200, step: 100, label: 'particles' },
  { key: 'v0',    type: 'range', min: 0.2,  max: 3.0,  default: 0.8,  step: 0.1, label: 'self-prop speed' },
  { key: 'noise', type: 'range', min: 0.0,  max: 1.0,  default: 0.38, step: 0.02, label: 'noise η' },
  { key: 'R',     type: 'range', min: 4,    max: 40,   default: 16,   step: 2,   label: 'align radius' },
  { key: 'trail', type: 'range', min: 0.0,  max: 1.0,  default: 0.3,  step: 0.05, label: 'trail length' },
]



export const r2_act_01_vicsek            = {
  id: 'r2-act-01-vicsek',
  name: 'VICSEK BANDS',
  repo: 'Vicsek 1995 PRL; Grégoire & Chaté 2004 PRL',
  summary: 'Polar alignment + noise in the coexistence window produces propagating high-density bands. No cohesion — pure direction averaging.',
  helps: 'Density stripes sweep the glyph interior; letterform reads as a standing wave reactor.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    let N = num(params, 'N', 1200)
    let v0 = num(params, 'v0', 0.8)
    let eta = num(params, 'noise', 0.38)
    let R = num(params, 'R', 16)

    const ps             = []
    for (let i = 0; i < N; i++) {
      const [x, y] = sampleInside(sdf, rng)
      ps.push({ x, y, a: rng() * Math.PI * 2 })
    }

    // spatial grid
    const cellSize = () => Math.max(R, 8)

    return wrapLoop(() => {
      N   = num(params, 'N', 1200)
      v0  = num(params, 'v0', 0.8)
      eta = num(params, 'noise', 0.38)
      R   = num(params, 'R', 16)

      while (ps.length < N) {
        const [x, y] = sampleInside(sdf, rng)
        ps.push({ x, y, a: rng() * Math.PI * 2 })
      }
      if (ps.length > N) ps.length = N

      const cs = cellSize()
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = Array.from({ length: gw * gh }, () => [])
      for (let i = 0; i < ps.length; i++) {
        const gx = Math.max(0, Math.min(gw - 1, (ps[i].x / cs) | 0))
        const gy = Math.max(0, Math.min(gh - 1, (ps[i].y / cs) | 0))
        grid[gy * gw + gx].push(i)
      }

      const half = eta * Math.PI
      const R2 = R * R

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        let sx2 = 0, sy2 = 0
        const gx = (p.x / cs) | 0, gy = (p.y / cs) | 0
        for (let dj = -1; dj <= 1; dj++) {
          const row = gy + dj
          if (row < 0 || row >= gh) continue
          for (let di = -1; di <= 1; di++) {
            const col = gx + di
            if (col < 0 || col >= gw) continue
            for (const j of grid[row * gw + col]) {
              const dx = ps[j].x - p.x, dy = ps[j].y - p.y
              if (dx * dx + dy * dy > R2) continue
              sx2 += Math.cos(ps[j].a)
              sy2 += Math.sin(ps[j].a)
            }
          }
        }
        const mean = Math.atan2(sy2, sx2)
        p.a = mean + (rng() - 0.5) * 2 * half

        // advance
        const nx = p.x + Math.cos(p.a) * v0
        const ny = p.y + Math.sin(p.a) * v0

        if (sdf.sample(nx, ny) < 0) {
          p.x = nx; p.y = ny
        } else {
          // reflect off boundary
          const [gX, gY] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gX, gY) || 1
          const dot = Math.cos(p.a) * gX / gm + Math.sin(p.a) * gY / gm
          const rx = Math.cos(p.a) - 2 * dot * gX / gm
          const ry = Math.sin(p.a) - 2 * dot * gY / gm
          p.a = Math.atan2(ry, rx)
        }
      }

      const trail = num(params, 'trail', 0.3)
      const alpha = 1 - trail * 0.85
      ctx.fillStyle = `rgba(10,11,20,${alpha.toFixed(2)})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      // draw as speed-coloured dots
      for (const p of ps) {
        const hue = ((p.a / Math.PI) * 180 + 360) % 360
        ctx.fillStyle = `hsla(${hue.toFixed(0)},80%,65%,0.55)`
        ctx.fillRect(p.x * sx - 1, p.y * sy - 1, 2, 2)
      }
    })
  },
}
