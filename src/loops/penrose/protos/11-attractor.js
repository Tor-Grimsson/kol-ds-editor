
import { strokeOutline, wrapLoop } from '../common.js'

// Clifford attractor (https://paulbourke.net/fractals/clifford/), point cloud
// fixed-rate iterated and mapped into the glyph silhouette by discarding
// points that fall outside the SDF. The glyph acts as a rectangular clip.
//
// Reference: rreusser/clifford-and-de-jong-attractors (Observable notebook).
export const attractor            = {
  id: '11-attractor',
  name: 'CLIFFORD ATTRACTOR (SDF-CLIPPED)',
  repo: 'observablehq.com/@rreusser/clifford-and-de-jong-attractors',
  summary:
    'Clifford strange attractor iterated for 20k points per frame, then warped and clipped to the glyph SDF. The attractor does not naturally respect the shape — this shows why the shortlist deprioritizes attractors for letterform fill, but the pattern is gorgeous in its own right.',
  helps:
    'Evidence for the deprioritization in the research shortlist. The attractor ignores the mask — most of the iteration is thrown away on the clip test. Included so you can see why it is not a fit.',
  params: [
    { key: 'points', type: 'int', min: 2000, max: 60000, step: 1000, default: 20000, label: 'points' },
    { key: 'scale', type: 'range', min: 0.1, max: 0.5, step: 0.01, default: 0.28, label: 'scale' },
    { key: 'size', type: 'range', min: 1, max: 4, step: 0.5, default: 1, label: 'point size' },
    { key: 'fade', type: 'range', min: 0.01, max: 0.3, step: 0.01, default: 0.05, label: 'fade' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const { points, size, fade } = params
    const a = -1.24 + rng() * 0.6, b = -1.25 + rng() * 0.5, c = -1.81 + rng() * 0.5, d = -1.91 + rng() * 0.4
    let x = 0, y = 0

    return wrapLoop(() => {
      ctx.fillStyle = `rgba(10, 11, 20, ${fade})`
      ctx.fillRect(0, 0, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      // Use SDF bbox roughly (the mask). Attractor range is about [-2, 2].
      const cx = sdf.w / 2, cy = sdf.h / 2
      const sxOut = W / sdf.w, syOut = H / sdf.h
      const scale = Math.min(sdf.w, sdf.h) * params.scale

      ctx.fillStyle = 'rgba(243, 201, 196, 0.5)'
      for (let i = 0; i < points; i++) {
        const nx = Math.sin(a * y) + c * Math.cos(a * x)
        const ny = Math.sin(b * x) + d * Math.cos(b * y)
        x = nx; y = ny
        const px = cx + x * scale
        const py = cy + y * scale
        if (sdf.sample(px, py) >= 0) continue
        ctx.fillRect(px * sxOut, py * syOut, size, size)
      }
    })
  },
}
