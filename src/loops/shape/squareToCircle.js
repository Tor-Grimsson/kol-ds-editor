import { TAU, lerp, mixHex } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Square ↔ circle — a superellipse whose exponent eases between a circle (n=2)
// and a near-square (n=nMax), rotating as it morphs. Periodic ease + integer
// spin ⇒ seamless.
export default {
  id: 'square-circle',
  label: 'Square ↔ circle',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#c2502e' },
    ...FILL_PARAMS,
    { key: 'size', label: 'Size', type: 'range', min: 0.3, max: 0.62, step: 0.01, default: 0.42 },
    { key: 'nMax', label: 'Squareness', type: 'range', min: 3, max: 12, step: 0.5, default: 8 },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: 0, max: 3, step: 1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const R = Math.min(w, h) * 0.5 * p.size
    const ease = (1 - Math.cos(u * TAU)) / 2
    const n = lerp(2, p.nMax, ease)
    const rot = u * TAU * Math.round(p.spin)
    const N = 128

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rot)
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU
      const c = Math.cos(th)
      const s = Math.sin(th)
      const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * R
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * R
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, 0, 0, R) : mixHex(p.colA, p.colB, ease)
    ctx.fill()
    ctx.restore()
  },
}
