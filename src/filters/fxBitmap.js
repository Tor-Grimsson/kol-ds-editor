/**
 * Bitmap — the labs HALFTONE trio's third face: kol-labs-single
 * optic/halftone (HalftonePage mode="filter", routed as "Bitmap" at /optic).
 * A scalar field sampled on a grid of cells — square / hex / phyllotaxis —
 * each drawn as a dot/square/ring sized + palette-coloured by the field
 * value; the photo's luma drives the field through Amount (the labs
 * photoBlend: 0 = pure parametric field, 100 = pure photo — NOT a dry/wet
 * crossfade, faithful to the labs page).
 *
 * Time weaving mirrors the generator twin (loops/optic/halftone.js, same
 * engine): Flow is whole field cycles per loop and Spin whole grid turns —
 * integers ⇒ frame(0) === frame(1) exactly; the noise field's labs linear
 * scroll (never seamless) becomes a circular orbit of the sample window.
 * Note: like the labs page, the field (and so Flow/Spin motion) only shows
 * where Amount < 100 — at 100 the cells are pure photo luma.
 */

const TAU = Math.PI * 2
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

const FIELD_OPTIONS = [
  { value: 'radial', label: 'Radial' },
  { value: 'linear', label: 'Linear' },
  { value: 'waves', label: 'Waves' },
  { value: 'noise', label: 'Noise' },
]
const LAYOUT_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'hex', label: 'Hex' },
  { value: 'phyllotaxis', label: 'Phyllotaxis' },
]
const SHAPE_OPTIONS = [
  { value: 'dot', label: 'Dot' },
  { value: 'square', label: 'Square' },
  { value: 'ring', label: 'Ring' },
]
const PALETTES = [
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

// Scalar field 0..1 at normalized (nx,ny), phase ph = TAU·u·cycles. Each
// branch's labs time term is rewritten so a whole ph cycle returns it exactly
// to its start (the loops/optic/halftone.js weave):
//   linear  sin((nx·freq − t)·TAU)  → t·TAU becomes ph
//   waves   sin(r·freq·8 − t·2)     → t·2 becomes ph
//   noise   fbm(nx·freq + t·0.3, …) → linear scroll becomes a circular orbit
//   radial  0.7 + 0.3·sin(t)        → t becomes ph
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
      out.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)])
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
      out.push([nx, ny])
    }
  }
  return out
}

/* Cell grid memo — the layout only changes with params/size, not per frame
 * (labs rebuilt it every render; the transport makes that a hot loop here). */
let cellMemo = { key: '', list: [] }
function cellsFor(layout, density, w, h) {
  const key = `${layout}|${density}|${w}|${h}`
  if (cellMemo.key !== key) cellMemo = { key, list: cells(layout, density, w, h) }
  return cellMemo.list
}

/* Per-source luma cache (glass.js WeakMap-on-identity pattern). The labs page
 * sampled a 256² luma grid once per source (sampleLuma) — same here, keyed on
 * the fitted canvas the host hands us; the scratch canvas is reused. */
const LUMA_N = 256
const lumaCache = new WeakMap()
let lumaScratch = null
function lumaFor(src) {
  let e = lumaCache.get(src)
  if (!e) {
    if (!lumaScratch) lumaScratch = document.createElement('canvas')
    lumaScratch.width = LUMA_N
    lumaScratch.height = LUMA_N
    const g = lumaScratch.getContext('2d', { willReadFrequently: true })
    g.drawImage(src, 0, 0, LUMA_N, LUMA_N)
    const d = g.getImageData(0, 0, LUMA_N, LUMA_N).data
    const out = new Float32Array(LUMA_N * LUMA_N)
    for (let i = 0; i < LUMA_N * LUMA_N; i++) {
      const j = i << 2
      out[i] = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255
    }
    e = out
    lumaCache.set(src, e)
  }
  return e
}

export default {
  id: 'fx-bitmap',
  label: 'Bitmap',
  animated: true,
  params: [
    { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1, default: 100, section: 'Effect' },
    { key: 'field', label: 'Field', type: 'select', options: FIELD_OPTIONS, default: 'radial', section: 'Field' },
    { key: 'fieldScale', label: 'Field scale', type: 'range', min: 0.2, max: 4, step: 0.05, default: 1, section: 'Field', when: (l) => (l.field ?? 'radial') !== 'radial' },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1, section: 'Field' },
    { key: 'rotate', label: 'Rotate', type: 'range', min: 0, max: 360, step: 1, default: 0, section: 'Field' },
    { key: 'layout', label: 'Layout', type: 'segmented', options: LAYOUT_OPTIONS, default: 'hex', section: 'Grid' },
    { key: 'density', label: 'Density', type: 'range', min: 4, max: 80, step: 1, default: 34, section: 'Grid' },
    { key: 'shape', label: 'Cell shape', type: 'segmented', options: SHAPE_OPTIONS, default: 'dot', section: 'Cell' },
    { key: 'dotScale', label: 'Dot scale', type: 'range', min: 0.2, max: 2, step: 0.05, default: 1, section: 'Cell' },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false, section: 'Cell' },
    { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map(({ value, label }) => ({ value, label })), default: 'drekker', section: 'Color' },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#06070b', section: 'Color' },
    { key: 'flow', label: 'Flow · cycles', type: 'range', min: 0, max: 4, step: 1, default: 1, noRandom: true, tab: 'anim', section: 'Motion' },
    { key: 'spin', label: 'Spin · turns', type: 'range', min: -2, max: 2, step: 1, default: 0, noRandom: true, tab: 'anim', section: 'Motion' },
  ],
  apply(ctx, src, w, h, p, u) {
    const luma = lumaFor(src)
    const blend = clamp01((p.amount ?? 100) / 100) // labs photoBlend
    const field = p.field ?? 'radial'
    const density = Math.round(p.density ?? 34)
    const dotScale = p.dotScale ?? 1
    const contrast = p.contrast ?? 1
    const invert = !!p.invert
    const shape = p.shape ?? 'dot'

    // Flow is whole field cycles per loop; Spin whole grid turns — integers ⇒ seamless.
    const ph = TAU * u * Math.round(p.flow ?? 1)
    const rotate = (((p.rotate ?? 0) + 360 * u * Math.round(p.spin ?? 0)) * Math.PI) / 180

    ctx.fillStyle = p.bg ?? '#06070b'
    ctx.fillRect(0, 0, w, h)

    const pal = rgbStops((PALETTES.find((q) => q.value === p.palette) || PALETTES[0]).stops)
    const freq = (1 + density * 0.15) * (p.fieldScale ?? 1)
    const cellPx = Math.min(w, h) / (8 + density) // base cell footprint
    const list = cellsFor(p.layout ?? 'hex', density, w, h)
    const cosR = Math.cos(rotate), sinR = Math.sin(rotate)

    for (let k = 0; k < list.length; k++) {
      const nx = list[k][0], ny = list[k][1]
      // rotate the sample point around the centre so the field spins under the grid
      const rx = (nx - 0.5) * cosR - (ny - 0.5) * sinR + 0.5
      const ry = (nx - 0.5) * sinR + (ny - 0.5) * cosR + 0.5
      let v = sampleField(field, rx, ry, ph, freq)
      if (blend > 0) {
        const px = Math.min(LUMA_N - 1, Math.floor(nx * LUMA_N))
        const py = Math.min(LUMA_N - 1, Math.floor(ny * LUMA_N))
        const lv = luma[py * LUMA_N + px]
        v = blend >= 1 ? lv : v + (lv - v) * blend
      }
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
  },
}
