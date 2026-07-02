import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Moiré — two concentric ring sets at different frequencies interfere; flow
// drifts both, rolling the interference bands. Seamless: phase is periodic in u.
export default {
  id: 'moire',
  label: 'Moiré',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#06060a' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#3a6ea5' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f4f1ea' },
    { key: 'freq1', label: 'Frequency 1', type: 'range', min: 1, max: 14, step: 0.5, default: 6 },
    { key: 'freq2', label: 'Frequency 2', type: 'range', min: 1, max: 14, step: 0.5, default: 7 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const s1 = p.freq1 * 0.02
    const s2 = p.freq2 * 0.02
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      const d = Math.hypot(rx, ry)
      const a = Math.sin(d * s1 + cam.phase)
      const b = Math.sin(d * s2 - cam.phase)
      const f = 0.5 + 0.5 * a * b
      return mix3(f, A, B, C)
    })
  },
}
