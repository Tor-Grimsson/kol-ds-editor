import { TAU, mixHex } from '../lib/util.js'

// Wave grid — a dot matrix whose dot size is a travelling 2-D wave. Integer time
// cycles + integer spatial waves ⇒ frame(0)===frame(1).
export default {
  id: 'wave-grid',
  label: 'Wave grid',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'accent', default: '#1c2740' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'cols', label: 'Columns', type: 'range', min: 4, max: 32, step: 1, default: 14, noRandom: true },
    { key: 'cycles', label: 'Cycles', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'wavesX', label: 'Waves X', type: 'range', min: 0, max: 6, step: 1, default: 2 },
    { key: 'wavesY', label: 'Waves Y', type: 'range', min: 0, max: 6, step: 1, default: 1 },
    { key: 'maxDot', label: 'Max dot', type: 'range', min: 0.3, max: 1.1, step: 0.05, default: 0.8 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cols = Math.round(p.cols)
    const slot = w / cols
    const rows = Math.max(1, Math.round(h / slot))
    const oy = (h - rows * slot) / 2
    const cyc = Math.round(p.cycles)
    const wx = Math.round(p.wavesX)
    const wy = Math.round(p.wavesY)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ph = u * TAU * cyc - (c / cols) * TAU * wx - (r / rows) * TAU * wy
        const k = 0.5 + 0.5 * Math.sin(ph)
        const rad = (slot / 2) * p.maxDot * (0.15 + 0.85 * k)
        ctx.fillStyle = mixHex(p.colA, p.colB, k)
        ctx.beginPath()
        ctx.arc((c + 0.5) * slot, (r + 0.5) * slot + oy, rad, 0, TAU)
        ctx.fill()
      }
    }
  },
}
