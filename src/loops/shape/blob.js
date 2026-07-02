import { TAU, mixHex } from '../lib/util.js'
import { FILL_PARAMS, paintFill, isGradient } from '../lib/fill.js'

// Blob — an organic radial wobble r(θ)=R(1+Σ amp·sin(hθ±phase)); integer
// harmonics h and a whole phase-drift per loop ⇒ seamless. Slow whole-turn spin.
export default {
  id: 'blob',
  label: 'Blob',
  group: 'shape',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#c2502e' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#f6c453' },
    ...FILL_PARAMS,
    { key: 'amp', label: 'Wobble', type: 'range', min: 0, max: 0.4, step: 0.02, default: 0.18 },
    { key: 'lobes', label: 'Lobes', type: 'range', min: 2, max: 8, step: 1, default: 4, noRandom: true },
    { key: 'size', label: 'Size', type: 'range', min: 0.3, max: 0.6, step: 0.01, default: 0.42 },
    { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 3, step: 1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const R = Math.min(w, h) * 0.5 * p.size
    const lobes = Math.round(p.lobes)
    const ph = u * TAU // one whole phase cycle ⇒ seamless
    const rot = u * TAU * Math.round(p.spin)
    const ease = (1 - Math.cos(u * TAU)) / 2
    const N = 220

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rot)
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU
      const wob = Math.sin(lobes * th + ph) * p.amp + Math.sin((lobes + 2) * th - ph) * p.amp * 0.5
      const r = R * (1 + wob)
      const x = Math.cos(th) * r
      const y = Math.sin(th) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, 0, 0, R * 1.3) : mixHex(p.colA, p.colB, ease)
    ctx.fill()
    ctx.restore()
  },
}
