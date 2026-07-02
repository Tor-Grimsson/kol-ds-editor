import { TAU, hexToRgb } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Orbit dots — concentric dots, each ring completing a whole number of
// revolutions per loop ⇒ seamless. Inner rings turn faster. Rings can be left as
// bare outlines or have their enclosed disc filled (off by default).
export default {
  id: 'orbit-dots',
  label: 'Orbit dots',
  group: 'shape',
  kind: '2d',
  duration: 7,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#5a7fb0' },
    ...FILL_PARAMS,
    { key: 'ringFill', label: 'Fill rings', type: 'toggle', default: false, tab: 'color' },
    { key: 'ringAlpha', label: 'Fill opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.5, tab: 'color', noRandom: true },
    { key: 'rings', label: 'Rings', type: 'range', min: 2, max: 10, step: 1, default: 6, noRandom: true },
    { key: 'dotsPer', label: 'Dots / ring', type: 'range', min: 1, max: 6, step: 1, default: 1, noRandom: true },
    { key: 'size', label: 'Reach', type: 'range', min: 0.5, max: 0.95, step: 0.02, default: 0.88 },
    { key: 'dotR', label: 'Dot size', type: 'range', min: 2, max: 18, step: 1, default: 7 },
    { key: 'showPath', label: 'Paths', type: 'toggle', default: true },
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
    const dpr = Math.round(p.dotsPer)

    // Optional disc fill — paint each ring's enclosed area, largest → smallest so
    // inner discs layer over outer ones (concentric bands). Paths + dots draw on
    // top in the loop below. Off by default ⇒ existing presets are unchanged.
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

    for (let k = 0; k < rings; k++) {
      const f = rings === 1 ? 0 : k / (rings - 1)
      const r = maxR * ((k + 1) / rings)
      const speed = rings - k // whole revolutions over the loop ⇒ seamless
      const col = blendAB(f)
      if (p.showPath !== false) {
        ctx.strokeStyle = col
        ctx.globalAlpha = 0.22
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      for (let d = 0; d < dpr; d++) {
        const a = u * TAU * speed + (d / dpr) * TAU - Math.PI / 2
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, p.dotR, 0, TAU)
        ctx.fill()
      }
    }
  },
}
