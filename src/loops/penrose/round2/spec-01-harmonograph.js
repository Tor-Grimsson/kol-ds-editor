

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Damped Harmonograph — two-pendulum Bowditch/Blackburn curve with exponential decay.
// Each axis gets two sinusoidal components so cross-contamination produces the rotary effect.
// Ref: https://paulbourke.net/geometry/harmonograph/

const PARAMS          = [
  { key: 'f1', type: 'range', min: 1, max: 7, default: 3, step: 0.05, label: 'freq 1' },
  { key: 'f2', type: 'range', min: 1, max: 7, default: 4, step: 0.05, label: 'freq 2' },
  { key: 'phi', type: 'range', min: 0, max: 6.28, default: 1.57, step: 0.05, label: 'phase' },
  { key: 'damp', type: 'range', min: 0, max: 0.15, default: 0.018, step: 0.001 },
  { key: 'trail', type: 'int', min: 200, max: 4000, default: 1800, step: 100 },
]

const TWO_PI = Math.PI * 2

export const r2_spec_01_harmonograph            = {
  id: 'r2-spec-01-harmonograph',
  name: 'DAMPED HARMONOGRAPH',
  repo: 'Bowditch 1815 · Blackburn 1844 · paulbourke.net/geometry/harmonograph',
  summary: 'Two pendulums trace a Bowditch curve with exponential damping — quasi-periodic figures spiral inward, reset on loop.',
  helps: 'Classic time-traced analog apparatus; the spiral-in maps the letterform to a breathing-out motion.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    // Random phase seeds per run, held constant across param changes for stability
    const p1 = rng() * TWO_PI
    const p2 = rng() * TWO_PI
    const p3 = rng() * TWO_PI
    const p4 = rng() * TWO_PI

    const R = Math.min(W, H) * 0.42
    const CX = W / 2
    const CY = H / 2
    // How many seconds before decay brings amplitude below 5 % — controls loop period
    const PERIOD = 22

    return wrapLoop(() => {
      const f1 = num(params, 'f1', 3)
      const f2 = num(params, 'f2', 4)
      const phi = num(params, 'phi', 1.57)
      const damp = num(params, 'damp', 0.018)
      const trail = num(params, 'trail', 1800)

      // t cycles 0..PERIOD, driving the full decay arc each period
      const raw = clock.nowSeconds()
      const t0 = raw % PERIOD

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const dt = PERIOD / trail
      ctx.lineWidth = 1.0

      for (let i = 0; i < trail - 1; i++) {
        const ta = t0 - i * dt
        const tb = ta - dt
        if (ta < 0 || tb < 0) continue

        const ea = Math.exp(-damp * ta)
        const eb = Math.exp(-damp * tb)

        // Two-component Bowditch per axis
        const xa = R * (0.6 * Math.sin(f1 * ta + p1) * ea + 0.4 * Math.sin(f2 * ta + p2) * ea)
        const ya = R * (0.6 * Math.sin(f2 * ta + phi + p3) * ea + 0.4 * Math.sin(f1 * ta + p4) * ea)
        const xb = R * (0.6 * Math.sin(f1 * tb + p1) * eb + 0.4 * Math.sin(f2 * tb + p2) * eb)
        const yb = R * (0.6 * Math.sin(f2 * tb + phi + p3) * eb + 0.4 * Math.sin(f1 * tb + p4) * eb)

        const px0 = CX + xa
        const py0 = CY + ya
        const px1 = CX + xb
        const py1 = CY + yb

        // Clip to SDF interior
        if (sdf.sample(px0 * sdf.w / W, py0 * sdf.h / H) > 2) continue

        const age = i / trail
        const alpha = (1 - age) * 0.85 * ea
        const hue = 190 + (ta / PERIOD) * 60
        ctx.strokeStyle = `hsla(${hue.toFixed(0)},75%,72%,${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.moveTo(px0, py0)
        ctx.lineTo(px1, py1)
        ctx.stroke()
      }
    })
  },
}
