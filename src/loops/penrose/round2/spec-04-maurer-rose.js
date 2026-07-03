

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Maurer Rose — chord diagram overlaid on a rose curve r=sin(nθ).
// Connect 360 points at angular steps of d degrees; animate d for continuous morphing.
// Ref: Maurer 1987 "A Rose Is a Rose" · AMM 94(7):631–645

const PARAMS          = [
  { key: 'n', type: 'int', min: 2, max: 9, default: 4, label: 'petals n' },
  { key: 'd', type: 'range', min: 1, max: 179, default: 71, step: 0.5, label: 'chord step d°' },
  { key: 'drift', type: 'range', min: 0, max: 0.5, default: 0.06, step: 0.01, label: 'd drift/s' },
  { key: 'alpha', type: 'range', min: 0.1, max: 1.0, default: 0.55, step: 0.05, label: 'opacity' },
]

const DEG = Math.PI / 180

export const r2_spec_04_maurer_rose            = {
  id: 'r2-spec-04-maurer-rose',
  name: 'MAURER ROSE',
  repo: 'Maurer 1987 · AMM 94(7):631–645 · en.wikipedia.org/wiki/Maurer_rose',
  summary: 'Chord diagram on rose r=sin(nθ); d drifts per second morphing explosive interference geometries continuously.',
  helps: 'Extreme complexity-to-code ratio — two ints produce wildly different lattice fills inside the glyph.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const R = Math.min(W, H) * 0.44
    const CX = W / 2
    const CY = H / 2

    return wrapLoop(() => {
      const n = num(params, 'n', 4)
      const dBase = num(params, 'd', 71)
      const drift = num(params, 'drift', 0.06)
      const opac = num(params, 'alpha', 0.55)

      // d drifts over time, oscillating around dBase
      const t = clock.nowSeconds()
      const dCurrent = dBase + Math.sin(t * drift * Math.PI) * dBase * 0.3

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // Precompute 361 rose points
      const PX = new Float32Array(361)
      const PY = new Float32Array(361)
      for (let k = 0; k <= 360; k++) {
        const theta = k * dCurrent * DEG
        const r = R * Math.sin(n * theta)
        PX[k] = CX + r * Math.cos(theta)
        PY[k] = CY + r * Math.sin(theta)
      }

      ctx.lineWidth = 0.7

      for (let k = 0; k < 360; k++) {
        const px0 = PX[k]
        const py0 = PY[k]
        const px1 = PX[k + 1]
        const py1 = PY[k + 1]

        // Only draw chords where at least one endpoint is inside the glyph
        const in0 = sdf.sample(px0 * sdf.w / W, py0 * sdf.h / H) < 0
        const in1 = sdf.sample(px1 * sdf.w / W, py1 * sdf.h / H) < 0
        if (!in0 && !in1) continue

        const hue = 280 + (k / 360) * 120
        ctx.strokeStyle = `hsla(${hue.toFixed(0)},75%,68%,${opac.toFixed(2)})`
        ctx.beginPath()
        ctx.moveTo(px0, py0)
        ctx.lineTo(px1, py1)
        ctx.stroke()
      }

      // Draw the rose envelope on top, thin
      ctx.strokeStyle = `rgba(240,220,180,0.4)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let i = 0; i <= 720; i++) {
        const theta = (i / 720) * Math.PI * 2
        const r = R * Math.sin(n * theta)
        const x = CX + r * Math.cos(theta)
        const y = CY + r * Math.sin(theta)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
  },
}
