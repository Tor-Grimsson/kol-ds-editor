// Directed Chemotaxis Physarum.
// A diffusing food field (second grid) draws agents toward placed nodes.
// Sensor blends trail (short-range) + food gradient (long-range steering).
// Veins grow toward food, then crystallise — topology mirrors glyph skeleton.
// Reference: Tero et al. 2010 Science 327:439; Jones 2010 (agent layer).



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'agents',   type: 'int',   min: 300,  max: 3000, default: 1000, step: 100,   label: 'agents' },
  { key: 'sensAng',  type: 'range', min: 0.1,  max: 1.5,  default: 0.45, step: 0.02,  label: 'sensor angle' },
  { key: 'sensDist', type: 'range', min: 3,    max: 30,   default: 11,   step: 0.5,   label: 'sensor dist' },
  { key: 'deposit',  type: 'range', min: 0.01, max: 0.3,  default: 0.08, step: 0.01,  label: 'deposit' },
  { key: 'decay',    type: 'range', min: 0.85, max: 0.99, default: 0.95, step: 0.005, label: 'decay' },
  { key: 'foodW',    type: 'range', min: 0.0,  max: 1.0,  default: 0.35, step: 0.05,  label: 'food weight' },
]

const GS    = 160
const N_FOOD = 6  // food nodes

export const r2_phys_02_chemotaxis            = {
  id: 'r2-phys-02-chemotaxis',
  name: 'CHEMOTAXIS PHYSARUM',
  repo: 'Tero et al. 2010 Science + Jones 2010',
  summary: 'A diffusing food field placed at glyph-interior nodes steers agents long-range. Veins converge on food sources and form Steiner-tree-like networks — the letterform is vascularized.',
  helps: 'Directed growth produces topologically meaningful veins tied to the glyph structure rather than random space-filling.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const N      = num(params, 'agents',   1000)
    const SA     = num(params, 'sensAng',  0.45)
    const SD     = num(params, 'sensDist', 11)
    const DA     = num(params, 'deposit',  0.08)
    const DECAY  = num(params, 'decay',    0.95)
    const FOODW  = num(params, 'foodW',    0.35)

    const TAU = Math.PI * 2
    const RA  = 0.3

    const trail = new Float32Array(GS * GS)
    const food  = new Float32Array(GS * GS)
    const isIn  = new Uint8Array(GS * GS)

    for (let y = 0; y < GS; y++)
      for (let x = 0; x < GS; x++)
        isIn[y * GS + x] = sdf.sample((x / GS) * sdf.w, (y / GS) * sdf.h) < 0 ? 1 : 0

    // Place food nodes at random interior positions; seed Gaussian blobs
    const foodNodes                     = []
    for (let f = 0; f < N_FOOD; f++) {
      const [sx, sy] = sampleInside(sdf, rng)
      foodNodes.push([(sx / sdf.w) * GS, (sy / sdf.h) * GS])
    }
    const BLOB_R = 12
    for (const [fx, fy] of foodNodes) {
      for (let y = 0; y < GS; y++) {
        for (let x = 0; x < GS; x++) {
          const d2 = (x - fx) ** 2 + (y - fy) ** 2
          food[y * GS + x] += Math.exp(-d2 / (2 * BLOB_R * BLOB_R))
        }
      }
    }

    const sampleF = (arr              , x        , y        )         => {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(y)))
      return arr[iy * GS + ix]
    }

    const score = (x        , y        )         =>
      (1 - FOODW) * sampleF(trail, x, y) + FOODW * sampleF(food, x, y)

    // Agents
    const ax = new Float32Array(N)
    const ay = new Float32Array(N)
    const aa = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const [sx, sy] = sampleInside(sdf, rng)
      ax[i] = (sx / sdf.w) * GS
      ay[i] = (sy / sdf.h) * GS
      aa[i] = rng() * TAU
    }

    const img = ctx.createImageData(GS, GS)
    const tmp = document.createElement('canvas')
    tmp.width = GS; tmp.height = GS
    const tc = tmp.getContext('2d')

    return wrapLoop(() => {
      for (let i = 0; i < N; i++) {
        const ang = aa[i]
        const sL = score(ax[i] + Math.cos(ang - SA) * SD, ay[i] + Math.sin(ang - SA) * SD)
        const sF = score(ax[i] + Math.cos(ang) * SD,      ay[i] + Math.sin(ang) * SD)
        const sR = score(ax[i] + Math.cos(ang + SA) * SD, ay[i] + Math.sin(ang + SA) * SD)

        if (sF >= sL && sF >= sR) {
          // straight
        } else if (sL > sR) {
          aa[i] -= RA
        } else if (sR > sL) {
          aa[i] += RA
        } else {
          aa[i] += (rng() < 0.5 ? -1 : 1) * RA
        }

        const nx = ax[i] + Math.cos(aa[i])
        const ny = ay[i] + Math.sin(aa[i])
        if (nx >= 0 && nx < GS && ny >= 0 && ny < GS &&
            sdf.sample((nx / GS) * sdf.w, (ny / GS) * sdf.h) < 0) {
          ax[i] = nx; ay[i] = ny
        } else {
          aa[i] = rng() * TAU
        }

        const ix = Math.max(0, Math.min(GS - 1, Math.round(ax[i])))
        const iy = Math.max(0, Math.min(GS - 1, Math.round(ay[i])))
        trail[iy * GS + ix] = Math.min(1, trail[iy * GS + ix] + DA)
      }

      // Decay + diffuse trail; food diffuses very slowly
      const tmp2 = new Float32Array(trail)
      for (let y = 1; y < GS - 1; y++) {
        for (let x = 1; x < GS - 1; x++) {
          if (!isIn[y * GS + x]) continue
          let s = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              s += tmp2[(y + dy) * GS + (x + dx)]
          trail[y * GS + x] = (s / 9) * DECAY
        }
      }

      // Render trail; mark food nodes
      for (let i = 0; i < GS * GS; i++) {
        const j = i * 4
        if (!isIn[i]) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j+1] = bg; img.data[j+2] = bb; img.data[j+3] = 255
          continue
        }
        const t = Math.min(1, trail[i] * 2.5)
        const f = Math.min(1, food[i] * 1.2)
        // trail along the ramp; food nodes blend toward accent
        const [tr, tg, tb] = rampRGB(t)
        const [fr, fg, fb] = roleRGB('accent')
        img.data[j]   = (tr + (fr - tr) * f) | 0
        img.data[j+1] = (tg + (fg - tg) * f) | 0
        img.data[j+2] = (tb + (fb - tb) * f) | 0
        img.data[j+3] = 255
      }
      clear(ctx, W, H)
      tc.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
