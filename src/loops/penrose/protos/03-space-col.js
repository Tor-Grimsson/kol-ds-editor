
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'




// Space colonization (Runions 2007). Scatter attractors inside the SDF;
// each branch node grows toward the average direction of attractors within
// a perception radius; attractors die once a branch gets close. Produces
// the venation / root-system / dendrite look.
//
// Reference: jasonwebb/2d-space-colonization-experiments
// Paper: algorithmicbotany.org/papers/colonization.egwnp2007.pdf
export const spaceCol            = {
  id: '03-space-col',
  name: 'SPACE COLONIZATION',
  repo: 'jasonwebb/2d-space-colonization-experiments',
  summary:
    'Runions 2007 venation algorithm. Attractors live inside the glyph; each branch tip advances toward the mean of its visible attractors; attractors die on contact. Output is dendritic — like a root system conforming to the letter.',
  helps:
    'Venation / radial-spoke vocabulary that matches the ref-image cell structure. Multiple trees can co-grow and compete for attractors → natural layer interaction (two layers = two trees that steal each other\'s auxin).',
  params: [
    { key: 'attractorCount', type: 'int', min: 100, max: 2400, step: 50, default: 900, label: 'attractors' },
    { key: 'perception', type: 'int', min: 20, max: 200, default: 80, label: 'perception' },
    { key: 'killDist', type: 'range', min: 2, max: 30, step: 0.5, default: 8, label: 'kill dist' },
    { key: 'stepSize', type: 'range', min: 1, max: 10, step: 0.5, default: 3, label: 'step size' },
  ],
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const { attractorCount, perception, killDist, stepSize } = params

    const attractors              = []
    while (attractors.length < attractorCount) {
      const [x, y] = sampleInside(sdf, rng, 1)
      if (sdf.sample(x, y) < -3) attractors.push({ x, y, alive: true })
    }

    const branches           = []
    // seed: start from a random interior point with no parent
    const [sx0, sy0] = sampleInside(sdf, rng)
    branches.push({ x: sx0, y: sy0, parent: -1, alive: true })

    return wrapLoop(() => {
      const perception2 = perception * perception
      const kill2 = killDist * killDist

      // For each live attractor, find nearest live branch within perception
      const pulls = new Map                                               ()
      for (const atr of attractors) {
        if (!atr.alive) continue
        let best = -1
        let bestD2 = perception2
        for (let i = 0; i < branches.length; i++) {
          const b = branches[i]
          if (!b.alive) continue
          const dx = atr.x - b.x, dy = atr.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 < bestD2) { bestD2 = d2; best = i }
        }
        if (best < 0) continue
        if (bestD2 < kill2) { atr.alive = false; continue }
        const b = branches[best]
        const dx = atr.x - b.x, dy = atr.y - b.y
        const m = Math.hypot(dx, dy) || 1
        const cur = pulls.get(best) ?? { dx: 0, dy: 0, n: 0 }
        cur.dx += dx / m
        cur.dy += dy / m
        cur.n += 1
        pulls.set(best, cur)
      }

      // Grow branches toward mean attractor direction
      const newBranches           = []
      for (const [idx, p] of pulls.entries()) {
        const m = Math.hypot(p.dx, p.dy) || 1
        const b = branches[idx]
        const nx = b.x + (p.dx / m) * stepSize
        const ny = b.y + (p.dy / m) * stepSize
        if (sdf.sample(nx, ny) < 0) {
          newBranches.push({ x: nx, y: ny, parent: idx, alive: true })
        }
      }
      const base = branches.length
      for (const nb of newBranches) branches.push(nb)

      // Previous tips lose 'alive' if they didn't grow (no pulls)
      for (let i = 0; i < base; i++) {
        if (!pulls.has(i)) { /* still alive, maybe grows next tick */ }
      }

      // Render
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243, 231, 207, 0.18)', 1)

      // edges
      ctx.strokeStyle = 'rgba(210, 215, 235, 0.7)'
      ctx.lineWidth = 1.0
      ctx.beginPath()
      for (let i = 0; i < branches.length; i++) {
        const b = branches[i]
        if (b.parent < 0) continue
        const p = branches[b.parent]
        ctx.moveTo(p.x * sx, p.y * sy)
        ctx.lineTo(b.x * sx, b.y * sy)
      }
      ctx.stroke()

      // attractors (dim)
      ctx.fillStyle = 'rgba(170, 174, 220, 0.5)'
      for (const atr of attractors) {
        if (!atr.alive) continue
        ctx.beginPath()
        ctx.arc(atr.x * sx, atr.y * sy, 0.9, 0, Math.PI * 2)
        ctx.fill()
      }

      // branch nodes
      ctx.fillStyle = '#f3c9c4'
      for (const b of branches) {
        ctx.beginPath()
        ctx.arc(b.x * sx, b.y * sy, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
