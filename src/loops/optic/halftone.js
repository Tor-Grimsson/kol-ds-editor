import { TAU, clamp01 } from '../lib/util.js'

// Halftone dot-matrix engine — a scalar field sampled on a grid of cells, each
// drawn as a dot/square/ring sized + coloured by the field value. The signature
// moodboard look (Drekker "Degrees" dot-sphere, naumann bead spirals). Canvas2D.
//
// Ported from kol-labs-single optic/halftone. Time is woven for the loop
// contract: the labs' free-running seconds `t` becomes a phase
// ph = TAU · u · flow (integer cycles) so frame(0) === frame(1) exactly — see
// sampleField for the per-branch adaptations. The photo-luma blend (source
// filter mode) stayed behind in labs; a loop has no media input.

export const FIELD_OPTIONS = [
  { value: 'radial', label: 'Radial' },
  { value: 'linear', label: 'Linear' },
  { value: 'waves', label: 'Waves' },
  { value: 'noise', label: 'Noise' },
]
export const LAYOUT_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'hex', label: 'Hex' },
  { value: 'phyllotaxis', label: 'Phyllotaxis' },
]
export const SHAPE_OPTIONS = [
  { value: 'dot', label: 'Dot' },
  { value: 'square', label: 'Square' },
  { value: 'ring', label: 'Ring' },
]
export const PALETTES = [
  { value: 'drekker', label: 'Drekker', stops: ['#ff6b35', '#f7c59f', '#2ec4b6', '#2541b2'] },
  { value: 'sunset', label: 'Sunset', stops: ['#0d0221', '#ff3864', '#ffd23f'] },
  { value: 'ice', label: 'Ice', stops: ['#011627', '#2ec4b6', '#e0fbfc'] },
  { value: 'mono', label: 'Mono', stops: ['#000000', '#ffffff'] },
]

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x, y) {
  let v = 0, amp = 0.5, f = 1
  for (let o = 0; o < 4; o++) { v += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5 }
  return v
}

// Scalar field 0..1 at normalized (nx,ny), phase ph = TAU·u·cycles. Each branch's
// labs time term is rewritten so a whole ph cycle returns it exactly to its start:
//   linear  sin((nx·freq − t)·TAU)      → t·TAU becomes ph
//   waves   sin(r·freq·8 − t·2)         → t·2 becomes ph
//   noise   fbm(nx·freq + t·0.3, …)     → linear scroll (never seamless) becomes a
//                                          circular orbit of the sample window
//   radial  0.7 + 0.3·sin(t)            → t becomes ph
function sampleField(type, nx, ny, ph, freq) {
  const cx = nx - 0.5, cy = ny - 0.5
  switch (type) {
    case 'linear':
      return clamp01(0.5 + 0.5 * Math.sin(nx * freq * TAU - ph))
    case 'waves': {
      const r = Math.sqrt(cx * cx + cy * cy)
      return 0.5 + 0.5 * Math.sin(r * freq * 8 - ph)
    }
    case 'noise':
      return clamp01(fbm(nx * freq + 0.5 * Math.cos(ph), ny * freq + 0.5 * Math.sin(ph)))
    case 'radial':
    default: {
      const r = Math.sqrt(cx * cx + cy * cy) * 2
      return clamp01((1 - r) * (0.7 + 0.3 * Math.sin(ph)))
    }
  }
}

const rgbStops = (hexes) => hexes.map((h) => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
})
function paletteColor(stops, t) {
  t = clamp01(t)
  const n = stops.length - 1
  const i = Math.min(n - 1, Math.floor(t * n))
  const f = t * n - i
  const a = stops[i], b = stops[i + 1]
  return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`
}

// Cell centres in normalized [0,1]², for the chosen layout + density.
function cells(layout, density, w, h) {
  const out = []
  const ar = w / h
  if (layout === 'phyllotaxis') {
    const N = Math.round(200 + density * 36) // density → point count
    for (let i = 0; i < N; i++) {
      const r = Math.sqrt(i / N) * 0.5
      const a = i * 2.399963229 // golden angle
      out.push([0.5 + (r * Math.cos(a)) / ar * ar, 0.5 + r * Math.sin(a), r * 2])
    }
    return out
  }
  const step = 1 / (8 + density) // density → spacing
  const stepX = step
  const stepY = step * ar
  let row = 0
  for (let ny = stepY / 2; ny < 1; ny += stepY, row++) {
    const off = layout === 'hex' && row % 2 ? stepX / 2 : 0
    for (let nx = stepX / 2 + off; nx < 1; nx += stepX) {
      const cx = nx - 0.5, cy = ny - 0.5
      out.push([nx, ny, Math.sqrt(cx * cx + cy * cy) * 2])
    }
  }
  return out
}

function renderHalftone(ctx, u, w, h, params) {
  const { field, layout, shape, density, dotScale, palette, bg, invert } = params
  const fieldScale = params.fieldScale ?? 1
  const contrast = params.contrast ?? 1
  // Flow is whole field cycles per loop; Spin whole grid turns — integers ⇒ seamless.
  const ph = TAU * u * Math.round(params.flow ?? 1)
  const rotate = (((params.rotate ?? 0) + 360 * u * Math.round(params.spin ?? 0)) * Math.PI) / 180
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const pal = rgbStops((PALETTES.find((p) => p.value === palette) || PALETTES[0]).stops)
  const freq = (1 + density * 0.15) * fieldScale
  const cellPx = (Math.min(w, h)) / (8 + density) // base cell footprint
  const list = cells(layout, density, w, h)
  const cosR = Math.cos(rotate), sinR = Math.sin(rotate)

  for (let k = 0; k < list.length; k++) {
    const [nx, ny] = list[k]
    // rotate the sample point around the centre so the field spins under the grid
    const rx = (nx - 0.5) * cosR - (ny - 0.5) * sinR + 0.5
    const ry = (nx - 0.5) * sinR + (ny - 0.5) * cosR + 0.5
    let v = sampleField(field, rx, ry, ph, freq)
    if (contrast !== 1) v = clamp01(Math.pow(v, contrast))
    if (invert) v = 1 - v
    const size = v * cellPx * 0.62 * dotScale
    if (size < 0.4) continue
    const x = nx * w, y = ny * h
    ctx.fillStyle = paletteColor(pal, v)
    if (shape === 'square') {
      ctx.fillRect(x - size, y - size, size * 2, size * 2)
    } else if (shape === 'ring') {
      ctx.lineWidth = Math.max(1, size * 0.4)
      ctx.strokeStyle = ctx.fillStyle
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill()
    }
  }
}

export default {
  id: 'optic-halftone',
  label: 'Halftone matrix',
  group: 'optic',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b' },
    { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map(({ value, label }) => ({ value, label })), default: 'drekker' },
    { key: 'field', label: 'Field', type: 'select', options: FIELD_OPTIONS, default: 'radial' },
    { key: 'layout', label: 'Layout', type: 'select', options: LAYOUT_OPTIONS, default: 'hex' },
    { key: 'shape', label: 'Cell shape', type: 'select', options: SHAPE_OPTIONS, default: 'dot' },
    { key: 'density', label: 'Density', type: 'range', min: 4, max: 80, step: 1, default: 34 },
    { key: 'dotScale', label: 'Dot scale', type: 'range', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'fieldScale', label: 'Field scale', type: 'range', min: 0.2, max: 4, step: 0.05, default: 1, when: (l) => (l.field ?? 'radial') !== 'radial' },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1 },
    { key: 'rotate', label: 'Rotate', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    { key: 'flow', label: 'Flow · cycles', type: 'range', min: 0, max: 4, step: 1, default: 1, noRandom: true, tab: 'anim', section: 'Motion' },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: -2, max: 2, step: 1, default: 0, noRandom: true, tab: 'anim', section: 'Motion' },
  ],
  draw(ctx, u, w, h, p) {
    renderHalftone(ctx, u, w, h, p)
  },
}
