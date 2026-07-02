import { TAU } from '../lib/util.js'
import { FILL_PARAMS, SHAPE_FILL_PARAMS, paintFill, isGradient, fillRuleOf } from '../lib/fill.js'

// Lissajous — a closed parametric curve x=sin(aθ+δ), y=sin(bθ). Integer a,b keep
// it closed; the drift δ = u·TAU (one whole turn) morphs it back to itself ⇒
// frame(0)===frame(1). A dot rides the curve once per loop. The curve can be
// filled (off by default) — even-odd winding gives the woven-cell look.
export default {
  id: 'lissajous',
  label: 'Lissajous',
  group: 'shape',
  kind: '2d',
  duration: 7,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'line', label: 'Line', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'dot', label: 'Dot', type: 'color', role: 'accent', default: '#c2502e' },
    ...FILL_PARAMS,
    ...SHAPE_FILL_PARAMS,
    { key: 'a', label: 'A freq', type: 'range', min: 1, max: 7, step: 1, default: 3, noRandom: true },
    { key: 'b', label: 'B freq', type: 'range', min: 1, max: 7, step: 1, default: 2, noRandom: true },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 24, step: 0.5, default: 2 },
    { key: 'size', label: 'Size', type: 'range', min: 0.5, max: 0.95, step: 0.02, default: 0.8 },
    { key: 'showDot', label: 'Dot', type: 'toggle', default: true },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) * 0.5 * p.size
    const a = Math.round(p.a)
    const b = Math.round(p.b)
    const d = u * TAU // one whole drift cycle ⇒ seamless
    const N = 600

    ctx.lineWidth = p.weight
    ctx.strokeStyle = p.line
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU
      const x = cx + R * Math.sin(a * th + d)
      const y = cy + R * Math.sin(b * th)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    if (p.fillShape) {
      ctx.globalAlpha = p.fillAlpha ?? 0.5
      ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, cx, cy, R, p.line, p.dot) : p.line
      ctx.fill(fillRuleOf(p))
      ctx.globalAlpha = 1
    }
    ctx.stroke()

    if (p.showDot !== false) {
      const th = u * TAU
      ctx.fillStyle = p.dot
      ctx.beginPath()
      ctx.arc(cx + R * Math.sin(a * th + d), cy + R * Math.sin(b * th), Math.max(3, p.weight * 1.8), 0, TAU)
      ctx.fill()
    }
  },
}
