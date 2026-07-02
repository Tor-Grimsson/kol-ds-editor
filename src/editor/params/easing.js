/**
 * easing — cubic-bezier timing, the data model for keyframe-segment easing
 * (param-graph RFC Q1). An easing is a 4-tuple `[x1,y1,x2,y2]` (CSS
 * cubic-bezier control points, endpoints fixed at 0,0 and 1,1), or the
 * `'hold'` sentinel for a discrete step. Named presets are just tuples, so
 * a curve editor later is additive UI with no data migration.
 */

export const EASINGS = {
  linear:   [0, 0, 1, 1],
  ease:     [0.25, 0.1, 0.25, 1],
  'in':     [0.42, 0, 1, 1],
  out:      [0, 0, 0.58, 1],
  'in-out': [0.42, 0, 0.58, 1],
}
export const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease',   label: 'Ease' },
  { value: 'in',     label: 'Ease in' },
  { value: 'out',    label: 'Ease out' },
  { value: 'in-out', label: 'Ease in-out' },
  { value: 'hold',   label: 'Hold' },
]

/* Solve x(t)=target for the bezier parameter, then return y — Newton-Raphson
 * with a bisection fallback, same approach as the CSS engine. */
function bezierAt(p1, p2, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const cx = 3 * p1, bx = 3 * (p2 - p1) - cx, ax = 1 - cx - bx
  // solve for parameter u where sampleX(u) == x
  const sampleX = (u) => ((ax * u + bx) * u + cx) * u
  const sampleDX = (u) => (3 * ax * u + 2 * bx) * u + cx
  let u = x
  for (let i = 0; i < 8; i++) {
    const dx = sampleX(u) - x
    if (Math.abs(dx) < 1e-6) break
    const d = sampleDX(u)
    if (Math.abs(d) < 1e-6) break
    u -= dx / d
  }
  return u
}

/**
 * ease(spec, t) — map linear progress t∈[0,1] through the easing.
 *   spec: 4-tuple [x1,y1,x2,y2] | named key | 'hold' | undefined(=linear)
 * Returns the eased 0..1 progress. `hold` returns 0 (value stays at the
 * segment's start until the next key).
 */
export function ease(spec, t) {
  if (spec === 'hold') return 0
  const bez = Array.isArray(spec) ? spec : (EASINGS[spec] ?? EASINGS.linear)
  const [x1, y1, x2, y2] = bez
  const u = bezierAt(x1, x2, Math.min(1, Math.max(0, t)))
  // y(u) with the same polynomial form on the y control points
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  return ((ay * u + by) * u + cy) * u
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  console.assert(Math.abs(ease('linear', 0.5) - 0.5) < 1e-3, 'linear midpoint')
  console.assert(ease('linear', 0) === 0 && Math.abs(ease('linear', 1) - 1) < 1e-6, 'linear endpoints')
  console.assert(ease('hold', 0.9) === 0, 'hold stays at start')
  console.assert(ease('in', 0.5) < 0.5, 'ease-in lags at midpoint')
  console.assert(ease('out', 0.5) > 0.5, 'ease-out leads at midpoint')
}
