import { TAU, hexToRgb } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Concentric arcs — rings of broken arcs, alternate rings counter-rotating a
// whole number of turns per loop ⇒ seamless. The disc enclosed by each ring can
// be filled (off by default) for concentric colour bands behind the arcs.
export default {
  id: 'concentric-arcs',
  label: 'Concentric arcs',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#c2502e' },
    ...FILL_PARAMS,
    { key: 'ringFill', label: 'Fill rings', type: 'toggle', default: false, tab: 'color' },
    { key: 'ringAlpha', label: 'Fill opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.5, tab: 'color', noRandom: true },
    { key: 'rings', label: 'Rings', type: 'range', min: 2, max: 14, step: 1, default: 7, noRandom: true },
    { key: 'gap', label: 'Gap', type: 'range', min: 0.05, max: 0.6, step: 0.05, default: 0.3 },
    { key: 'spin', label: 'Spin', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 40, step: 0.5, default: 5 },
    { key: 'size', label: 'Reach', type: 'range', min: 0.6, max: 1, step: 0.02, default: 0.92 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const A = hexToRgb(p.colA), B = hexToRgb(p.colB)
    const blendAB = f => `rgb(${A[0]+f*(B[0]-A[0])|0},${A[1]+f*(B[1]-A[1])|0},${A[2]+f*(B[2]-A[2])|0})`

    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) * 0.5 * p.size
    const rings = Math.round(p.rings)
    const spin = Math.round(p.spin)
    const span = TAU * (1 - p.gap)

    // Optional disc fill — paint each ring's enclosed area, largest → smallest so
    // inner discs layer over outer ones (concentric bands). Arcs stroke on top.
    // Off by default ⇒ existing presets are unchanged.
    if (p.ringFill) {
      const fa = p.ringAlpha ?? 0.5
      for (let k = rings - 1; k >= 0; k--) {
        const f = rings === 1 ? 0 : k / (rings - 1)
        const r = maxR * ((k + 1) / rings)
        ctx.globalAlpha = fa
        ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, cx, cy, r) : blendAB(f)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    ctx.lineWidth = p.weight
    ctx.lineCap = 'round'
    for (let k = 0; k < rings; k++) {
      const f = rings === 1 ? 0 : k / (rings - 1)
      const r = maxR * ((k + 1) / rings)
      const dir = k % 2 === 0 ? 1 : -1
      const a0 = dir * u * TAU * spin - Math.PI / 2
      ctx.strokeStyle = blendAB(f)
      ctx.beginPath()
      ctx.arc(cx, cy, r, a0, a0 + span)
      ctx.stroke()
    }
  },
}
