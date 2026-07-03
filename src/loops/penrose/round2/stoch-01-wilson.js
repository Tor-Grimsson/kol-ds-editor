// Wilson's Algorithm — Loop-Erased Random Walk → Uniform Spanning Tree
// Each frame: advance the active walker N steps, detect loops (erase them),
// commit the path when it hits the growing tree. Live walker visible as
// a bright tendril; committed branches grow steadily to fill the glyph.
//
// Wilson (1996) STOC · Bostock gist https://gist.github.com/mbostock/11357811



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

const PARAMS          = [
  { key: 'stepsPerFrame', type: 'int',   min: 10,  max: 400, default: 80,  step: 10,   label: 'steps/frame' },
  { key: 'lattice',       type: 'int',   min: 40,  max: 160, default: 90,  step: 10,   label: 'lattice size' },
  { key: 'walkerBright',  type: 'range', min: 0.2, max: 1.0, default: 0.9, step: 0.05, label: 'walker alpha' },
]

export const r2_stoch_01_wilson            = {
  id: 'r2-stoch-01-wilson',
  name: 'WILSON LERW / UST',
  repo: 'Wilson 1996 STOC · Bostock gist/11357811',
  summary: 'Loop-erased random walk builds a uniform spanning tree on a lattice inside the glyph. The live walker wanders, erases its own loops, and snaps into the growing tree on contact.',
  helps: 'Dramatic live walk + loop erasure + tree fill — the most visually theatrical stochastic growth algorithm.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    let G      = num(params, 'lattice', 90)
    let spf    = num(params, 'stepsPerFrame', 80)
    let wAlpha = num(params, 'walkerBright', 0.9)

    function buildGrid(g        ) {
      const inside = new Uint8Array(g * g)
      const cells           = []
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (sdf.sample((x + 0.5) / g * sdf.w, (y + 0.5) / g * sdf.h) < 0) {
            inside[i] = 1
            cells.push(i)
          }
        }
      }
      return { inside, cells }
    }

    let grid = buildGrid(G)

    const inTree  = new Uint8Array(G * G)
    const pathMap = new Int32Array(G * G).fill(-1) // points toward start of walk
    const committed                          = []  // [child, parent] pairs in the tree

    function neighbors(idx        , g        , inside            )           {
      const x = idx % g, y = (idx / g) | 0
      const nb           = []
      if (x > 0     && inside[idx - 1]) nb.push(idx - 1)
      if (x < g - 1 && inside[idx + 1]) nb.push(idx + 1)
      if (y > 0     && inside[idx - g]) nb.push(idx - g)
      if (y < g - 1 && inside[idx + g]) nb.push(idx + g)
      return nb
    }

    let walkerPos = -1

    function pickNextWalker() {
      const unvisited = grid.cells.filter(c => !inTree[c])
      if (unvisited.length === 0) { walkerPos = -1; return }
      walkerPos = unvisited[Math.floor(rng() * unvisited.length)]
      pathMap[walkerPos] = walkerPos // sentinel: path start
    }

    // Plant seed
    if (grid.cells.length > 0) {
      const seed = grid.cells[Math.floor(rng() * grid.cells.length)]
      inTree[seed] = 1
    }
    pickNextWalker()

    function commitPath(treeEntry        ) {
      let cur = walkerPos
      while (cur !== treeEntry) {
        const nxt = pathMap[cur]
        if (nxt < 0 || nxt === cur) break
        committed.push([cur, nxt])
        inTree[cur] = 1
        cur = nxt
      }
    }

    function stepWalker() {
      if (walkerPos < 0) return
      const nb = neighbors(walkerPos, G, grid.inside)
      if (nb.length === 0) { pickNextWalker(); return }
      const next = nb[Math.floor(rng() * nb.length)]

      if (inTree[next]) {
        commitPath(next)
        pickNextWalker()
        return
      }

      // Loop erasure: if next is already in the current walk path, erase from walkerPos back to next
      if (pathMap[next] !== -1) {
        let cur = walkerPos
        while (cur !== next) {
          const prev = pathMap[cur]
          pathMap[cur] = -1
          if (prev < 0 || prev === cur) break
          cur = prev
        }
        walkerPos = next
        return
      }

      pathMap[next] = walkerPos // chain toward start
      walkerPos = next
    }

    const sx = W / G, sy = H / G

    return wrapLoop(() => {
      spf    = num(params, 'stepsPerFrame', 80)
      wAlpha = num(params, 'walkerBright', 0.9)

      for (let i = 0; i < spf; i++) stepWalker()

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(240,230,210,0.15)', 1)

      // committed tree edges
      ctx.strokeStyle = 'rgba(140,195,240,0.85)'
      ctx.lineWidth   = 0.9
      ctx.beginPath()
      for (const [a, b] of committed) {
        ctx.moveTo((a % G + 0.5) * sx, ((a / G | 0) + 0.5) * sy)
        ctx.lineTo((b % G + 0.5) * sx, ((b / G | 0) + 0.5) * sy)
      }
      ctx.stroke()

      // live walker path
      if (walkerPos >= 0) {
        ctx.strokeStyle = `rgba(255,210,80,${wAlpha.toFixed(2)})`
        ctx.lineWidth   = 1.2
        ctx.beginPath()
        let cur    = walkerPos
        let moved  = false
        ctx.moveTo((cur % G + 0.5) * sx, ((cur / G | 0) + 0.5) * sy)
        let safety = 0
        while (pathMap[cur] >= 0 && pathMap[cur] !== cur && safety++ < 2000) {
          cur = pathMap[cur]
          ctx.lineTo((cur % G + 0.5) * sx, ((cur / G | 0) + 0.5) * sy)
          moved = true
        }
        if (moved) ctx.stroke()

        ctx.fillStyle = `rgba(255,240,120,${wAlpha.toFixed(2)})`
        ctx.beginPath()
        ctx.arc((walkerPos % G + 0.5) * sx, ((walkerPos / G | 0) + 0.5) * sy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
