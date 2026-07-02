import { TAU, mixHex } from '../lib/util.js'

// Radial bars — spokes radiating from the centre, length a travelling wave around
// the ring. Integer time cycles + integer spatial waves ⇒ seamless.
export default {
  id: 'radial-bars',
  label: 'Radial bars',
  group: 'shape',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colA', label: 'Colour A', type: 'color', role: 'accent', default: '#1c2740' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'count', label: 'Spokes', type: 'range', min: 6, max: 64, step: 1, default: 32, noRandom: true },
    { key: 'minR', label: 'Inner', type: 'range', min: 0.05, max: 0.4, step: 0.01, default: 0.15 },
    { key: 'maxR', label: 'Outer', type: 'range', min: 0.4, max: 0.95, step: 0.01, default: 0.85 },
    { key: 'cycles', label: 'Cycles', type: 'range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'waves', label: 'Waves', type: 'range', min: 1, max: 8, step: 1, default: 3 },
    { key: 'weight', label: 'Weight', type: 'range', min: 1, max: 30, step: 0.5, default: 4 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const cy = h / 2
    const span = Math.min(w, h) * 0.5
    const n = Math.round(p.count)
    const cyc = Math.round(p.cycles)
    const wav = Math.round(p.waves)

    ctx.lineWidth = p.weight
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2
      const ph = u * TAU * cyc - (i / n) * TAU * wav
      const k = 0.5 + 0.5 * Math.sin(ph)
      const r0 = p.minR * span
      const r1 = (p.minR + (p.maxR - p.minR) * k) * span
      ctx.strokeStyle = mixHex(p.colA, p.colB, k)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.stroke()
    }
  },
}
