import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Plasma — classic multi-sine plasma (a different recipe to Gradient field); flow
// animates the phase. The phase-free radial term stays put ⇒ frame(0)===frame(1).
export default {
  id: 'plasma',
  label: 'Plasma',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#1b2a6b' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#d7263d' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f6c453' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const s = p.freq * 0.04
    raster(ctx, w, h, (i, j, W, H) => {
      const [x, y] = sample(cam, (i / W) * w, (j / H) * h)
      const d = Math.hypot(x, y)
      const v = Math.sin(x * s + cam.phase)
        + Math.sin(y * s - cam.phase)
        + Math.sin((x + y) * s * 0.5 + cam.phase)
        + Math.sin(d * s)
      const f = 0.5 + 0.5 * Math.sin(v)
      return mix3(f, A, B, C)
    })
  },
}
