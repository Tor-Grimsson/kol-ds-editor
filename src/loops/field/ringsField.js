import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Rings field — concentric colour bands radiating from the centre, flowing in/out
// (a filled cousin of Halftone). Seamless: phase is periodic in u.
export default {
  id: 'rings-field',
  label: 'Rings field',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#c2502e' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f6c453' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 7 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const s = p.freq * 0.03
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      const d = Math.hypot(rx, ry)
      const f = 0.5 + 0.5 * Math.sin(d * s - cam.phase)
      return mix3(f, A, B, C)
    })
  },
}
