// Eden Growth Model — Variant B (aperture-weighted perimeter)
// Maintain a candidate set of unoccupied boundary pixels. Each tick: pick one
// candidate (uniform = Variant A; weighted by local exposure = Variant B),
// occupy it, update the candidate set. Growth is compact, KPZ-rough surface.
//
// Eden (1961) Proc. 4th Berkeley Symp. · Meakin (1998) Ch. 3



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside } from '../common.js'

const PARAMS          = [
  { key: 'stepsPerFrame', type: 'int',   min: 10,  max: 600, default: 150, step: 20, label: 'steps/frame' },
  { key: 'lattice',       type: 'int',   min: 60,  max: 200, default: 120, step: 20, label: 'lattice size' },
  { key: 'variantB',      type: 'range', min: 0.0, max: 1.0, default: 0.7, step: 0.05, label: 'aperture wt' },
  { key: 'seeds',         type: 'int',   min: 1,   max: 6,   default: 2,   step: 1,  label: 'seed count' },
]

export const r2_stoch_04_eden            = {
  id: 'r2-stoch-04-eden',
  name: 'EDEN GROWTH',
  repo: 'Eden 1961 · Meakin 1998 · KPZ universality class',
  summary: 'Solid compact blob grows from random seeds, filling the glyph interior. Variant B weights boundary candidates by local exposure angle — concavities grow slower, exposed tips grow faster.',
  helps: 'Inverse of DLA — compact stain spreading to fill the mold, KPZ-rough surface, no branching. The spreading-ink aesthetic.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    let G   = num(params, 'lattice', 120)
    let spf = num(params, 'stepsPerFrame', 150)
    let wB  = num(params, 'variantB', 0.7)
    let nS  = num(params, 'seeds', 2)

    let state = buildState(G, nS)

    function buildState(g        , numSeeds        ) {
      const N      = g * g
      const inside = new Uint8Array(N)
      const occ    = new Uint8Array(N)   // occupied
      const cells           = []

      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i  = y * g + x
          const sx = (x + 0.5) / g * sdf.w
          const sy = (y + 0.5) / g * sdf.h
          if (sdf.sample(sx, sy) < 0) { inside[i] = 1; cells.push(i) }
        }
      }

      // perimeter: Set for O(1) delete + array for O(1) random sample
      const perimSet  = new Uint8Array(N)
      const perimArr           = []

      function addPerim(i        ) {
        if (!inside[i] || occ[i] || perimSet[i]) return
        perimSet[i] = 1
        perimArr.push(i)
      }

      function occupy(i        ) {
        occ[i] = 1
        perimSet[i] = 0
        // push unoccupied 4-neighbors
        const x0 = i % g, y0 = (i / g) | 0
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = x0 + dx, ny = y0 + dy
          if (nx < 0 || nx >= g || ny < 0 || ny >= g) continue
          addPerim(ny * g + nx)
        }
      }

      // plant seeds
      for (let s = 0; s < numSeeds; s++) {
        const [sx, sy] = sampleInside(sdf, rng)
        const gx = Math.min(g - 1, Math.max(0, Math.floor(sx / sdf.w * g)))
        const gy = Math.min(g - 1, Math.max(0, Math.floor(sy / sdf.h * g)))
        const si = gy * g + gx
        if (inside[si]) occupy(si)
      }

      return { inside, occ, perimSet, perimArr, g, cells, occupy }
    }

    // Aperture weight: count how many 4-neighbors of i are NOT occupied
    // (exposed to open space → higher weight in Variant B)
    function aperture(i        , g        , occ            , inside            )         {
      const x0 = i % g, y0 = (i / g) | 0
      let exp = 0
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x0 + dx, ny = y0 + dy
        if (nx < 0 || nx >= g || ny < 0 || ny >= g) { exp++; continue }
        const ni = ny * g + nx
        if (!inside[ni] || !occ[ni]) exp++
      }
      return exp
    }

    function pickRandom(g        , wB        , state                               )         {
      const { perimArr, perimSet, occ, inside } = state
      // Compact out dead entries lazily on each call
      let lo = 0
      while (lo < perimArr.length && (!perimSet[perimArr[lo]] || occ[perimArr[lo]])) lo++
      if (lo >= perimArr.length) return -1

      if (wB < 0.01) {
        // Variant A: uniform
        for (let tries = 0; tries < 20; tries++) {
          const j = lo + Math.floor(rng() * (perimArr.length - lo))
          const c = perimArr[j]
          if (perimSet[c] && !occ[c]) return c
        }
        return perimArr[lo]
      }

      // Variant B: weighted by aperture^wB (using rejection sampling over a few candidates)
      let best = -1, bestW = -1
      const trials = 8
      for (let t = 0; t < trials; t++) {
        const j = lo + Math.floor(rng() * (perimArr.length - lo))
        const c = perimArr[j]
        if (!perimSet[c] || occ[c]) continue
        const w = Math.pow(aperture(c, g, occ, inside), wB)
        if (w > bestW) { bestW = w; best = c }
      }
      return best >= 0 ? best : perimArr[lo]
    }

    const scaleX = () => W / state.g
    const scaleY = () => H / state.g

    return wrapLoop(() => {
      spf = num(params, 'stepsPerFrame', 150)
      wB  = num(params, 'variantB', 0.7)

      const { occ, perimSet, perimArr, g } = state
      for (let i = 0; i < spf; i++) {
        const c = pickRandom(g, wB, state)
        if (c >= 0) state.occupy(c)
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(240,230,210,0.15)', 1)

      const sx = scaleX(), sy = scaleY()

      // occupied — gradient by x+y position for depth cue
      for (let y = 0; y < g; y++) {
        for (let x = 0; x < g; x++) {
          const i = y * g + x
          if (!occ[i]) continue
          const t   = ((x + y) / (2 * g))
          const r   = Math.round(60  + t * 130)
          const gb  = Math.round(100 + t * 140)
          ctx.fillStyle = `rgb(${r},${r},${gb})`
          ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5)
        }
      }

      // perimeter highlight
      ctx.fillStyle = 'rgba(255,200,120,0.55)'
      for (const c of perimArr) {
        if (!perimSet[c]) continue
        ctx.fillRect((c % g) * sx, ((c / g | 0)) * sy, sx + 0.5, sy + 0.5)
      }
    })
  },
}
