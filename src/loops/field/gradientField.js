import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Gradient field — a flowing iridescent plasma (the maxdrekker / mnaumann
// "Dynamics" mood). A smooth scalar field through a 3-stop palette; the camera's
// phase drifts it. Uses the shared adaptive rasterizer (crisp at any size).
// Seamless: every phase term is periodic in u.
export default {
  id: 'gradient-field',
  label: 'Gradient field',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#1b2a6b' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#d7263d' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f6c453' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'warp', label: 'Warp', type: 'range', min: 0, max: 3, step: 0.1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const s = p.freq * 0.01
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      // Phase multipliers are INTEGERS (camFlow) so the field returns to its
      // start after one cam cycle → seamless loop.
      const v = Math.sin(rx * s + cam.phase)
        + Math.sin(ry * s * 0.9 - cam.phase)
        + Math.sin((rx + ry) * 0.7 * s + cam.phase * 2)
      const f = 0.5 + 0.5 * Math.sin(v + p.warp * Math.sin((rx - ry) * 0.3 * s))
      return mix3(f, A, B, C)
    })
  },
}
