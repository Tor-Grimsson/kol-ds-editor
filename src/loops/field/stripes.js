import { hexToRgb } from '../lib/util.js'
import { CAMERA_SCHEMA, makeCam, sample } from './camera.js'
import { raster, mix2 } from './raster.js'

// Stripes — flowing sine bands. The camera rotates/zooms the field; flow drifts
// the bands. Sharpness blends sine→square. Seamless: phase is periodic in u.
export default {
  id: 'stripes',
  label: 'Stripes',
  group: 'field',
  kind: '2d',
  duration: 8,
  camera: CAMERA_SCHEMA,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#e8e4dc' },
    { key: 'freq', label: 'Frequency', type: 'range', min: 1, max: 16, step: 0.5, default: 7 },
    { key: 'sharp', label: 'Sharpness', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
  ],
  draw(ctx, u, w, h, p) {
    const cam = makeCam(u, p, w, h)
    const A = hexToRgb(p.colA)
    const B = hexToRgb(p.colB)
    const s = p.freq * 0.04
    const sharp = p.sharp
    raster(ctx, w, h, (i, j, W, H) => {
      const [rx] = sample(cam, (i / W) * w, (j / H) * h)
      let f = 0.5 + 0.5 * Math.sin(rx * s + cam.phase)
      f = f * (1 - sharp) + (f > 0.5 ? 1 : 0) * sharp
      return mix2(f, A, B)
    })
  },
}
