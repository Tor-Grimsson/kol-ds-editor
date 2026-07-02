import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix2 } from './raster.js'

// Contour — topographic iso-bands of a flowing scalar field: thin lines at band
// edges over a 2-colour fill. Seamless: phase is periodic in u.
export default {
  id: 'contour',
  label: 'Contour',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Low', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colB', label: 'High', type: 'color', role: 'fg', default: '#5a7fb0' },
    { key: 'line', label: 'Line', type: 'color', role: 'accent', default: '#f4f1ea' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'bands', label: 'Bands', type: 'range', min: 3, max: 18, step: 1, default: 9, noRandom: true },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const L = hexToRgb(p.line)
    const s = p.freq * 0.04
    const bands = Math.round(p.bands)
    raster(ctx, w, h, (i, j, W, H) => {
      const [x, y] = sample(cam, (i / W) * w, (j / H) * h)
      const d = Math.hypot(x, y)
      const v = Math.sin(x * s + cam.phase) + Math.sin(y * s - cam.phase) + Math.sin(d * s * 0.7 + cam.phase)
      const f = 0.5 + 0.5 * Math.sin(v)
      const band = f * bands
      const edge = Math.abs(band - Math.round(band))
      if (edge < 0.06) return L
      return mix2(f, A, B)
    })
  },
}
