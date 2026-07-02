// Gradient fill for shape loops. A loop opts in by spreading FILL_PARAMS into its
// schema and calling paintFill() for its fillStyle. `solid` keeps the loop's
// authored colA↔colB look; the rest build a CanvasGradient from colA/colB.

export const FILL_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'conic', label: 'Conic' },
  { value: 'polar', label: 'Polar' },
]

// Shared params spread into a filled loop's schema. `tab:'color'` routes them to
// the rail's Color tab (next to the swatches), not the Edit/transform tab.
export const FILL_PARAMS = [
  { key: 'fill', label: 'Fill', type: 'select', options: FILL_OPTIONS, default: 'solid', tab: 'color' },
  { key: 'fillAngle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0, tab: 'color', noRandom: true },
  { key: 'fillStops', label: 'Polar stops', type: 'range', min: 2, max: 16, step: 1, default: 6, tab: 'color', noRandom: true },
]

// Extra params for loops that fill a single closed curve (vs concentric discs):
// an on/off toggle, opacity, and a winding rule (matters for self-intersecting
// curves like rose / lissajous). Spread alongside FILL_PARAMS.
export const SHAPE_FILL_PARAMS = [
  { key: 'fillShape', label: 'Fill shape', type: 'toggle', default: false, tab: 'color' },
  { key: 'fillAlpha', label: 'Fill opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.5, tab: 'color', noRandom: true },
  { key: 'fillRule', label: 'Fill rule', type: 'select', options: [{ value: 'nonzero', label: 'Nonzero' }, { value: 'evenodd', label: 'Even-odd' }], default: 'nonzero', tab: 'color' },
]

// Canvas winding rule from the loop's param (defaults to nonzero).
export const fillRuleOf = (p) => (p.fillRule === 'evenodd' ? 'evenodd' : 'nonzero')

// Build a canvas fillStyle from the loop's fill params, anchored at (cx,cy) with
// radius r. Recreated each frame (gradients are ctx-bound). Returns a solid colour
// for 'solid' or when conic gradients aren't supported. colA/colB override the
// loop's p.colA/p.colB for loops whose colour keys are named differently (e.g.
// lissajous' line/dot).
export function paintFill(ctx, p, cx, cy, r, colA, colB) {
  const type = p.fill || 'solid'
  const A = colA ?? p.colA
  const B = colB ?? p.colB
  const a = ((p.fillAngle || 0) * Math.PI) / 180
  const rr = Math.max(1, r)

  if (type === 'linear') {
    const dx = Math.cos(a) * rr
    const dy = Math.sin(a) * rr
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    g.addColorStop(0, A)
    g.addColorStop(1, B)
    return g
  }
  if (type === 'radial') {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr)
    g.addColorStop(0, A)
    g.addColorStop(1, B)
    return g
  }
  if (type === 'conic' && ctx.createConicGradient) {
    const g = ctx.createConicGradient(a, cx, cy)
    g.addColorStop(0, A)
    g.addColorStop(0.5, B)
    g.addColorStop(1, A)
    return g
  }
  if (type === 'polar' && ctx.createConicGradient) {
    const g = ctx.createConicGradient(a, cx, cy)
    const n = Math.max(2, Math.round(p.fillStops || 6))
    for (let i = 0; i <= n; i++) g.addColorStop(i / n, i % 2 ? B : A)
    return g
  }
  return A
}

// True when the loop has a non-solid gradient selected (else keep the solid look).
export const isGradient = (p) => !!p.fill && p.fill !== 'solid'
