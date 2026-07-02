import { TAU } from '../lib/util.js'

// Bars wave — a row of vertical bars whose heights are a travelling sine wave.
// Integer `cycles` (time) + integer `waves` (space) ⇒ frame(0)===frame(1).
export default {
  id: 'bars-wave',
  label: 'Bars wave',
  group: 'shape',
  kind: '2d',
  duration: 5,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'bar', label: 'Bar colour', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'count', label: 'Bars', type: 'range', min: 4, max: 48, step: 1, default: 18, noRandom: true },
    { key: 'minH', label: 'Min height', type: 'range', min: 0.04, max: 0.4, step: 0.01, default: 0.1 },
    { key: 'maxH', label: 'Max height', type: 'range', min: 0.4, max: 0.96, step: 0.01, default: 0.82 },
    { key: 'cycles', label: 'Cycles', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'waves', label: 'Waves', type: 'range', min: 0, max: 6, step: 1, default: 2 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const n = Math.round(p.count)
    const slot = w / n
    const bw = slot * 0.6
    const cyc = Math.round(p.cycles)
    const wav = Math.round(p.waves)
    ctx.fillStyle = p.bar
    for (let i = 0; i < n; i++) {
      const ph = u * TAU * cyc - (i / n) * TAU * wav
      const k = 0.5 + 0.5 * Math.sin(ph)
      const bh = h * (p.minH + (p.maxH - p.minH) * k)
      const x = (i + 0.5) * slot - bw / 2
      ctx.fillRect(x, (h - bh) / 2, bw, bh)
    }
  },
}
