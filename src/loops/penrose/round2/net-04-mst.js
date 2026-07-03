

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'N', type: 'int', min: 20, max: 200, default: 80, step: 5 },
  { key: 'edgesPerSec', type: 'int', min: 1, max: 40, default: 10, step: 1 },
  { key: 'depthBias', type: 'range', min: 0, max: 1, default: 0.6, step: 0.05, label: 'medialBias' },
]

export const r2_net_04_mst            = {
  id: 'r2-net-04-mst',
  name: 'MST MEDIAL AXIS VEIN',
  repo: 'Kruskal (1956) + Blum medial axis (1967)',
  summary:
    'Nodes biased toward SDF interior ridges (medial axis). Kruskal MST grows edge-by-edge, shortest non-cycle connection first. Result: a vein network tracing the letterform skeleton.',
  helps: 'MST on medial-axis samples directly reconstructs the glyph skeleton — veins grow outward from the thickest stroke.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    class UF {
      parent            ; rank
      constructor(n        ) {
        this.parent = new Int32Array(n).map((_, i) => i)
        this.rank = new Uint8Array(n)
      }
      find(x        )         {
        while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x] }
        return x
      }
      union(a        , b        )          {
        a = this.find(a); b = this.find(b)
        if (a === b) return false
        if (this.rank[a] < this.rank[b]) [a, b] = [b, a]
        this.parent[b] = a
        if (this.rank[a] === this.rank[b]) this.rank[a]++
        return true
      }
    }

    let nodes                                                 = []
    let sortedEdges                                             = []
    let mstEdges                                                 = []
    let uf
    let edgeIdx = 0
    let lastAdd = 0
    let prevN = -1, prevBias = -1

    function rebuild(N        , depthBias        ) {
      nodes = []
      // Sample nodes biased toward medial axis (high interior depth = near center)
      const candidates                                                 = []
      for (let i = 0; i < N * 8; i++) {
        const [x, y] = sampleInside(sdf, rng)
        const d = -sdf.sample(x, y) // positive = inside
        candidates.push({ x, y, depth: d })
      }
      // Accept with probability proportional to depth^depthBias
      const maxDepth = Math.max(...candidates.map(c => c.depth))
      for (const c of candidates) {
        if (nodes.length >= N) break
        const p = Math.pow(c.depth / maxDepth, depthBias)
        if (rng() < p) nodes.push(c)
      }
      while (nodes.length < N) {
        const [x, y] = sampleInside(sdf, rng)
        nodes.push({ x, y, depth: -sdf.sample(x, y) })
      }

      // All pairs sorted by Euclidean distance (Kruskal)
      const all                                             = []
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y
          all.push({ a: i, b: j, w: Math.sqrt(dx * dx + dy * dy) })
        }
      all.sort((a, b) => a.w - b.w)

      sortedEdges = all
      mstEdges = []
      uf = new UF(nodes.length)
      edgeIdx = 0
      lastAdd = clock.nowSeconds()
    }

    function segInside(ax        , ay        , bx        , by        )          {
      const steps = 6
      for (let i = 1; i < steps; i++) {
        const t = i / steps
        if (sdf.sample(ax + (bx - ax) * t, ay + (by - ay) * t) >= 0) return false
      }
      return true
    }

    return wrapLoop(() => {
      const N = num(params, 'N', 80)
      const edgesPerSec = num(params, 'edgesPerSec', 10)
      const depthBias = num(params, 'depthBias', 0.6)

      if (N !== prevN || Math.abs(depthBias - prevBias) > 0.01) {
        rebuild(N, depthBias); prevN = N; prevBias = depthBias
      }

      const now = clock.nowSeconds()
      const dt = now - lastAdd
      const toAdd = Math.floor(dt * edgesPerSec)

      if (toAdd > 0 && edgeIdx < sortedEdges.length) {
        let added = 0
        while (added < toAdd && edgeIdx < sortedEdges.length) {
          const e = sortedEdges[edgeIdx++]
          const na = nodes[e.a], nb = nodes[e.b]
          if (segInside(na.x, na.y, nb.x, nb.y)) {
            if (uf.union(e.a, e.b)) {
              const avgDepth = (na.depth + nb.depth) / 2
              mstEdges.push({ a: e.a, b: e.b, depth: avgDepth })
              added++
            }
          }
        }
        lastAdd = now
      }

      // Restart when MST complete
      if (mstEdges.length >= nodes.length - 1) rebuild(N, depthBias)

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      const maxDepth = Math.max(...nodes.map(n => n.depth), 1)

      ctx.lineCap = 'round'
      for (const e of mstEdges) {
        const na = nodes[e.a], nb = nodes[e.b]
        const t = e.depth / maxDepth
        const w = 0.5 + t * 2.5
        ctx.lineWidth = w
        ctx.strokeStyle = `rgba(${Math.round(140 + t * 100)},${Math.round(200 + t * 30)},${Math.round(180 - t * 60)},${0.4 + t * 0.45})`
        ctx.beginPath()
        ctx.moveTo(na.x * sx, na.y * sy)
        ctx.lineTo(nb.x * sx, nb.y * sy)
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(210,230,215,0.7)'
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x * sx, n.y * sy, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
