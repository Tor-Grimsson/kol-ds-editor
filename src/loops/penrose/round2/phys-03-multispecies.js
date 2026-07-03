// Multi-Species Competitive Physarum.
// Two independent agent populations maintain separate trail channels.
// Each species attracts its own trail and repels foreign trails.
// Competing vein nets fill the glyph from different seed zones;
// collision zones form dynamic territorial seams.
// Reference: Jones 2010; Softology 2019; fogleman/physarum.



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sampleInside, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'agents',   type: 'int',   min: 200,  max: 2000, default: 800,  step: 100,  label: 'agents/species' },
  { key: 'sensAng',  type: 'range', min: 0.1,  max: 1.5,  default: 0.45, step: 0.02, label: 'sensor angle' },
  { key: 'sensDist', type: 'range', min: 3,    max: 30,   default: 9,    step: 0.5,  label: 'sensor dist' },
  { key: 'deposit',  type: 'range', min: 0.01, max: 0.3,  default: 0.09, step: 0.01, label: 'deposit' },
  { key: 'decay',    type: 'range', min: 0.85, max: 0.99, default: 0.95, step: 0.005, label: 'decay' },
  { key: 'repel',    type: 'range', min: 0.0,  max: 1.5,  default: 0.7,  step: 0.05, label: 'cross-repel' },
]

const GS = 160
const N_SPECIES = 2

export const r2_phys_03_multispecies            = {
  id: 'r2-phys-03-multispecies',
  name: 'COMPETITIVE PHYSARUM',
  repo: 'Jones 2010 + Softology 2019 species matrix',
  summary: 'Two species each attract their own trail and repel the other. Territory boundaries and interlocking vein nets emerge from the stigmergic cross-inhibition — the glyph interior splits into living territories.',
  helps: 'High visual dynamism throughout territorial formation; two-tone color makes species borders immediately legible.',
  params: PARAMS,

  init({ ctx, sdf, W, H, rng, params }) {
    const N_EACH = num(params, 'agents',   800)
    const SA     = num(params, 'sensAng',  0.45)
    const SD     = num(params, 'sensDist', 9)
    const DA     = num(params, 'deposit',  0.09)
    const DECAY  = num(params, 'decay',    0.95)
    const REPEL  = num(params, 'repel',    0.7)

    const TAU = Math.PI * 2
    const RA  = 0.3

    // One trail buffer per species
    const trails = [new Float32Array(GS * GS), new Float32Array(GS * GS)]
    const isIn   = new Uint8Array(GS * GS)
    for (let y = 0; y < GS; y++)
      for (let x = 0; x < GS; x++)
        isIn[y * GS + x] = sdf.sample((x / GS) * sdf.w, (y / GS) * sdf.h) < 0 ? 1 : 0

    const tSample = (sp        , x        , y        )         => {
      const ix = Math.max(0, Math.min(GS - 1, Math.round(x)))
      const iy = Math.max(0, Math.min(GS - 1, Math.round(y)))
      return trails[sp][iy * GS + ix]
    }
    const score = (sp        , x        , y        )         =>
      tSample(sp, x, y) - REPEL * tSample(1 - sp, x, y)

    // Agents per species
    const ax = [new Float32Array(N_EACH), new Float32Array(N_EACH)]
    const ay = [new Float32Array(N_EACH), new Float32Array(N_EACH)]
    const aa = [new Float32Array(N_EACH), new Float32Array(N_EACH)]

    // Bias initial spawn positions toward opposite halves
    for (let sp = 0; sp < N_SPECIES; sp++) {
      for (let i = 0; i < N_EACH; i++) {
        let [sx, sy] = sampleInside(sdf, rng)
        // Species 0 seeded in upper half, species 1 in lower half
        let tries = 0
        while (tries < 40 && (sp === 0 ? sy > sdf.h * 0.5 : sy < sdf.h * 0.5)) {
          ;[sx, sy] = sampleInside(sdf, rng)
          tries++
        }
        ax[sp][i] = (sx / sdf.w) * GS
        ay[sp][i] = (sy / sdf.h) * GS
        aa[sp][i] = rng() * TAU
      }
    }

    const img = ctx.createImageData(GS, GS)
    const tmp = document.createElement('canvas')
    tmp.width = GS; tmp.height = GS
    const tc = tmp.getContext('2d')

    return wrapLoop(() => {
      for (let sp = 0; sp < N_SPECIES; sp++) {
        for (let i = 0; i < N_EACH; i++) {
          const ang = aa[sp][i]
          const sL = score(sp, ax[sp][i] + Math.cos(ang - SA) * SD, ay[sp][i] + Math.sin(ang - SA) * SD)
          const sF = score(sp, ax[sp][i] + Math.cos(ang) * SD,      ay[sp][i] + Math.sin(ang) * SD)
          const sR = score(sp, ax[sp][i] + Math.cos(ang + SA) * SD, ay[sp][i] + Math.sin(ang + SA) * SD)

          if (sF >= sL && sF >= sR) {
            // keep
          } else if (sL > sR) {
            aa[sp][i] -= RA
          } else if (sR > sL) {
            aa[sp][i] += RA
          } else {
            aa[sp][i] += (rng() < 0.5 ? -1 : 1) * RA
          }

          const nx = ax[sp][i] + Math.cos(aa[sp][i])
          const ny = ay[sp][i] + Math.sin(aa[sp][i])
          if (nx >= 0 && nx < GS && ny >= 0 && ny < GS &&
              sdf.sample((nx / GS) * sdf.w, (ny / GS) * sdf.h) < 0) {
            ax[sp][i] = nx; ay[sp][i] = ny
          } else {
            aa[sp][i] = rng() * TAU
          }

          const ix = Math.max(0, Math.min(GS - 1, Math.round(ax[sp][i])))
          const iy = Math.max(0, Math.min(GS - 1, Math.round(ay[sp][i])))
          trails[sp][iy * GS + ix] = Math.min(1, trails[sp][iy * GS + ix] + DA)
        }

        // Decay + diffuse
        const tmp2 = new Float32Array(trails[sp])
        for (let y = 1; y < GS - 1; y++) {
          for (let x = 1; x < GS - 1; x++) {
            if (!isIn[y * GS + x]) continue
            let s = 0
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                s += tmp2[(y + dy) * GS + (x + dx)]
            trails[sp][y * GS + x] = (s / 9) * DECAY
          }
        }
      }

      // Render: species 0 → warm, species 1 → accent (discrete roles)
      const [bgr, bgg, bgb] = roleRGB('bg')
      const [w0r, w0g, w0b] = roleRGB('warm')
      const [a1r, a1g, a1b] = roleRGB('accent')
      for (let i = 0; i < GS * GS; i++) {
        const j = i * 4
        if (!isIn[i]) {
          img.data[j] = bgr; img.data[j+1] = bgg; img.data[j+2] = bgb; img.data[j+3] = 255
          continue
        }
        const a = Math.min(1, trails[0][i] * 2.5)
        const b = Math.min(1, trails[1][i] * 2.5)
        // additive blend from bg toward each species' role colour
        img.data[j]   = Math.min(255, (bgr + (w0r - bgr) * a + (a1r - bgr) * b)) | 0
        img.data[j+1] = Math.min(255, (bgg + (w0g - bgg) * a + (a1g - bgg) * b)) | 0
        img.data[j+2] = Math.min(255, (bgb + (w0b - bgb) * a + (a1b - bgb) * b)) | 0
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
