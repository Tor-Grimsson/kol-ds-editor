

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Apollonian Gasket — recursive Descartes filling.
// Start from 3 mutually tangent seed circles, grow outward to depth D.
// Descartes' theorem: (k1+k2+k3+k4)² = 2(k1²+k2²+k3²+k4²)
// where k = 1/r (curvature, negative for enclosing circle).
// Seed circles breathe in/out via clock → packing rearranges each frame.

const PARAMS          = [
  { key: 'depth', type: 'int', min: 2, max: 9, default: 6, label: 'recursion depth' },
  { key: 'breathe', type: 'range', min: 0, max: 1, default: 0.25, step: 0.01, label: 'breathe speed' },
  { key: 'rot', type: 'range', min: 0, max: 1, default: 0.08, step: 0.01, label: 'rotation' },
  { key: 'stroke', type: 'range', min: 0.3, max: 3.0, default: 1.0, step: 0.1, label: 'stroke width' },
  { key: 'glow', type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: 'glow' },
]



// Descartes theorem: given 3 tangent circles with curvatures k1,k2,k3,
// the two kissing circles have curvature k4 = k1+k2+k3 ± 2√(k1k2+k2k3+k3k1)
function descartesK4(k1        , k2        , k3        )                   {
  const s = k1 * k2 + k2 * k3 + k3 * k1
  const sq = Math.sqrt(Math.max(0, s))
  return [k1 + k2 + k3 + 2 * sq, k1 + k2 + k3 - 2 * sq]
}

// Complex Descartes: given centers z1,z2,z3 and curvatures k1,k2,k3, k4,
// find center z4 of kissing circle.
// z4 = (z1*k1 + z2*k2 + z3*k3 ± 2√(k1k2(z1z2) + k2k3(z2z3) + k3k1(z3z1))) / k4
function descartesZ4(
  x1        , y1        , k1        ,
  x2        , y2        , k2        ,
  x3        , y3        , k3        ,
  k4        , sign        ,
)                   {
  // Complex sqrt of (k1k2*z1z2 + k2k3*z2z3 + k3k1*z3z1) where z = x+iy with conj
  // Actually: sqrt of k1k2*z1*conj(z2) is not right; use complex arithmetic on z1*k1 etc.
  // Formula: z4 = (1/k4) * (z1k1 + z2k2 + z3k3 ± 2*csqrt(k1k2*z1z2_prod + ...))
  const sx = x1 * k1 + x2 * k2 + x3 * k3
  const sy = y1 * k1 + y2 * k2 + y3 * k3
  // product z_i * z_j for complex: (x_i+iy_i)(x_j+iy_j) = x_ix_j-y_iy_j + i(x_iy_j+x_jy_i)
  const p12x = x1 * x2 - y1 * y2, p12y = x1 * y2 + x2 * y1
  const p23x = x2 * x3 - y2 * y3, p23y = x2 * y3 + x3 * y2
  const p31x = x3 * x1 - y3 * y1, p31y = x3 * y1 + x1 * y3
  const sumX = k1 * k2 * p12x + k2 * k3 * p23x + k3 * k1 * p31x
  const sumY = k1 * k2 * p12y + k2 * k3 * p23y + k3 * k1 * p31y
  // csqrt of (sumX + i*sumY)
  const modS = Math.sqrt(Math.hypot(sumX, sumY))
  if (modS < 1e-14) return [sx / k4, sy / k4]
  const argS = Math.atan2(sumY, sumX)
  const sqrX = Math.sqrt(modS) * Math.cos(argS / 2)
  const sqrY = Math.sqrt(modS) * Math.sin(argS / 2)
  return [(sx + sign * 2 * sqrX) / k4, (sy + sign * 2 * sqrY) / k4]
}

export const r2_hyp_05_apollonian            = {
  id: 'r2-hyp-05-apollonian',
  name: 'APOLLONIAN GASKET',
  repo: "Descartes theorem · Kleinian limit set · Indra's Pearls",
  summary:
    'Apollonian circle packing via recursive Descartes filling. Seed circles breathe continuously, rearranging the entire infinite packing. The gasket fills glyph counters with fractal recursive circles.',
  helps: 'Natural counter-fill: recursion terminates when circles are sub-pixel — exact depth matches glyph size.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const depth = Math.round(num(params, 'depth', 6))
      const breatheSpd = num(params, 'breathe', 0.25)
      const rotSpd = num(params, 'rot', 0.08)
      const strokeW = num(params, 'stroke', 1.0)
      const glow = num(params, 'glow', 0.5)

      // Animate seed configuration: three tangent circles inside a big enclosing circle
      // Enclosing circle: radius 0.9, center 0, curvature k0 = -1/0.9 ≈ -1.11
      const encR = 0.9
      const k0 = -1 / encR

      // Three seed circles symmetrically placed, radius breathes
      const breath = 0.07 * Math.sin(t * breatheSpd * Math.PI * 2)
      const seedR = encR / (2 + 1 / Math.sin(Math.PI / 3)) + breath * 0.04
      const seedAngle = t * rotSpd * Math.PI * 2

      const seeds                             = [0, 1, 2].map((i) => {
        const a = seedAngle + (i * 2 * Math.PI) / 3
        const d = encR - seedR
        return [Math.cos(a) * d * 0.5, Math.sin(a) * d * 0.5, Math.max(0.01, seedR)]
      })

      // Build gasket
      const circles           = []
      // Add enclosing circle (negative curvature)
      circles.push({ x: 0, y: 0, r: encR, depth: 0 })
      // Add seeds
      for (const [x, y, r] of seeds) {
        circles.push({ x, y, r, depth: 1 })
      }

      // Min radius for rendering (in disk coords)
      const minR = 0.005

      // Recursive fill: given 3 mutually tangent circles, find 4th
                                                                                                   // x1,y1,k1, x2,y2,k2, x3,y3,k3, d
      const queue         = []

      const push3 = (
        x1        , y1        , r1        ,
        x2        , y2        , r2        ,
        x3        , y3        , r3        ,
        d        ,
      ) => {
        if (d >= depth) return
        const k1 = 1/r1, k2 = 1/r2, k3 = 1/r3
        const [k4a, k4b] = descartesK4(k1, k2, k3)
        for (const k4 of [k4a, k4b]) {
          if (k4 <= 0) continue
          const r4 = 1 / k4
          if (r4 < minR) continue
          const [z4x, z4y] = descartesZ4(x1,y1,k1, x2,y2,k2, x3,y3,k3, k4, 1)
          circles.push({ x: z4x, y: z4y, r: r4, depth: d })
          if (d + 1 < depth) {
            queue.push([x1,y1,r1, x2,y2,r2, z4x,z4y,r4, d+1])
            queue.push([x1,y1,r1, x3,y3,r3, z4x,z4y,r4, d+1])
            queue.push([x2,y2,r2, x3,y3,r3, z4x,z4y,r4, d+1])
          }
        }
      }

      const [s0x,s0y,s0r] = seeds[0], [s1x,s1y,s1r] = seeds[1], [s2x,s2y,s2r] = seeds[2]
      push3(s0x,s0y,s0r, s1x,s1y,s1r, s2x,s2y,s2r, 2)
      // Also fill gaps between each seed and enclosing circle
      push3(s0x,s0y,s0r, s1x,s1y,s1r, 0,0,encR, 2)
      push3(s1x,s1y,s1r, s2x,s2y,s2r, 0,0,encR, 2)
      push3(s0x,s0y,s0r, s2x,s2y,s2r, 0,0,encR, 2)

      let qi = 0
      while (qi < queue.length && circles.length < 3000) {
        const [x1,y1,r1, x2,y2,r2, x3,y3,r3, d] = queue[qi++]
        push3(x1,y1,r1, x2,y2,r2, x3,y3,r3, d)
      }

      clear(ctx, W, H)

      // Clip to SDF
      ctx.save()
      ctx.beginPath()
      // Simple rectangular clip + rely on SDF test per circle:
      // Actually use canvas clip with SDF approximate polygon
      for (let y = 0; y < sdf.h; y += 3) {
        for (let x = 0; x < sdf.w; x++) {
          const v = sdf.sample(x, y)
          if (v < 0 && sdf.sample(x+1,y) >= 0) ctx.lineTo(x*sx, y*sy)
          if (v >= 0 && sdf.sample(x+1,y) < 0) ctx.moveTo((x+1)*sx, y*sy)
        }
      }
      ctx.clip()

      for (const c of circles) {
        // Map disk coords to canvas
        const cx = (c.x + 1) * 0.5 * W
        const cy = (c.y + 1) * 0.5 * H
        const cr = c.r * 0.5 * W

        const hue = (c.depth * 0.15 + t * 0.05) % 1
        const r2 = Math.sin(hue * Math.PI * 2) * 0.4 + 0.6
        const g2 = Math.sin(hue * Math.PI * 2 + 2.094) * 0.4 + 0.6
        const b2 = Math.sin(hue * Math.PI * 2 + 4.189) * 0.4 + 0.6
        const alpha = Math.max(0.08, 0.9 - c.depth * 0.1)

        ctx.strokeStyle = `rgba(${r2*255|0},${g2*255|0},${b2*255|0},${alpha})`
        ctx.lineWidth = strokeW * (c.depth === 0 ? 2 : 1)
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(0.5, cr), 0, Math.PI * 2)
        ctx.stroke()

        if (glow > 0 && c.depth <= 2) {
          ctx.strokeStyle = `rgba(${r2*255|0},${g2*255|0},${b2*255|0},${alpha * glow * 0.3})`
          ctx.lineWidth = strokeW * 4
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(0.5, cr), 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.restore()
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
