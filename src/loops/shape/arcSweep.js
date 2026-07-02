import { TAU, mixHex } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Arc sweep — a radar-style wedge sweeping a whole number of turns per loop, with
// a fading trailing fan and a fixed grid. Integer turns ⇒ seamless. The grid-ring
// discs can be filled (off by default) for concentric bands under the sweep.
export default {
  id: 'arc-sweep',
  label: 'Arc sweep',
  group: 'shape',
  kind: '2d',
  duration: 5,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'ring', label: 'Grid', type: 'color', role: 'accent', default: '#2a3550' },
    { key: 'sweep', label: 'Sweep', type: 'color', role: 'fg', default: '#7fd1ff' },
    ...FILL_PARAMS,
    { key: 'ringFill', label: 'Fill rings', type: 'toggle', default: false, tab: 'color' },
    { key: 'ringAlpha', label: 'Fill opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.5, tab: 'color', noRandom: true },
    { key: 'turns', label: 'Turns', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'trail', label: 'Trail', type: 'range', min: 1, max: 9, step: 1, default: 5 },
    { key: 'rings', label: 'Rings', type: 'range', min: 0, max: 6, step: 1, default: 3, noRandom: true },
    { key: 'size', label: 'Reach', type: 'range', min: 0.6, max: 1, step: 0.02, default: 0.92 },
    { key: 'showGrid', label: 'Grid', type: 'toggle', default: true },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) * 0.5 * p.size
    const rings = Math.round(p.rings)

    // Optional disc fill — concentric bands at the grid radii, largest → smallest
    // so inner discs layer over outer ones; grid + sweep draw on top. Off by
    // default ⇒ existing presets are unchanged.
    if (p.ringFill && rings > 0) {
      const fa = p.ringAlpha ?? 0.5
      for (let k = rings; k >= 1; k--) {
        const f = rings === 1 ? 0 : (k - 1) / (rings - 1)
        const r = (R * k) / rings
        ctx.globalAlpha = fa
        ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, cx, cy, r, p.sweep, p.ring) : mixHex(p.sweep, p.ring, f)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (p.showGrid !== false) {
      ctx.strokeStyle = p.ring
      ctx.lineWidth = 1
      for (let k = 1; k <= rings; k++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (R * k) / rings, 0, TAU)
        ctx.stroke()
      }
      if (rings > 0) {
        ctx.beginPath()
        ctx.moveTo(cx - R, cy)
        ctx.lineTo(cx + R, cy)
        ctx.moveTo(cx, cy - R)
        ctx.lineTo(cx, cy + R)
        ctx.stroke()
      }
    }

    const a = u * TAU * Math.round(p.turns) - Math.PI / 2 // integer turns ⇒ seamless
    const trail = Math.round(p.trail)
    const step = 0.16
    ctx.fillStyle = p.sweep
    for (let t = 0; t < trail; t++) {
      const a0 = a - t * step
      ctx.globalAlpha = (1 - t / trail) * 0.55
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, a0 - step, a0)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = p.sweep
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.stroke()
  },
}
