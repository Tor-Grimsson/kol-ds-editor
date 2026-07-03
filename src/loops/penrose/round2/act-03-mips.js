// Motility-Induced Phase Separation — Active Brownian Particles (Cates & Tailleur 2015)
// Speed decreases with local density → spontaneous condensation into a dense motile
// cluster (the "living droplet") that wanders the glyph. No alignment, no attraction.
// Purely repulsive soft WCA + density-dependent v(ρ).



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'N',     type: 'int',   min: 400,  max: 4000, default: 1800, step: 100, label: 'particles' },
  { key: 'v0',    type: 'range', min: 0.3,  max: 4.0,  default: 1.4,  step: 0.1, label: 'base speed v₀' },
  { key: 'Dr',    type: 'range', min: 0.005, max: 0.2, default: 0.03, step: 0.005, label: 'rot. diffusion Dr' },
  { key: 'rhoM',  type: 'range', min: 0.5,  max: 8.0,  default: 2.5,  step: 0.25, label: 'MIPS density ρ*' },
  { key: 'rep',   type: 'range', min: 0.1,  max: 2.0,  default: 0.7,  step: 0.1,  label: 'repulsion ε' },
]



export const r2_act_03_mips            = {
  id: 'r2-act-03-mips',
  name: 'MIPS / LIVING DROPLET',
  repo: 'Cates & Tailleur Annu. Rev. Condens. Matter 6 219 (2015)',
  summary: 'Active Brownian Particles: density-dependent speed v(ρ) drives phase separation into a dense motile cluster + dilute gas. No alignment — pure activity-driven transition.',
  helps: 'Dense bright droplet wanders glyph interior; thin strokes guide it like a channel.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const scx = W / sdf.w, scy = H / sdf.h

    const ps        = []
    for (let i = 0; i < num(params, 'N', 1800); i++) {
      const [x, y] = sampleInside(sdf, rng)
      ps.push({ x, y, a: rng() * Math.PI * 2 })
    }

    // soft WCA-like: linear repulsion inside sigma=3
    const SIGMA = 3.5
    const SIGMA2 = SIGMA * SIGMA

    return wrapLoop(() => {
      const N    = num(params, 'N', 1800)
      const v0   = num(params, 'v0', 1.4)
      const Dr   = num(params, 'Dr', 0.03)
      const rhoM = num(params, 'rhoM', 2.5)
      const rep  = num(params, 'rep', 0.7)

      while (ps.length < N) {
        const [x, y] = sampleInside(sdf, rng)
        ps.push({ x, y, a: rng() * Math.PI * 2 })
      }
      if (ps.length > N) ps.length = N

      // density grid (coarser) for v(ρ)
      const cD = 8
      const gwD = Math.ceil(sdf.w / cD) + 1
      const ghD = Math.ceil(sdf.h / cD) + 1
      const density = new Float32Array(gwD * ghD)
      for (const p of ps) {
        const gx = Math.max(0, Math.min(gwD - 1, (p.x / cD) | 0))
        const gy = Math.max(0, Math.min(ghD - 1, (p.y / cD) | 0))
        density[gy * gwD + gx]++
      }

      // repulsion grid
      const cs = SIGMA * 2
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = Array.from({ length: gw * gh }, () => [])
      for (let i = 0; i < ps.length; i++) {
        const gx = Math.max(0, Math.min(gw - 1, (ps[i].x / cs) | 0))
        const gy = Math.max(0, Math.min(gh - 1, (ps[i].y / cs) | 0))
        grid[gy * gw + gx].push(i)
      }

      const DT = 0.15
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]

        // local density → modulate speed
        const dgx = Math.max(0, Math.min(gwD - 1, (p.x / cD) | 0))
        const dgy = Math.max(0, Math.min(ghD - 1, (p.y / cD) | 0))
        const rhoLocal = density[dgy * gwD + dgx]
        const v = v0 / (1 + rhoLocal / rhoM)

        // self-propulsion
        let fx = Math.cos(p.a) * v
        let fy = Math.sin(p.a) * v

        // soft repulsion from neighbours
        const gx = (p.x / cs) | 0, gy = (p.y / cs) | 0
        for (let dj = -1; dj <= 1; dj++) {
          const row = gy + dj
          if (row < 0 || row >= gh) continue
          for (let di = -1; di <= 1; di++) {
            const col = gx + di
            if (col < 0 || col >= gw) continue
            for (const j of grid[row * gw + col]) {
              if (j === i) continue
              const dx = p.x - ps[j].x, dy = p.y - ps[j].y
              const d2 = dx * dx + dy * dy
              if (d2 < 1e-6 || d2 > SIGMA2) continue
              const d = Math.sqrt(d2)
              const f = rep * (SIGMA / d - 1)
              fx += (dx / d) * f
              fy += (dy / d) * f
            }
          }
        }

        // rotational diffusion
        p.a += Math.sqrt(2 * Dr) * (rng() - 0.5) * 2 * Math.PI * DT

        const nx = p.x + fx * DT
        const ny = p.y + fy * DT

        if (sdf.sample(nx, ny) < 0) {
          p.x = nx; p.y = ny
        } else {
          const [gX, gY] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gX, gY) || 1
          p.x -= (gX / gm) * v * DT
          p.y -= (gY / gm) * v * DT
          p.a += Math.PI + (rng() - 0.5) * 0.8
        }
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      // Render: brightness encodes local density
      for (const p of ps) {
        const dgx = Math.max(0, Math.min(gwD - 1, (p.x / cD) | 0))
        const dgy = Math.max(0, Math.min(ghD - 1, (p.y / cD) | 0))
        const rhoLocal = density[dgy * gwD + dgx]
        const bright = Math.min(1, rhoLocal / (rhoM * 3))
        const r = Math.round(180 + bright * 65)
        const g = Math.round(140 + bright * 40)
        const b = Math.round(220 + bright * 35)
        ctx.fillStyle = `rgba(${r},${g},${b},0.55)`
        const sz = 1.5 + bright * 1.5
        ctx.fillRect(p.x * scx - sz / 2, p.y * scy - sz / 2, sz, sz)
      }
    })
  },
}
