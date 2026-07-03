

import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, roleRGB } from '../common.js'

// Drossel-Schwabl forest-fire model. Three states: empty (0), tree (1),
// burning (2). Each tick: burning -> empty; tree catches fire from any burning
// neighbor; tree ignites spontaneously with probability f (lightning); empty
// grows tree with probability p. SOC emerges when f/p -> 0.
// SDF >= 0 cells are permanently empty — glyph boundary acts as firebreak.
//
// Reference: Drossel & Schwabl (1992) PRL 69:1629.

const PARAMS          = [
  { key: 'res',       type: 'int',   min: 80,   max: 220,  default: 160, step: 10    },
  { key: 'growthP',   type: 'range', min: 0.001,max: 0.08, default: 0.02,step: 0.001 },
  { key: 'lightningF',type: 'range', min: 0.00005,max: 0.005, default: 0.0003, step: 0.00005 },
  { key: 'stepsPerFrame', type: 'int', min: 1, max: 8, default: 3, step: 1 },
]

const EMPTY   = 0
const TREE    = 1
const BURNING = 2

export const r2_soc_03_forestfire            = {
  id: 'r2-soc-03-forestfire',
  name: 'FOREST FIRE',
  repo: 'Drossel-Schwabl 1992',
  summary: 'Trees grow into glyph interior, rare lightning ignites them, fire sweeps through connected clusters then regrows. p/f ratio controls canopy density vs fire frequency.',
  helps: 'Most visually legible SOC model — the green fill, catastrophic orange burn, and black regrowth cycle maps directly onto the letterform as a dramatic reveal rhythm.',

  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const G     = num(params, 'res', 160)
    const p     = num(params, 'growthP', 0.02)
    const f     = num(params, 'lightningF', 0.0003)
    const steps = num(params, 'stepsPerFrame', 3)

    const N    = G * G
    const isIn = new Uint8Array(N)
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        isIn[y * G + x] = sdf.sample(sx, sy) < 0 ? 1 : 0
      }
    }

    const grid  = new Uint8Array(N)
    const next  = new Uint8Array(N)

    // Seed initial forest
    for (let i = 0; i < N; i++) {
      if (isIn[i] && rng() < 0.6) grid[i] = TREE
    }

    const img = ctx.createImageData(G, G)
    const tmp = document.createElement('canvas')
    tmp.width = G; tmp.height = G
    const tc  = tmp.getContext('2d')

    const neighborBurning = (i        , x        , y        )          => {
      if (x > 0     && grid[i - 1] === BURNING) return true
      if (x < G - 1 && grid[i + 1] === BURNING) return true
      if (y > 0     && grid[i - G] === BURNING) return true
      if (y < G - 1 && grid[i + G] === BURNING) return true
      return false
    }

    const tick = () => {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          if (!isIn[i]) { next[i] = EMPTY; continue }
          const s = grid[i]
          if (s === BURNING) {
            next[i] = EMPTY
          } else if (s === TREE) {
            if (neighborBurning(i, x, y) || rng() < f) {
              next[i] = BURNING
            } else {
              next[i] = TREE
            }
          } else {
            next[i] = rng() < p ? TREE : EMPTY
          }
        }
      }
      grid.set(next)
    }

    return wrapLoop(() => {
      for (let s = 0; s < steps; s++) tick()

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (!isIn[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j + 1] = bg; img.data[j + 2] = bb; img.data[j + 3] = 255
          continue
        }
        const s = grid[i]
        // discrete states: tree→accent, burning→warm, empty interior→dim
        const [r, g, b] = roleRGB(s === TREE ? 'accent' : s === BURNING ? 'warm' : 'dim')
        img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b
        img.data[j + 3] = 255
      }

      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tmp, 0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
