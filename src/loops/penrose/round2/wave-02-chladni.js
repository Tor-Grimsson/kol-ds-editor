// Chladni membrane — standing wave superposition on the glyph domain.
// Approximates eigenmodes via weighted random Fourier modes (cos(kx·x + ky·y + φ)),
// masked to the glyph interior. Two modes mix with slowly evolving weights:
//   u(t) = cos(ω1·t)·φ1 + cos(ω2·t)·φ2
// Bright = crest/trough; dark band at u≈0 is the nodal line (where sand collects).
//
// Reference: Chladni 1787; Müller arXiv:1308.5523



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 80, max: 180, default: 140, step: 20,  label: 'grid res' },
  { key: 'modeA', type: 'int',   min: 1,  max: 12,  default: 3,   step: 1,   label: 'mode A index' },
  { key: 'modeB', type: 'int',   min: 1,  max: 12,  default: 5,   step: 1,   label: 'mode B index' },
  { key: 'speed', type: 'range', min: 0.05, max: 1.0, default: 0.25, step: 0.05, label: 'beat speed' },
  { key: 'nodal', type: 'range', min: 0.02, max: 0.25, default: 0.08, step: 0.01, label: 'nodal band' },
]

// Pre-baked (m,n) mode pairs for a rectangular-ish domain
const MODES                          = [
  [1,1],[1,2],[2,1],[2,2],[1,3],[3,1],[2,3],[3,2],[3,3],[1,4],[4,1],[2,4],
]

export const r2_wave_02_chladni            = {
  id: 'r2-wave-02-chladni',
  name: 'CHLADNI MEMBRANE',
  repo: 'Chladni 1787 · Müller arXiv:1308.5523',
  summary: 'Standing-wave superposition on the glyph-shaped membrane. Two eigenmodes beat against each other; bright regions vibrate, the dark nodal band reveals where sand would settle in Chladni\'s original experiment.',
  helps: 'The glyph IS the membrane — its geometry uniquely determines the nodal topology.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    const G  = num(params, 'res', 140)
    const N  = G * G

    // Pre-compute SDF mask and bounding box
    const mask = new Uint8Array(N)
    let xMin = G, xMax = 0, yMin = G, yMax = 0
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const sx = (x / G) * sdf.w
        const sy = (y / G) * sdf.h
        if (sdf.sample(sx, sy) < 0) {
          mask[y * G + x] = 1
          if (x < xMin) xMin = x; if (x > xMax) xMax = x
          if (y < yMin) yMin = y; if (y > yMax) yMax = y
        }
      }
    }
    const bW = xMax - xMin + 1 || G
    const bH = yMax - yMin + 1 || G

    // Evaluate mode (m,n): cos(m·π·(x-xMin)/bW) · cos(n·π·(y-yMin)/bH)
    // This is the Neumann (free-edge) solution on a rectangle; Dirichlet would use sin.
    // Mask enforces Dirichlet on the actual glyph boundary.
    const evalMode = (m        , n        , x        , y        )         => {
      const nx = ((x - xMin) / bW) * Math.PI * m
      const ny = ((y - yMin) / bH) * Math.PI * n
      return Math.sin(nx) * Math.sin(ny)
    }

    // Natural frequency ∝ sqrt(m² + n²)
    const freq = (m        , n        ) => Math.sqrt(m * m + n * n)

    const img = ctx.createImageData(G, G)
    const tmpC = document.createElement('canvas')
    tmpC.width = G; tmpC.height = G
    const tctx = tmpC.getContext('2d')

    return wrapLoop(() => {
      const t      = clock.nowSeconds()
      const modeA  = Math.max(0, Math.min(MODES.length - 1, num(params, 'modeA', 3) - 1))
      const modeB  = Math.max(0, Math.min(MODES.length - 1, num(params, 'modeB', 5) - 1))
      const speed  = num(params, 'speed', 0.25)
      const band   = num(params, 'nodal', 0.08)

      const [mA, nA] = MODES[modeA]
      const [mB, nB] = MODES[modeB]
      const wA = freq(mA, nA) * speed
      const wB = freq(mB, nB) * speed
      const cA = Math.cos(wA * t)
      const cB = Math.cos(wB * t)

      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const i = y * G + x
          const j = i * 4
          if (!mask[i]) {
            const [br, bgc, bb] = roleRGB('bg')
            img.data[j] = br; img.data[j+1] = bgc; img.data[j+2] = bb; img.data[j+3] = 255
            continue
          }
          const u = cA * evalMode(mA, nA, x, y) + cB * evalMode(mB, nB, x, y)
          const abs = Math.abs(u)
          // nodal line: u near 0 → bg end of ramp. Away from zero → bright end
          const bright = abs < band ? abs / band : 1.0
          const [r, g, b] = rampRGB(bright)
          img.data[j] = r; img.data[j+1] = g; img.data[j+2] = b; img.data[j+3] = 255
        }
      }

      clear(ctx, W, H)
      tctx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmpC, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
