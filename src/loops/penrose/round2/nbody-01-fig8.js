// Figure-8 Three-Body Choreography (Chenciner & Montgomery 2000)
// Three equal-mass bodies trace the same closed figure-8 curve with T/3 phase offset.
// Initial conditions from Chenciner-Montgomery; leapfrog integration.
// Perturb knob adds velocity kick — watch the choreography decay into chaos.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

const PARAMS          = [
  { key: 'G',       type: 'range', min: 0.1,  max: 5,    default: 1,    step: 0.1,  label: 'G' },
  { key: 'dt',      type: 'range', min: 0.001, max: 0.02, default: 0.005, step: 0.001, label: 'timestep' },
  { key: 'substeps',type: 'int',   min: 1,    max: 20,   default: 8,    step: 1,    label: 'sub-steps' },
  { key: 'perturb', type: 'range', min: 0,    max: 0.5,  default: 0,    step: 0.01, label: 'kick' },
  { key: 'trail',   type: 'range', min: 0,    max: 1,    default: 0.6,  step: 0.05, label: 'trail' },
]

// Chenciner-Montgomery figure-8 initial conditions (normalised period T≈6.3259)
// Positions and velocities from Moore 1993 / Chenciner-Montgomery 2000.
const IC_POS                     = [
  [ 0.97000436, -0.24308753],
  [-0.97000436,  0.24308753],
  [ 0,           0         ],
]
const IC_VEL                     = [
  [ 0.93240737/2,  0.86473146/2],
  [ 0.93240737/2,  0.86473146/2],
  [-0.93240737,   -0.86473146  ],
]



export const r2_nbody_01_fig8            = {
  id: 'r2-nbody-01-fig8',
  name: 'FIGURE-8 CHOREOGRAPHY',
  repo: 'Chenciner & Montgomery 2000; Moore 1993',
  summary: 'Three equal-mass bodies on the Chenciner-Montgomery figure-8 orbit. Leapfrog integration; perturb knob kicks velocities to watch the choreography shatter.',
  helps: 'Pure mathematical perpetual motion — the 8-curve maps naturally to letterforms with two enclosed bowls.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const cx = sdf.w / 2, cy = sdf.h / 2
    // Scale the orbit to ~40% of the smaller glyph dimension
    const scale = Math.min(sdf.w, sdf.h) * 0.38

    const bodies         = IC_POS.map(([x, y], i) => ({
      x: cx + x * scale,
      y: cy + y * scale,
      vx: IC_VEL[i][0],
      vy: IC_VEL[i][1],
      m: 1,
    }))

    // Apply one-time random kick scaled by perturb param (captured at init)
    const kick0 = num(params, 'perturb', 0)
    if (kick0 > 0) {
      for (const b of bodies) {
        b.vx += (rng() - 0.5) * kick0
        b.vy += (rng() - 0.5) * kick0
      }
    }

    const sx = W / sdf.w, sy = H / sdf.h
    const N = bodies.length

    const colors = ['#e8a87c', '#7cc8e8', '#a8e87c']
    // Trail canvas for motion blur effect — paint trails directly on ctx
    const trailAlpha = () => 1 - num(params, 'trail', 0.6) * 0.88

    function accel(bs        )                     {
      const G = num(params, 'G', 1)
      const eps2 = 1 // softening²
      const a                     = bs.map(() => [0, 0])
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = bs[j].x - bs[i].x
          const dy = bs[j].y - bs[i].y
          const r2 = dx * dx + dy * dy + eps2
          const r3 = r2 * Math.sqrt(r2)
          const f = G * bs[i].m * bs[j].m / r3
          a[i][0] += f * dx; a[i][1] += f * dy
          a[j][0] -= f * dx; a[j][1] -= f * dy
        }
      }
      return a
    }

    return wrapLoop(() => {
      const dt = num(params, 'dt', 0.005)
      const substeps = num(params, 'substeps', 8) | 0

      // Leapfrog (kick-drift-kick) substeps
      for (let s = 0; s < substeps; s++) {
        const a = accel(bodies)
        for (let i = 0; i < N; i++) {
          bodies[i].vx += a[i][0] * dt * 0.5
          bodies[i].vy += a[i][1] * dt * 0.5
        }
        for (let i = 0; i < N; i++) {
          bodies[i].x += bodies[i].vx * dt
          bodies[i].y += bodies[i].vy * dt
        }
        const a2 = accel(bodies)
        for (let i = 0; i < N; i++) {
          bodies[i].vx += a2[i][0] * dt * 0.5
          bodies[i].vy += a2[i][1] * dt * 0.5
        }
      }

      // Trail fade
      ctx.fillStyle = `rgba(10,11,20,${trailAlpha().toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.12)', 1)

      // Draw bodies and connecting lines
      ctx.lineWidth = 0.6
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const ax = bodies[i].x * sx, ay = bodies[i].y * sy
          const bx = bodies[j].x * sx, by = bodies[j].y * sy
          ctx.strokeStyle = 'rgba(180,180,220,0.18)'
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
        }
      }

      for (let i = 0; i < N; i++) {
        const bx = bodies[i].x * sx, by = bodies[i].y * sy
        ctx.beginPath()
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = colors[i]
        ctx.fill()
      }
    })
  },
}
