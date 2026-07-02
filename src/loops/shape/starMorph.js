import { TAU, lerp, mixHex } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Star morph — an N-point star whose inner radius eases sharp↔round and back
// while spinning whole turns ⇒ seamless (periodic ease + integer spin).
export default {
  id: 'star-morph',
  label: 'Star morph',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#c2502e' },
    ...FILL_PARAMS,
    { key: 'points', label: 'Points', type: 'range', min: 3, max: 12, step: 1, default: 5, noRandom: true },
    { key: 'size', label: 'Size', type: 'range', min: 0.3, max: 0.6, step: 0.01, default: 0.46 },
    { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 3, step: 1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const R = Math.min(w, h) * 0.5 * p.size
    const n = Math.round(p.points)
    const ease = (1 - Math.cos(u * TAU)) / 2
    const inner = lerp(0.38, 0.86, ease) * R
    const rot = u * TAU * Math.round(p.spin)

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rot)
    ctx.beginPath()
    for (let i = 0; i < n * 2; i++) {
      const th = (i / (n * 2)) * TAU - Math.PI / 2
      const r = i % 2 === 0 ? R : inner
      const x = Math.cos(th) * r
      const y = Math.sin(th) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, 0, 0, R) : mixHex(p.colA, p.colB, ease)
    ctx.fill()
    ctx.restore()
  },
}
