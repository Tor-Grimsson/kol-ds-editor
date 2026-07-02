import { TAU, hexToRgb } from '../lib/util.js'
import { FILL_PARAMS, SHAPE_FILL_PARAMS, paintFill, isGradient, fillRuleOf } from '../lib/fill.js'

// Spiral — an Archimedean spiral rotating a whole number of turns per loop ⇒
// seamless. Colour ramps inner→outer along the arm. The arm can be filled as a
// pinwheel region (closed back to centre) behind the outline — off by default.
export default {
  id: 'spiral',
  label: 'Spiral',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#2b6a8f' },
    ...FILL_PARAMS,
    ...SHAPE_FILL_PARAMS,
    { key: 'turns', label: 'Turns', type: 'range', min: 2, max: 8, step: 1, default: 5, noRandom: true },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 30, step: 0.5, default: 3 },
    { key: 'spin', label: 'Spin', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'size', label: 'Reach', type: 'range', min: 0.6, max: 1, step: 0.02, default: 0.92 },
    { key: 'showGuide', label: 'Guides', type: 'toggle', default: false },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const A = hexToRgb(p.colA), B = hexToRgb(p.colB)
    const blendAB = f => `rgb(${A[0]+f*(B[0]-A[0])|0},${A[1]+f*(B[1]-A[1])|0},${A[2]+f*(B[2]-A[2])|0})`

    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) * 0.5 * p.size
    const turns = Math.round(p.turns)
    const rot = u * TAU * Math.round(p.spin) // whole turns ⇒ seamless
    const N = turns * 120

    if (p.showGuide) {
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = p.colB
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, maxR, 0, TAU)
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy)
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7)
      ctx.stroke()
      ctx.restore()
    }

    ctx.lineWidth = p.weight
    ctx.lineCap = 'round'

    // Optional fill — trace the arm as one path; fill() closes the outer end back
    // to centre ⇒ a pinwheel region. The ramped per-segment outline draws on top.
    if (p.fillShape) {
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const f = i / N
        const th = f * turns * TAU + rot
        const r = f * maxR
        const x = cx + Math.cos(th) * r
        const y = cy + Math.sin(th) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.globalAlpha = p.fillAlpha ?? 0.5
      ctx.fillStyle = isGradient(p) ? paintFill(ctx, p, cx, cy, maxR) : blendAB(0.5)
      ctx.fill(fillRuleOf(p))
      ctx.globalAlpha = 1
    }

    let px = cx
    let py = cy
    for (let i = 0; i <= N; i++) {
      const f = i / N
      const th = f * turns * TAU + rot
      const r = f * maxR
      const x = cx + Math.cos(th) * r
      const y = cy + Math.sin(th) * r
      if (i > 0) {
        ctx.strokeStyle = blendAB(f)
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
      px = x
      py = y
    }
  },
}
