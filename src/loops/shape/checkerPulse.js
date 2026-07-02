import { TAU } from '../lib/util.js'

// Checker pulse — checkerboard cells scale 0↔1 in a diagonal travelling wave.
// Integer cycles/waves ⇒ frame(0)===frame(1).
export default {
  id: 'checker-pulse',
  label: 'Checker pulse',
  group: 'shape',
  kind: '2d',
  duration: 5,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'accent', default: '#c2502e' },
    { key: 'cols', label: 'Columns', type: 'range', min: 3, max: 24, step: 1, default: 8, noRandom: true },
    { key: 'cycles', label: 'Cycles', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'waves', label: 'Waves', type: 'range', min: 0, max: 6, step: 1, default: 2 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cols = Math.round(p.cols)
    const slot = w / cols
    const rows = Math.max(1, Math.round(h / slot))
    const oy = (h - rows * slot) / 2
    const cyc = Math.round(p.cycles)
    const wav = Math.round(p.waves)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ph = u * TAU * cyc - ((c + r) / (cols + rows)) * TAU * wav
        const k = 0.5 + 0.5 * Math.sin(ph)
        const s = slot * 0.92 * (0.1 + 0.9 * k)
        ctx.fillStyle = (c + r) % 2 === 0 ? p.colA : p.colB
        ctx.fillRect((c + 0.5) * slot - s / 2, (r + 0.5) * slot + oy - s / 2, s, s)
      }
    }
  },
}
