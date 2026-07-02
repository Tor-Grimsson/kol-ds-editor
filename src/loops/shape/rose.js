import { TAU, lerp, mixHex } from '../lib/util.js'
import { FILL_PARAMS, SHAPE_FILL_PARAMS, paintFill, isGradient, fillRuleOf } from '../lib/fill.js'

// Rose curve — a rhodonea r=cos(kθ); integer k sets the petals. A periodic
// amplitude breathe + whole-turn spin keep it seamless. The petals can be left as
// an outline or filled (off by default).
export default {
  id: 'rose-curve',
  label: 'Rose curve',
  group: 'shape',
  kind: '2d',
  duration: 7,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#8f5ad0' },
    ...FILL_PARAMS,
    ...SHAPE_FILL_PARAMS,
    { key: 'k', label: 'Petals (k)', type: 'range', min: 2, max: 9, step: 1, default: 5, noRandom: true },
    { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 3, step: 1, default: 1 },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 24, step: 0.5, default: 2.5 },
    { key: 'size', label: 'Size', type: 'range', min: 0.5, max: 0.95, step: 0.02, default: 0.85 },
    { key: 'showGuide', label: 'Guides', type: 'toggle', default: false },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const R = Math.min(w, h) * 0.5 * p.size
    const k = Math.round(p.k)
    const ease = (1 - Math.cos(u * TAU)) / 2
    const amp = lerp(0.55, 1, ease)
    const rot = u * TAU * Math.round(p.spin)
    const reps = k % 2 === 0 ? 2 : 1 // even k needs 2 turns to close
    const N = 720

    if (p.showGuide) {
      const axes = k % 2 === 0 ? 2 * k : k
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.globalAlpha = 0.22
      ctx.strokeStyle = p.colB
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, TAU)
      for (let m = 0; m < axes; m++) {
        const a = (m / axes) * TAU
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
      }
      ctx.stroke()
      ctx.restore()
    }

    ctx.lineWidth = p.weight
    ctx.lineJoin = 'round'
    ctx.strokeStyle = mixHex(p.colA, p.colB, ease)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(rot)
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU * reps
      const r = Math.cos(k * th) * R * amp
      const x = Math.cos(th) * r
      const y = Math.sin(th) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    if (p.fillShape) {
      ctx.globalAlpha = p.fillAlpha ?? 0.5
      ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, 0, 0, R) : mixHex(p.colA, p.colB, ease)
      ctx.fill(fillRuleOf(p))
      ctx.globalAlpha = 1
    }
    ctx.stroke()
    ctx.restore()
  },
}
