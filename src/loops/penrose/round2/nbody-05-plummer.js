// Plummer Sphere — Core Collapse & Gravothermal Oscillations
// N particles seeded in 2D Plummer profile inside glyph SDF.
// Direct O(N²) gravity (N≤150). Core contracts → bright dense knot;
// halo streams outward → SDF wall reflects. Drama peaks at core collapse.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'N',       type: 'int',   min: 20,  max: 150, default: 80,   step: 5,    label: 'particles' },
  { key: 'G',       type: 'range', min: 0.05, max: 3,  default: 0.6,  step: 0.05, label: 'G' },
  { key: 'dt',      type: 'range', min: 0.002, max: 0.05, default: 0.01, step: 0.001, label: 'timestep' },
  { key: 'eps',     type: 'range', min: 0.5, max: 10,  default: 3,    step: 0.5,  label: 'softening' },
  { key: 'wall',    type: 'range', min: 0,   max: 2,   default: 0.6,  step: 0.1,  label: 'wall strength' },
  { key: 'trail',   type: 'range', min: 0,   max: 1,   default: 0.7,  step: 0.05, label: 'trail' },
]



// Sample 2D Plummer profile via inverse CDF
// Plummer 2D: r ~ a * √(u^(-2/3) - 1) for uniform u, scale radius a
function plummerSample(rng              , cx        , cy        , a        )                   {
  const u = rng()
  const r = a * Math.sqrt(Math.pow(u, -2 / 3) - 1)
  const angle = rng() * Math.PI * 2
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

export const r2_nbody_05_plummer            = {
  id: 'r2-nbody-05-plummer',
  name: 'PLUMMER CORE COLLAPSE',
  repo: 'Plummer 1911; Hénon 1961; Aarseth 1999',
  summary: 'Plummer-sphere globular cluster in direct O(N²) gravity. Core contracts toward glyph centroid while halo expands and reflects off SDF boundary. Core-collapse → binary heat → re-expansion cycle.',
  helps: 'Zoom to glyph center to see tight binary-like pairs; zoom out to see diffuse halo — maximum cross-scale interest.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const cx = sdf.w / 2, cy = sdf.h / 2
    const plummerA = Math.min(sdf.w, sdf.h) * 0.18

    let N = num(params, 'N', 80) | 0
    const particles             = []

    // Sample Plummer positions, assign virial velocities
    function init() {
      particles.length = 0
      const G = num(params, 'G', 0.6)
      const totalM = N
      // Virial velocity scale: v ~ sqrt(G*M / (2*a))
      const vScale = Math.sqrt(G * totalM / (2 * plummerA)) * 0.5
      for (let i = 0; i < N; i++) {
        // Reject samples outside SDF
        let px = cx, py = cy
        for (let t = 0; t < 32; t++) {
          const [tx, ty] = plummerSample(rng, cx, cy, plummerA)
          if (sdf.sample(tx, ty) < 0) { px = tx; py = ty; break }
        }
        // Random isotropic velocity
        const va = rng() * Math.PI * 2
        const vr = vScale * Math.sqrt(-2 * Math.log(rng() + 1e-9))
        particles.push({
          x: px, y: py,
          vx: vr * Math.cos(va),
          vy: vr * Math.sin(va),
          m: 1,
        })
      }
    }
    init()

    return wrapLoop(() => {
      const newN = num(params, 'N', 80) | 0
      if (newN !== N) {
        N = newN
        init()
        return
      }

      const G    = num(params, 'G', 0.6)
      const dt   = num(params, 'dt', 0.01)
      const eps2 = Math.pow(num(params, 'eps', 3), 2)
      const wallStr = num(params, 'wall', 0.6)
      const Np = particles.length

      const axArr = new Float64Array(Np)
      const ayArr = new Float64Array(Np)

      // O(N²) pairwise gravity
      for (let i = 0; i < Np; i++) {
        for (let j = i + 1; j < Np; j++) {
          const dx = particles[j].x - particles[i].x
          const dy = particles[j].y - particles[i].y
          const r2 = dx * dx + dy * dy + eps2
          const r3 = r2 * Math.sqrt(r2)
          const fg = G * particles[i].m * particles[j].m / r3
          axArr[i] += fg * dx; ayArr[i] += fg * dy
          axArr[j] -= fg * dx; ayArr[j] -= fg * dy
        }
      }

      // SDF boundary wall
      for (let i = 0; i < Np; i++) {
        const p = particles[i]
        const s = sdf.sample(p.x, p.y)
        if (s > -3) {
          const [gx, gy] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gx, gy) || 1
          const push = Math.max(0, s + 3) * wallStr
          axArr[i] -= (gx / gm) * push
          ayArr[i] -= (gy / gm) * push
        }
      }

      // Leapfrog (kick-drift-kick)
      const halfDt = dt * 0.5
      for (let i = 0; i < Np; i++) {
        const p = particles[i]
        const im = 1 / p.m
        p.vx += axArr[i] * im * halfDt
        p.vy += ayArr[i] * im * halfDt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // recalculate accel for second half-kick (simplified: reuse same accel)
        p.vx += axArr[i] * im * halfDt
        p.vy += ayArr[i] * im * halfDt
        // Velocity clamp to prevent runaway
        const vmax = Math.min(sdf.w, sdf.h) * 0.4
        const v = Math.hypot(p.vx, p.vy)
        if (v > vmax) { p.vx *= vmax / v; p.vy *= vmax / v }
      }

      const trailA = 1 - num(params, 'trail', 0.7) * 0.92
      ctx.fillStyle = `rgba(10,11,20,${trailA.toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.10)', 1)

      // Draw particles; size and brightness by distance to CoM (core = bright)
      const coreR = plummerA * 0.25
      for (const p of particles) {
        const r = Math.hypot(p.x - cx, p.y - cy)
        const inCore = r < coreR
        const v2 = p.vx * p.vx + p.vy * p.vy
        const hot = Math.min(1, Math.sqrt(v2) / 8)
        const hue = 210 - hot * 180
        const alpha = inCore ? 0.9 : 0.5 - r / (sdf.w * 0.6) * 0.3
        const rad = inCore ? 2.2 : 1.4
        ctx.fillStyle = `hsla(${hue.toFixed(0)},88%,65%,${Math.max(0.15, alpha).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(p.x * sx, p.y * sy, rad, 0, Math.PI * 2)
        ctx.fill()
      }

      // Core glow
      const coreCount = particles.filter(p =>
        Math.hypot(p.x - cx, p.y - cy) < coreR,
      ).length
      if (coreCount > 2) {
        const grd = ctx.createRadialGradient(cx * sx, cy * sy, 0, cx * sx, cy * sy, coreR * sx * 1.5)
        const glowAlpha = Math.min(0.35, coreCount * 0.02)
        grd.addColorStop(0, `rgba(200,220,255,${glowAlpha.toFixed(3)})`)
        grd.addColorStop(1, 'rgba(200,220,255,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(cx * sx, cy * sy, coreR * sx * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
