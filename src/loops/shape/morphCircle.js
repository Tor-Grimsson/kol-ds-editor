import { TAU, lerp, mixHex } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Circle morph — a small half-disc swells into a large dark full disc, then
// mirror-reverses back, rotating once per loop. Everything is driven by
// continuous periodic functions of u, so frame(0) === frame(1) exactly → a
// truly seamless loop. First shape-loop; the gesture is first-calibration —
// tune the radii / spin / colours by eye.
export default {
  id: 'morph-circle',
  label: 'Circle morph',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#16161a' },
    ...FILL_PARAMS,
    { key: 'minR', label: 'Min radius', type: 'range', min: 0.05, max: 0.4, step: 0.01, default: 0.12 },
    { key: 'maxR', label: 'Max radius', type: 'range', min: 0.3, max: 0.62, step: 0.01, default: 0.46 },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: 0, max: 3, step: 1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const span = Math.min(w, h)
    const ease = (1 - Math.cos(u * TAU)) / 2          // 0 → 1 → 0, periodic ⇒ seamless
    const R = lerp(p.minR, p.maxR, ease) * span
    const sweep = lerp(Math.PI, TAU, ease)            // half-disc → full disc
    const a0 = -Math.PI / 2 + u * TAU * Math.round(p.spin) // integer turns ⇒ seamless

    ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, cx, cy, R) : mixHex(p.colA, p.colB, ease)
    ctx.beginPath()
    if (sweep >= TAU - 1e-3) {
      ctx.arc(cx, cy, R, 0, TAU)
    } else {
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, a0, a0 + sweep)
      ctx.closePath()
    }
    ctx.fill()
  },
}
