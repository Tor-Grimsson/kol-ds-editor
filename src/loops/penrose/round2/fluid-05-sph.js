

import { num, bool } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'count', type: 'int', min: 100, max: 1600, default: 600, step: 100, label: 'particles' },
  { key: 'stiff', type: 'range', min: 10, max: 400, default: 80, step: 10, label: 'stiffness k' },
  { key: 'visc', type: 'range', min: 0.01, max: 1.5, default: 0.3, step: 0.05, label: 'viscosity μ' },
  { key: 'gravity', type: 'range', min: 0, max: 2, default: 0.4, step: 0.1, label: 'gravity' },
  { key: 'trails', type: 'boolean', default: false, label: 'trails' },
]

export const r2_fluid_05_sph            = {
  id: 'r2-fluid-05-sph',
  name: 'SPH — Smoothed Particle Hydrodynamics',
  repo: 'Müller, Charypar & Gross 2003 · SCA 2003',
  summary:
    'Lagrangian SPH particle fluid — density, pressure, and viscosity forces summed via poly6/spiky kernels. Particles pool against glyph boundaries and slosh through narrow letter strokes like ink.',
  helps:
    'Ink-in-water flow — particles pile on inner glyph curves, surface tension blobs cohere, streams thread through stroke gaps.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const COUNT = num(params, 'count', 600)
    const stiff = num(params, 'stiff', 80)
    const mu = num(params, 'visc', 0.3)
    const gravY = num(params, 'gravity', 0.4)
    const trails = bool(params, 'trails', false)

    const sx = W / sdf.w, sy = H / sdf.h

    // Smoothing length in canvas coords
    const h = Math.min(W, H) * 0.045
    const h2 = h * h
    const REST_DENSITY = 1.0
    const MASS = 1.0
    const DT = 0.008

    const px = new Float32Array(COUNT)
    const py = new Float32Array(COUNT)
    const vx = new Float32Array(COUNT)
    const vy = new Float32Array(COUNT)
    const density = new Float32Array(COUNT)
    const pressure = new Float32Array(COUNT)

    // Seed particles inside glyph
    for (let i = 0; i < COUNT; i++) {
      const [gx, gy] = sampleInside(sdf, rng)
      px[i] = gx * sx
      py[i] = gy * sy
      vx[i] = (rng() - 0.5) * 0.5
      vy[i] = (rng() - 0.5) * 0.5
    }

    // Spatial hash grid for neighbor lookup
    const cellSize = h
    const gw = Math.ceil(W / cellSize) + 2
    const gh = Math.ceil(H / cellSize) + 2
    const gridCells             = []
    const gridReset = () => { for (let i = 0; i < gw * gh; i++) gridCells[i] = [] }
    const gidx = (x        , y        ) =>
      Math.max(0, Math.min(gh - 1, Math.floor(y / cellSize))) * gw +
      Math.max(0, Math.min(gw - 1, Math.floor(x / cellSize)))
    gridReset()

    // Kernels
    const poly6 = (r2        ) => {
      if (r2 >= h2) return 0
      const d = h2 - r2
      return (315 / (64 * Math.PI * Math.pow(h, 9))) * d * d * d
    }
    const spikyGrad = (r        ) => {
      if (r <= 0 || r >= h) return 0
      const d = h - r
      return -(45 / (Math.PI * Math.pow(h, 6))) * d * d
    }
    const viscLaplacian = (r        ) => {
      if (r >= h) return 0
      return (45 / (Math.PI * Math.pow(h, 6))) * (h - r)
    }

    const TWO_PI = Math.PI * 2
    let prevT = clock.nowSeconds()

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const elapsed = Math.min(now - prevT, 0.05)
      prevT = now
      const steps = Math.max(1, Math.round(elapsed / DT))

      for (let _s = 0; _s < steps; _s++) {
        // Rebuild spatial grid
        gridReset()
        for (let i = 0; i < COUNT; i++) gridCells[gidx(px[i], py[i])].push(i)

        // Density + pressure
        for (let i = 0; i < COUNT; i++) {
          let rho = 0
          const gi = Math.floor(px[i] / cellSize), gj = Math.floor(py[i] / cellSize)
          for (let dj = -2; dj <= 2; dj++) {
            for (let di = -2; di <= 2; di++) {
              const ci = gi + di, cj = gj + dj
              if (ci < 0 || ci >= gw || cj < 0 || cj >= gh) continue
              for (const j of gridCells[cj * gw + ci]) {
                const dx = px[i] - px[j], dy = py[i] - py[j]
                rho += MASS * poly6(dx * dx + dy * dy)
              }
            }
          }
          density[i] = rho
          pressure[i] = stiff * (rho - REST_DENSITY)
        }

        // Forces
        const fx = new Float32Array(COUNT)
        const fy = new Float32Array(COUNT)
        for (let i = 0; i < COUNT; i++) {
          const gi = Math.floor(px[i] / cellSize), gj = Math.floor(py[i] / cellSize)
          for (let dj = -2; dj <= 2; dj++) {
            for (let di = -2; di <= 2; di++) {
              const ci = gi + di, cj = gj + dj
              if (ci < 0 || ci >= gw || cj < 0 || cj >= gh) continue
              for (const j of gridCells[cj * gw + ci]) {
                if (i === j) continue
                const dx = px[i] - px[j], dy = py[i] - py[j]
                const r = Math.hypot(dx, dy)
                if (r >= h || r < 1e-6) continue
                const nx = dx / r, ny = dy / r
                // Pressure
                const pf = -MASS * (pressure[i] + pressure[j]) / (2 * density[j]) * spikyGrad(r)
                fx[i] += pf * nx; fy[i] += pf * ny
                // Viscosity
                const vf = mu * MASS * viscLaplacian(r) / density[j]
                fx[i] += vf * (vx[j] - vx[i]); fy[i] += vf * (vy[j] - vy[i])
              }
            }
          }
          fy[i] += gravY * density[i] // gravity
        }

        // Integrate + SDF boundary
        for (let i = 0; i < COUNT; i++) {
          const rho = Math.max(0.001, density[i])
          vx[i] += DT * fx[i] / rho
          vy[i] += DT * fy[i] / rho
          const nx = px[i] + DT * vx[i]
          const ny = py[i] + DT * vy[i]
          const gx = nx / sx, gy = ny / sy
          const d = sdf.sample(gx, gy)
          if (d < 0) {
            px[i] = nx; py[i] = ny
          } else {
            // Reflect normal component at boundary
            const [grx, gry] = [
              sdf.sample(gx + 1, gy) - sdf.sample(gx - 1, gy),
              sdf.sample(gx, gy + 1) - sdf.sample(gx, gy - 1),
            ]
            const gm = Math.hypot(grx, gry) || 1
            const ngx = grx / gm, ngy = gry / gm
            const dot = vx[i] * ngx + vy[i] * ngy
            vx[i] -= 1.8 * dot * ngx
            vy[i] -= 1.8 * dot * ngy
            vx[i] *= 0.4; vy[i] *= 0.4
          }
        }
      }

      // Render
      if (trails) {
        ctx.fillStyle = 'rgba(10, 11, 20, 0.15)'
        ctx.fillRect(0, 0, W, H)
      } else {
        clear(ctx, W, H)
      }
      strokeOutline(ctx, sdf, W, H)

      for (let i = 0; i < COUNT; i++) {
        const speed = Math.hypot(vx[i], vy[i])
        const t = Math.min(1, speed / 5)
        const r = Math.round(100 + 155 * t)
        const g = Math.round(160 - 60 * t)
        const b = Math.round(240 - 140 * t)
        const radius = Math.max(1.2, h * 0.18 * (density[i] / REST_DENSITY))
        ctx.fillStyle = `rgba(${r},${g},${b},0.75)`
        ctx.beginPath()
        ctx.arc(px[i], py[i], radius, 0, TWO_PI)
        ctx.fill()
      }
    })
  },
}
