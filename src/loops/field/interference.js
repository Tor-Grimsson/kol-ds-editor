import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Interference — overlapping circular waves from several point sources arranged
// on a ring; flow pulses them. Seamless: phase is periodic in u.
export default {
  id: 'interference',
  label: 'Interference',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#06060a' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#2a8f8f' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f4f1ea' },
    { key: 'sources', label: 'Sources', type: 'range', min: 2, max: 6, step: 1, default: 3, noRandom: true },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 8 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const n = Math.round(p.sources)
    const s = p.freq * 0.03
    const span = Math.min(w, h) * 0.3
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      let acc = 0
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const sx = Math.cos(a) * span
        const sy = Math.sin(a) * span
        const d = Math.hypot(rx - sx, ry - sy)
        acc += Math.sin(d * s - cam.phase)
      }
      const f = 0.5 + 0.5 * (acc / n)
      return mix3(f, A, B, C)
    })
  },
}
