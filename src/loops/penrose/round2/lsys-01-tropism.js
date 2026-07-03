// Biomechanical L-System — SDF gradient tropism + mechanical load sag.
// Each segment's heading is continuously bent toward -∇sdf (inward) weighted
// by the cumulative length (load) of all descendants. New buds spawn each
// frame; older branches curve progressively as their load accumulates.
//
// Reference: Jirasek, Prusinkiewicz & Moulia, Plant Biomechanics 2000.
//            ABOP Ch.2 tropism mechanics (T(e, alpha) symbol).



import { num, bool } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'angle',     type: 'range', min: 10,  max: 60,  default: 28,  step: 1,    label: 'branch angle °' },
  { key: 'tropism',   type: 'range', min: 0,   max: 1.5, default: 0.6, step: 0.05, label: 'tropism strength' },
  { key: 'growRate',  type: 'range', min: 0.2, max: 4,   default: 1.4, step: 0.1,  label: 'grow rate' },
  { key: 'maxDepth',  type: 'int',   min: 3,   max: 9,   default: 6,   step: 1,    label: 'max depth' },
  { key: 'taper',     type: 'range', min: 0.5, max: 0.95,default: 0.72,step: 0.01, label: 'length taper' },
  { key: 'showLoad',  type: 'boolean', default: false, label: 'colour by load' },
]













export const r2_lsys_01_tropism            = {
  id: 'r2-lsys-01-tropism',
  name: 'BIOMECHANICAL TROPISM',
  repo: 'Jirasek/Prusinkiewicz/Moulia 2000 + ABOP Ch.2',
  summary: 'SDF gradient replaces gravity as the tropism vector; branch headings bend inward weighted by accumulated mechanical load.',
  helps: 'Branches curve toward the letterform interior as they age — silhouette-hugging without hard clamping rules.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const segs        = []
    // Axiom: root near glyph centroid, pointing upward
    const cx = sdf.w / 2, cy = sdf.h / 2
    segs.push({ x: cx, y: cy, parent: -1, heading: -Math.PI / 2,
      depth: 0, length: 0, load: 0, age: 0, children: [], done: false })

    // Accumulate load bottom-up (recursive, called once after growth bursts)
    function updateLoad(i        )         {
      const s = segs[i]
      s.load = s.length
      for (const c of s.children) s.load += updateLoad(c)
      return s.load
    }

    let lastGrow = clock.nowSeconds()

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const angleRad   = (num(params, 'angle', 28) * Math.PI) / 180
      const alpha      = num(params, 'tropism', 0.6)
      const growRate   = num(params, 'growRate', 1.4)
      const maxDepth   = num(params, 'maxDepth', 6)
      const taper      = num(params, 'taper', 0.72)
      const colorLoad  = bool(params, 'showLoad', false)

      // --- Growth burst: one burst every (1/growRate) seconds ---
      const interval = 1 / growRate
      if (t - lastGrow >= interval) {
        lastGrow = t
        const liveTips = segs.reduce          ((a, s, i) => {
          if (!s.done && s.depth < maxDepth) a.push(i)
          return a
        }, [])
        for (const idx of liveTips) {
          const s = segs[idx]
          s.done = true
          const baseLen = Math.max(4, 14 * Math.pow(taper, s.depth))

          const spawn = (angOffset        ) => {
            // Apply tropism to initial heading: H' = H + alpha*(e - (H·e)H)
            const [gx, gy] = sdfGrad(sdf, s.x, s.y)
            const gm = Math.hypot(gx, gy) || 1
            const ex = -gx / gm, ey = -gy / gm   // inward unit vector
            let hx = Math.cos(s.heading + angOffset)
            let hy = Math.sin(s.heading + angOffset)
            const dot = hx * ex + hy * ey
            hx += alpha * (ex - dot * hx)
            hy += alpha * (ey - dot * hy)
            const hm = Math.hypot(hx, hy) || 1
            hx /= hm; hy /= hm

            const len = baseLen * (0.9 + rng() * 0.2)
            const nx = s.x + hx * len
            const ny = s.y + hy * len
            if (sdf.sample(nx, ny) >= 0) return

            const childIdx = segs.length
            segs.push({ x: nx, y: ny, parent: idx, heading: Math.atan2(hy, hx),
              depth: s.depth + 1, length: len, load: 0, age: 0, children: [], done: false })
            s.children.push(childIdx)
          }

          const bifurcate = rng() < 0.5
          if (bifurcate) {
            spawn(-angleRad * (0.8 + rng() * 0.4))
            spawn( angleRad * (0.8 + rng() * 0.4))
          } else {
            spawn((rng() - 0.5) * angleRad * 0.5)
          }
        }
        updateLoad(0)
      }

      // Age all segments
      for (const s of segs) s.age++

      // --- Render ---
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.18)', 1)

      ctx.lineCap = 'round'
      for (let i = 1; i < segs.length; i++) {
        const s = segs[i]
        const p = segs[s.parent]
        const loadNorm = Math.min(1, s.load / 120)
        ctx.lineWidth = Math.max(0.5, 2.5 - s.depth * 0.3)
        if (colorLoad) {
          const r = Math.round(80 + 160 * loadNorm)
          const g = Math.round(180 - 80 * loadNorm)
          const b = Math.round(230 - 100 * loadNorm)
          ctx.strokeStyle = `rgb(${r},${g},${b})`
        } else {
          const a = 0.35 + 0.55 * (1 - s.depth / 9)
          ctx.strokeStyle = `rgba(210,215,235,${a.toFixed(2)})`
        }
        ctx.beginPath()
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(s.x * sx, s.y * sy)
        ctx.stroke()
      }

      // Root dot
      ctx.fillStyle = '#f3c9c4'
      ctx.beginPath()
      ctx.arc(segs[0].x * sx, segs[0].y * sy, 2, 0, Math.PI * 2)
      ctx.fill()
    })
  },
}
