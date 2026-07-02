import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix2 } from './raster.js'

// Checker field — an animated checkerboard from sign(sin·sin); flow slides it,
// softness controls the edge sharpness. Seamless: phase is periodic in u.
export default {
  id: 'checker-field',
  label: 'Checker field',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 6 },
    { key: 'soft', label: 'Softness', type: 'range', min: 0.02, max: 1, step: 0.02, default: 0.3 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const s = p.freq * 0.04
    const soft = Math.max(0.02, p.soft)
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      const v = Math.sin(rx * s + cam.phase) * Math.sin(ry * s - cam.phase)
      const f = 0.5 + 0.5 * Math.tanh(v / soft)
      return mix2(f, A, B)
    })
  },
}
