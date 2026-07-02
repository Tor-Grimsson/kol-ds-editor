import { TAU } from '../lib/util.js'

// Grid rotor — a grid of short line segments; each rotates a whole number of
// turns per loop with a spatial phase offset, so a wave of rotation sweeps the
// grid. Integer turns ⇒ seamless.
export default {
  id: 'grid-rotor',
  label: 'Grid rotor',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'stroke', label: 'Stroke', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'cols', label: 'Columns', type: 'range', min: 3, max: 24, step: 1, default: 10, noRandom: true },
    { key: 'turns', label: 'Turns', type: 'range', min: 1, max: 3, step: 1, default: 1 },
    { key: 'wavesX', label: 'Waves X', type: 'range', min: 0, max: 6, step: 1, default: 2 },
    { key: 'wavesY', label: 'Waves Y', type: 'range', min: 0, max: 6, step: 1, default: 1 },
    { key: 'len', label: 'Length', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.75 },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 24, step: 0.5, default: 2.5 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cols = Math.round(p.cols)
    const slot = w / cols
    const rows = Math.max(1, Math.round(h / slot))
    const oy = (h - rows * slot) / 2
    const turns = Math.round(p.turns)
    const wx = Math.round(p.wavesX)
    const wy = Math.round(p.wavesY)
    const L = slot * 0.5 * p.len

    ctx.strokeStyle = p.stroke
    ctx.lineWidth = p.weight
    ctx.lineCap = 'round'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = u * TAU * turns + (c / cols) * TAU * wx + (r / rows) * TAU * wy
        const x = (c + 0.5) * slot
        const y = (r + 0.5) * slot + oy
        const dx = Math.cos(a) * L
        const dy = Math.sin(a) * L
        ctx.beginPath()
        ctx.moveTo(x - dx, y - dy)
        ctx.lineTo(x + dx, y + dy)
        ctx.stroke()
      }
    }
  },
}
