
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'



// Front-propagation / growing circles. Every frame: spawn a new seed (at the
// interior point farthest from existing circles + SDF boundary), then let all
// live circles grow until they touch another or the SDF boundary.
//
// Reference approach: "Growing Circles" (generativeartistry.com circle-packing tutorial),
// also Gorilla Sun recursive circle packing strategy.
export const frontPack            = {
  id: '05-front-pack',
  name: 'CIRCLE PACKING (GROWING)',
  repo: 'generativeartistry.com/tutorials/circle-packing',
  summary:
    'Each frame, N new seeds spawn and grow as circles until they collide with a neighbor or the SDF boundary. Higher-quality packings than dart-throwing (tighter, no gaps). Animates natively as circles visibly inflate.',
  helps:
    'The "build-up over time" feel from the brief. Unlike the static pack (01), this one visually accretes. Use as the initial trigger animation.',
  params: [
    { key: 'maxCircles', type: 'int', min: 100, max: 2400, step: 50, default: 900, label: 'max circles' },
    { key: 'seedsPerFrame', type: 'int', min: 1, max: 24, default: 6, label: 'seeds/frame' },
    { key: 'growStep', type: 'range', min: 0.1, max: 2, step: 0.05, default: 0.4, label: 'grow step' },
    { key: 'minR', type: 'int', min: 1, max: 12, default: 3, label: 'min radius' },
    { key: 'maxR', type: 'int', min: 16, max: 100, default: 55, label: 'max radius' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { maxCircles, seedsPerFrame, growStep, minR, maxR } = params

    const circles      = []

    return wrapLoop(() => {
      // Spawn new seeds
      for (let s = 0; s < seedsPerFrame && circles.length < maxCircles; s++) {
        const [x, y] = sampleInside(sdf, rng)
        let ok = true
        for (const c of circles) {
          const dx = c.x - x, dy = c.y - y
          if (dx * dx + dy * dy < (c.r + minR) ** 2) { ok = false; break }
        }
        if (!ok) continue
        if (sdf.sample(x, y) > -minR) continue
        circles.push({ x, y, r: minR / 2, growing: true })
      }

      // Grow circles
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i]
        if (!c.growing) continue
        const nr = c.r + growStep
        if (nr >= maxR) { c.r = maxR; c.growing = false; continue }
        // SDF check
        if (-sdf.sample(c.x, c.y) <= nr + 0.5) { c.growing = false; continue }
        // Collision
        let hit = false
        for (let j = 0; j < circles.length; j++) {
          if (j === i) continue
          const o = circles[j]
          const dx = o.x - c.x, dy = o.y - c.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < o.r + nr + 0.4) { hit = true; break }
        }
        if (hit) { c.growing = false; continue }
        c.r = nr
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.2)', 1)

      // outlines
      ctx.strokeStyle = 'rgba(210, 215, 235, 0.55)'
      ctx.lineWidth = 0.9
      for (const c of circles) {
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, c.r * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.stroke()
      }

      // centers
      ctx.fillStyle = '#f3c9c4'
      for (const c of circles) {
        ctx.beginPath()
        ctx.arc(c.x * sx, c.y * sy, 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
