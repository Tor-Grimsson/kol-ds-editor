import { TAU } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'

// Halftone — a dot grid whose per-dot radius samples a flowing concentric field
// (the maxdrekker "Degrees" dot-sphere look). The camera flows the rings; zoom
// scales the field, angle rotates it. Seamless: the field phase is periodic.
export default {
  id: 'halftone',
  label: 'Halftone',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'dot', label: 'Dot colour', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'cell', label: 'Cell size', type: 'range', min: 8, max: 44, step: 1, default: 18, noRandom: true },
    { key: 'maxDot', label: 'Max dot', type: 'range', min: 0.3, max: 1.4, step: 0.05, default: 1 },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const cam = makeCam(u, p, w, h)
    const cell = Math.max(6, p.cell)
    const rMax = (cell / 2) * p.maxDot
    const s = p.freq * 0.025
    ctx.fillStyle = p.dot
    for (let gy = cell / 2; gy < h; gy += cell) {
      for (let gx = cell / 2; gx < w; gx += cell) {
        const [rx, ry] = sample(cam, gx, gy)
        const d = Math.hypot(rx, ry)
        const f = 0.5 + 0.5 * Math.sin(d * s - cam.phase)
        const r = f * rMax
        if (r < 0.3) continue
        ctx.beginPath()
        ctx.arc(gx, gy, r, 0, TAU)
        ctx.fill()
      }
    }
  },
}
