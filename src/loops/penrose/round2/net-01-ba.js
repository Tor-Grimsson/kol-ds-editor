

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'N', type: 'int', min: 30, max: 400, default: 150, step: 10 },
  { key: 'm', type: 'int', min: 1, max: 8, default: 2, step: 1 },
  { key: 'addPerSec', type: 'int', min: 1, max: 30, default: 6, step: 1 },
  { key: 'nodeSize', type: 'range', min: 0.5, max: 4, default: 1.5, step: 0.5 },
]

export const r2_net_01_ba            = {
  id: 'r2-net-01-ba',
  name: 'BARABÁSI-ALBERT',
  repo: 'Barabási & Albert, Science 286 (1999)',
  summary:
    'Preferential attachment: each new node links to m existing nodes with probability proportional to degree. Power-law hubs emerge and settle inside the glyph.',
  helps: 'Scale-free hub-and-spoke topology growing live — degree concentration mirrors stroke-weight gradients.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h




    const nodes         = []
    const edges         = []
    let totalDeg = 0
    let lastAdd = clock.nowSeconds()

    const m0 = 4
    for (let i = 0; i < m0; i++) {
      const [x, y] = sampleInside(sdf, rng)
      nodes.push({ x, y, deg: 1 })
      totalDeg += 1
    }
    for (let i = 0; i < m0 - 1; i++) {
      edges.push({ a: i, b: i + 1 })
      nodes[i].deg++; nodes[i + 1].deg++; totalDeg += 2
    }

    function addNode(m        ) {
      const [x, y] = sampleInside(sdf, rng)
      const newId = nodes.length
      nodes.push({ x, y, deg: 0 })

      const chosen = new Set        ()
      let attempts = 0
      while (chosen.size < Math.min(m, nodes.length - 1) && attempts < 400) {
        attempts++
        const r = rng() * totalDeg
        let acc = 0
        for (let i = 0; i < nodes.length - 1; i++) {
          acc += nodes[i].deg
          if (acc >= r && !chosen.has(i)) { chosen.add(i); break }
        }
      }

      for (const t of chosen) {
        edges.push({ a: newId, b: t })
        nodes[t].deg++
        nodes[newId].deg++
        totalDeg += 2
      }
    }

    return wrapLoop(() => {
      const now = clock.nowSeconds()
      const N = num(params, 'N', 150)
      const m = num(params, 'm', 2)
      const addPerSec = num(params, 'addPerSec', 6)
      const nodeSize = num(params, 'nodeSize', 1.5)

      const dt = now - lastAdd
      const toAdd = Math.floor(dt * addPerSec)
      if (toAdd > 0 && nodes.length < N) {
        for (let i = 0; i < Math.min(toAdd, N - nodes.length); i++) addNode(m)
        lastAdd = now
      }
      if (nodes.length >= N) lastAdd = now

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      // edges — opacity by degree of brighter endpoint
      const maxDeg = nodes.reduce((a, n) => Math.max(a, n.deg), 1)
      ctx.lineWidth = 0.6
      for (const e of edges) {
        const na = nodes[e.a], nb = nodes[e.b]
        const brightness = Math.max(na.deg, nb.deg) / maxDeg
        ctx.strokeStyle = `rgba(170,200,240,${0.12 + brightness * 0.35})`
        ctx.beginPath()
        ctx.moveTo(na.x * sx, na.y * sy)
        ctx.lineTo(nb.x * sx, nb.y * sy)
        ctx.stroke()
      }

      // nodes — radius proportional to sqrt(degree)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const r = nodeSize * Math.sqrt(n.deg)
        const t = n.deg / maxDeg
        ctx.fillStyle = `rgba(${Math.round(180 + t * 75)},${Math.round(180 - t * 60)},${Math.round(220 - t * 80)},0.85)`
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
