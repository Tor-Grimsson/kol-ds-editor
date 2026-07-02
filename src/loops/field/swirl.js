import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix3 } from './raster.js'

// Swirl — a pinwheel: angular bands twisted by radius, spun by flow. Integer arms
// keep the value continuous across the ±π seam; phase is periodic ⇒ seamless.
export default {
  id: 'swirl',
  label: 'Swirl',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#06060a' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#7a3fb0' },
    { key: 'colC', label: 'Colour C', type: 'color', role: 'accent', default: '#f4f1ea' },
    { key: 'arms', label: 'Arms', type: 'range', min: 1, max: 12, step: 1, default: 5, noRandom: true },
    { key: 'twist', label: 'Twist', type: 'range', min: 0, max: 8, step: 0.5, default: 3 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const C = hexToRgb(p.colC)
    const arms = Math.round(p.arms)
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx, ry] = sample(cam, (i / W) * w, (j / H) * h)
      const ang = Math.atan2(ry, rx)
      const d = Math.hypot(rx, ry)
      const f = 0.5 + 0.5 * Math.sin(arms * ang + d * 0.01 * p.twist - cam.phase)
      return mix3(f, A, B, C)
    })
  },
}
