import { TAU, clamp01, hexToRgb } from '../lib/util.js'
import { raster } from '../field/raster.js'

// Moiré / interference engine — two (optionally three) overlapping grids
// (lines / concentric / radial), each with its own frequency, rotation and
// animated phase, combined by a superposition mode → interference fringes. The
// ml_phæno / bustave B&W op-art look, plus duotone. Canvas2D per-pixel.
//
// Ported from kol-labs-single optic/moire. The labs' grids array is flattened to
// g1*/g2*/g3* params (the inspector renders flat schemas); grid A is always on.
// Time is woven for the loop contract: each grid's labs drift (ph = t·speed)
// becomes ph = u · cycles with a whole number of cycles per loop, so
// frame(0) === frame(1) exactly. Per-pixel work goes through the shared field
// rasterizer (the draw ctx is CSS-px-transformed; putImageData would bypass it).

export const GRID_OPTIONS = [
  { value: 'lines', label: 'Lines' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'radial', label: 'Radial' },
]
export const COMBINE_OPTIONS = [
  { value: 'xor', label: 'Interfere (XOR)' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
]
export const MOIRE_PALETTES = [
  { value: 'bw', label: 'Black / White', cols: ['#000000', '#ffffff'] },
  { value: 'blood', label: 'Blood', cols: ['#0a0000', '#ff2d2d'] },
  { value: 'cyan', label: 'Cyan', cols: ['#001014', '#2ec4b6'] },
  { value: 'gold', label: 'Gold', cols: ['#0a0a00', '#ffd23f'] },
]

function gridVal(g, nx, ny, u) {
  const cx = nx - 0.5
  const cy = ny - 0.5
  const a = (g.angle * Math.PI) / 180
  const ph = u * g.cycles // whole cycles per loop (integer) ⇒ seamless
  if (g.type === 'concentric') {
    const r = Math.sqrt(cx * cx + cy * cy)
    return 0.5 + 0.5 * Math.sin(r * g.freq * 28 + ph * TAU)
  }
  if (g.type === 'radial') {
    const ang = Math.atan2(cy, cx)
    return 0.5 + 0.5 * Math.sin(ang * Math.round(g.freq) * 2 + ph * TAU)
  }
  // lines (rotated)
  const q = nx * Math.cos(a) + ny * Math.sin(a)
  return 0.5 + 0.5 * Math.sin(q * g.freq * 40 + ph * TAU)
}

function combine(mode, a, b) {
  switch (mode) {
    case 'multiply': return a * b
    case 'add': return (a + b) * 0.5
    case 'screen': return 1 - (1 - a) * (1 - b)
    case 'xor':
    default: return Math.abs(a - b)
  }
}

export default {
  id: 'optic-moire',
  label: 'Moiré grids',
  group: 'optic',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'colA', label: 'Colour A', type: 'color', role: 'bg', default: '#000000' },
    { key: 'colB', label: 'Colour B', type: 'color', role: 'fg', default: '#ffffff' },
    { key: 'combine', label: 'Combine', type: 'select', options: COMBINE_OPTIONS, default: 'xor', when: (l) => (l.g2On ?? true) || !!l.g3On },
    { key: 'hardness', label: 'Hardness', type: 'range', min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    // Grid A (always on — the base grid)
    { key: 'g1Type', label: 'Grid A', type: 'select', options: GRID_OPTIONS, default: 'lines' },
    { key: 'g1Freq', label: 'A · freq', type: 'range', min: 1, max: 30, step: 0.5, default: 6 },
    { key: 'g1Angle', label: 'A · angle', type: 'range', min: 0, max: 180, step: 1, default: 0, when: (l) => (l.g1Type ?? 'lines') === 'lines' },
    { key: 'g1Cycles', label: 'A · drift', type: 'range', min: -4, max: 4, step: 1, default: 1, noRandom: true, tab: 'anim', section: 'Motion' },
    // Grid B
    { key: 'g2On', label: 'Grid B on', type: 'toggle', default: true },
    { key: 'g2Type', label: 'Grid B', type: 'select', options: GRID_OPTIONS, default: 'lines', when: (l) => l.g2On ?? true },
    { key: 'g2Freq', label: 'B · freq', type: 'range', min: 1, max: 30, step: 0.5, default: 6, when: (l) => l.g2On ?? true },
    { key: 'g2Angle', label: 'B · angle', type: 'range', min: 0, max: 180, step: 1, default: 8, when: (l) => (l.g2On ?? true) && (l.g2Type ?? 'lines') === 'lines' },
    { key: 'g2Cycles', label: 'B · drift', type: 'range', min: -4, max: 4, step: 1, default: -1, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => l.g2On ?? true },
    // Grid C
    { key: 'g3On', label: 'Grid C on', type: 'toggle', default: false },
    { key: 'g3Type', label: 'Grid C', type: 'select', options: GRID_OPTIONS, default: 'concentric', when: (l) => !!l.g3On },
    { key: 'g3Freq', label: 'C · freq', type: 'range', min: 1, max: 30, step: 0.5, default: 4, when: (l) => !!l.g3On },
    { key: 'g3Angle', label: 'C · angle', type: 'range', min: 0, max: 180, step: 1, default: 0, when: (l) => !!l.g3On && l.g3Type === 'lines' },
    { key: 'g3Cycles', label: 'C · drift', type: 'range', min: -4, max: 4, step: 1, default: 1, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.g3On },
  ],
  draw(ctx, u, w, h, p) {
    const grids = [
      { enabled: true, type: p.g1Type, freq: p.g1Freq, angle: p.g1Angle, cycles: Math.round(p.g1Cycles) },
      { enabled: !!p.g2On, type: p.g2Type, freq: p.g2Freq, angle: p.g2Angle, cycles: Math.round(p.g2Cycles) },
      { enabled: !!p.g3On, type: p.g3Type, freq: p.g3Freq, angle: p.g3Angle, cycles: Math.round(p.g3Cycles) },
    ]
    const active = grids.filter((g) => g.enabled)
    const mode = p.combine
    const c0 = hexToRgb(p.colA)
    const c1 = hexToRgb(p.colB)
    const edge = 0.5 - p.hardness * 0.49 // hardness → crisp threshold via smoothstep band

    raster(ctx, w, h, (i, j, W, H) => {
      const nx = i / W
      const ny = j / H
      let v = active.length ? gridVal(active[0], nx, ny, u) : 0.5
      for (let k = 1; k < active.length; k++) v = combine(mode, v, gridVal(active[k], nx, ny, u))
      // hardness: push toward 0/1 around the midpoint
      const lo = edge, hi = 1 - edge
      v = lo === hi ? (v < 0.5 ? 0 : 1) : clamp01((v - lo) / (hi - lo))
      if (p.invert) v = 1 - v
      return [
        c0[0] + (c1[0] - c0[0]) * v,
        c0[1] + (c1[1] - c0[1]) * v,
        c0[2] + (c1[2] - c0[2]) * v,
      ]
    })
  },
}
