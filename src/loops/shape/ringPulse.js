import { TAU, mixHex } from '../lib/util.js'

// Ring pulse — concentric rings march outward; each ring's radius is its index
// plus an integer `drift` of full cycles over the loop, so frame(0)===frame(1).
export default {
  id: 'ring-pulse',
  label: 'Ring pulse',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#1c2740' },
    { key: 'rings', label: 'Rings', type: 'range', min: 4, max: 40, step: 1, default: 16, noRandom: true },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 30, step: 0.5, default: 4 },
    { key: 'size', label: 'Reach', type: 'range', min: 0.5, max: 1, step: 0.02, default: 0.92 },
    { key: 'drift', label: 'Drift', type: 'range', min: 1, max: 4, step: 1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const maxR = Math.min(w, h) * 0.5 * p.size
    const n = Math.round(p.rings)
    const drift = Math.round(p.drift)
    ctx.lineWidth = p.weight
    for (let k = 0; k < n; k++) {
      const f = ((k / n + u * drift) % 1 + 1) % 1 // 0..1, marches outward
      ctx.strokeStyle = mixHex(p.colA, p.colB, f)
      ctx.beginPath()
      ctx.arc(cx, cy, f * maxR, 0, TAU)
      ctx.stroke()
    }
  },
}
