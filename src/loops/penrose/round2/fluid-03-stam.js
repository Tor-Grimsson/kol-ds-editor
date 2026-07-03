

import { num, bool } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

const PARAMS          = [
  { key: 'visc', type: 'range', min: 0, max: 0.0004, default: 0.00005, step: 0.00001, label: 'viscosity' },
  { key: 'conf', type: 'range', min: 0, max: 8, default: 2.5, step: 0.25, label: 'vort confinement ε' },
  { key: 'res', type: 'int', min: 48, max: 128, default: 80, step: 8, label: 'grid res' },
  { key: 'splat', type: 'range', min: 0.1, max: 1.5, default: 0.6, step: 0.05, label: 'splat strength' },
  { key: 'dyefade', type: 'boolean', default: true, label: 'dye fade' },
]

export const r2_fluid_03_stam            = {
  id: 'r2-fluid-03-stam',
  name: 'Stam Stable Fluids + Vorticity Confinement',
  repo: 'Stam 1999 / Fedkiw 2001 — stable fluids + vorticity confinement',
  summary:
    'Semi-Lagrangian incompressible solver with Helmholtz-Hodge pressure projection. Vorticity confinement (Fedkiw 2001) re-energizes the fine swirl numerical diffusion destroys, filling the glyph with persistent nested eddies.',
  helps:
    'Smoke-trapped-in-glass aesthetic — tight vortex tubes spiral inward from stroke edges when ε > 2.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const visc = num(params, 'visc', 0.00005)
    const confEps = num(params, 'conf', 2.5)
    const N = num(params, 'res', 80)
    const splatStr = num(params, 'splat', 0.6)
    const dyeFade = bool(params, 'dyefade', true)

    const scaleX = W / N, scaleY = H / (N * H / W)
    const NY = Math.round(N * H / W)
    const sz = (N + 2) * (NY + 2)

    const u = new Float32Array(sz), v = new Float32Array(sz)
    const u0 = new Float32Array(sz), v0 = new Float32Array(sz)
    const dens = new Float32Array(sz), dens0 = new Float32Array(sz)
    const solid = new Uint8Array(sz)

    const IX = (i        , j        ) => (i + 1) + (j + 1) * (N + 2)

    // Build solid mask from SDF
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < N; i++) {
        const sx = (i + 0.5) / N * sdf.w
        const sy = (j + 0.5) / NY * sdf.h
        solid[IX(i, j)] = sdf.sample(sx, sy) >= 0 ? 1 : 0
      }
    }

    const setBnd = (b        , x              ) => {
      for (let i = 0; i < N; i++) {
        x[IX(-1, i)] = b === 1 ? -x[IX(0, i)] : x[IX(0, i)]
        x[IX(N, i)] = b === 1 ? -x[IX(N - 1, i)] : x[IX(N - 1, i)]
        x[IX(i, -1)] = b === 2 ? -x[IX(i, 0)] : x[IX(i, 0)]
        x[IX(i, NY)] = b === 2 ? -x[IX(i, NY - 1)] : x[IX(i, NY - 1)]
      }
      // Apply solid mask — zero velocity at solid cells
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          if (solid[IX(i, j)]) { x[IX(i, j)] = 0 }
        }
      }
    }

    const linSolve = (b        , x              , x0              , a        , c        , iter = 20) => {
      const ic = 1 / c
      for (let k = 0; k < iter; k++) {
        for (let j = 0; j < NY; j++) {
          for (let i = 0; i < N; i++) {
            if (solid[IX(i, j)]) continue
            x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) * ic
          }
        }
        setBnd(b, x)
      }
    }

    const diffuse = (b        , x              , x0              , diff        , dt        ) => {
      const a = dt * diff * N * NY
      linSolve(b, x, x0, a, 1 + 4 * a)
    }

    const advect = (b        , d              , d0              , uu              , vv              , dt        ) => {
      const dt0x = dt * N, dt0y = dt * NY
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          if (solid[IX(i, j)]) continue
          let x = i - dt0x * uu[IX(i, j)]
          let y = j - dt0y * vv[IX(i, j)]
          x = Math.max(0.5, Math.min(N - 0.5, x))
          y = Math.max(0.5, Math.min(NY - 0.5, y))
          const i0 = Math.floor(x), i1 = i0 + 1
          const j0 = Math.floor(y), j1 = j0 + 1
          const s1 = x - i0, s0 = 1 - s1
          const t1 = y - j0, t0 = 1 - t1
          d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) + s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)])
        }
      }
      setBnd(b, d)
    }

    const project = (uu              , vv              , p              , div              ) => {
      const hx = 1 / N, hy = 1 / NY
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          if (solid[IX(i, j)]) continue
          div[IX(i, j)] = -0.5 * (hx * (uu[IX(i + 1, j)] - uu[IX(i - 1, j)]) + hy * (vv[IX(i, j + 1)] - vv[IX(i, j - 1)]))
          p[IX(i, j)] = 0
        }
      }
      setBnd(0, div); setBnd(0, p)
      linSolve(0, p, div, 1, 4, 40)
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          if (solid[IX(i, j)]) continue
          uu[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) * N
          vv[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) * NY
        }
      }
      setBnd(1, uu); setBnd(2, vv)
    }

    const p = new Float32Array(sz), div = new Float32Array(sz)

    // Random dye source positions inside glyph
    const sources                     = []
    for (let k = 0; k < 5; k++) {
      let tries = 0
      while (tries++ < 100) {
        const si = Math.floor(rng() * N), sj = Math.floor(rng() * NY)
        if (!solid[IX(si, sj)]) { sources.push([si, sj]); break }
      }
    }

    const img = ctx.createImageData(W, H)
    const pixels = img.data
    let prevT = clock.nowSeconds()

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const dt = Math.min(now - prevT, 0.05)
      prevT = now

      // Inject dye + force at sources
      for (const [si, sj] of sources) {
        dens0[IX(si, sj)] += splatStr * 8
        u0[IX(si, sj)] += (rng() - 0.5) * splatStr * 3
        v0[IX(si, sj)] += (rng() - 0.5) * splatStr * 3
      }

      // Velocity step
      u.set(u0); v.set(v0)
      if (visc > 0) { diffuse(1, u0, u, visc, dt); diffuse(2, v0, v, visc, dt) }
      project(u0, v0, p, div)
      advect(1, u, u0, u0, v0, dt); advect(2, v, v0, u0, v0, dt)
      project(u, v, p, div)

      // Vorticity confinement
      if (confEps > 0.01) {
        for (let j = 1; j < NY - 1; j++) {
          for (let i = 1; i < N - 1; i++) {
            if (solid[IX(i, j)]) continue
            const curl = (v[IX(i + 1, j)] - v[IX(i - 1, j)]) * 0.5 * N - (u[IX(i, j + 1)] - u[IX(i, j - 1)]) * 0.5 * NY
            const lL = Math.abs((v[IX(i, j)] - v[IX(i - 1, j)]) * N - (u[IX(i, j)] - u[IX(i, j - 1)]) * NY)
            const lR = Math.abs((v[IX(i + 1, j)] - v[IX(i, j)]) * N - (u[IX(i + 1, j)] - u[IX(i + 1, j - 1)]) * NY)
            const lB = Math.abs((v[IX(i, j - 1)] - v[IX(i - 1, j - 1)]) * N - (u[IX(i, j)] - u[IX(i, j - 1)]) * NY)
            const lT = Math.abs((v[IX(i, j + 1)] - v[IX(i - 1, j + 1)]) * N - (u[IX(i, j + 2)] - u[IX(i, j + 1)]) * NY)
            const gx = (lR - lL) * 0.5
            const gy = (lT - lB) * 0.5
            const gm = Math.hypot(gx, gy) + 1e-6
            u[IX(i, j)] += confEps * dt * (gy / gm) * curl
            v[IX(i, j)] -= confEps * dt * (gx / gm) * curl
          }
        }
        setBnd(1, u); setBnd(2, v)
      }
      u0.fill(0); v0.fill(0)

      // Density step
      diffuse(0, dens0, dens, visc * 0.1, dt)
      advect(0, dens, dens0, u, v, dt)
      if (dyeFade) for (let n = 0; n < sz; n++) dens[n] *= 0.993
      dens0.fill(0)

      // Render density to ImageData
      const cw = Math.ceil(scaleX), ch = Math.ceil(scaleY)
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < N; i++) {
          if (solid[IX(i, j)]) continue
          const d = Math.min(1, dens[IX(i, j)] * 0.8)
          const r = Math.round(d * 255 * 0.85)
          const g = Math.round(d * 190)
          const b = Math.round(d * 255 * 0.7 + (1 - d) * 40)
          const a = Math.round(d * 220)
          const px0 = Math.round(i * scaleX), py0 = Math.round(j * scaleY)
          for (let dy = 0; dy < ch; dy++) {
            for (let dx = 0; dx < cw; dx++) {
              const pidx = ((py0 + dy) * W + (px0 + dx)) * 4
              if (pidx + 3 < pixels.length) {
                pixels[pidx] = r; pixels[pidx + 1] = g; pixels[pidx + 2] = b; pixels[pidx + 3] = a
              }
            }
          }
        }
      }

      clear(ctx, W, H)
      ctx.putImageData(img, 0, 0)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
