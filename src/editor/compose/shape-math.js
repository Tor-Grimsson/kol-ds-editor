/* Pure geometry helpers for shape layer rendering + export. Used by
 * LayerRenderer.jsx (DOM render) and build.js (SVG export) so the two
 * outputs stay in sync. */

/* Regular n-gon vertices inscribed in {w, h}, first vertex at top (-90°).
 * Returns the SVG `points` attribute string. `inset` shrinks the radius
 * by half-stroke-width so a stroked polygon stays inside the layer bbox. */
export function regularPolygonPoints(w, h, sides, inset = 0) {
  const cx = w / 2
  const cy = h / 2
  const rx = Math.max(0, w / 2 - inset)
  const ry = Math.max(0, h / 2 - inset)
  const n  = Math.max(3, Math.min(12, sides | 0))
  const out = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    out.push(`${(cx + rx * Math.cos(a)).toFixed(3)},${(cy + ry * Math.sin(a)).toFixed(3)}`)
  }
  return out.join(' ')
}

/* Star vertices: 2*points alternating outer/inner radii. */
export function starPoints(w, h, points, innerRatio = 0.5, inset = 0) {
  const cx = w / 2
  const cy = h / 2
  const rxOuter = Math.max(0, w / 2 - inset)
  const ryOuter = Math.max(0, h / 2 - inset)
  const ratio   = Math.max(0.1, Math.min(0.95, innerRatio))
  const rxInner = rxOuter * ratio
  const ryInner = ryOuter * ratio
  const n = Math.max(3, Math.min(12, points | 0))
  const total = n * 2
  const out = []
  for (let i = 0; i < total; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const isOuter = i % 2 === 0
    const rx = isOuter ? rxOuter : rxInner
    const ry = isOuter ? ryOuter : ryInner
    out.push(`${(cx + rx * Math.cos(a)).toFixed(3)},${(cy + ry * Math.sin(a)).toFixed(3)}`)
  }
  return out.join(' ')
}

/* Equilateral triangle inscribed in {w, h}, apex at top-center. Returns
 * SVG points attribute string. */
export function trianglePoints(w, h, inset = 0) {
  return `${w / 2},${inset} ${inset},${h - inset} ${w - inset},${h - inset}`
}
