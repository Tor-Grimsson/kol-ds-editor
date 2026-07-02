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

/* Cubic-bezier circle constant (4/3·tan(π/8)) — 4-node ellipse approximation. */
const KAPPA = 0.5523

/* SVG points string → corner path nodes ({x, y, in, out} — path-math format). */
const pointsToNodes = (str) => str.split(' ').map((p) => {
  const [x, y] = p.split(',').map(Number)
  return { x, y, in: null, out: null }
})

/* Convert a primitive shape layer's geometry to bezier path nodes
 * (layer-local coords, path-math node format). Reproduces the painted
 * geometry exactly — including the half-stroke inset the shape renderers
 * apply, so a stroked shape keeps its stroke centerline after conversion.
 * Returns { nodes, closed } or null for kinds with no primitive outline
 * (logo / flatten). */
export function shapeToPathNodes(layer) {
  const w = Math.max(1, layer.w ?? 0)
  const h = Math.max(1, layer.h ?? 0)
  const sw = layer.strokeWidth ?? (layer.kind === 'line' ? 2 : 0)
  const half = sw > 0 ? sw / 2 : 0
  switch (layer.kind) {
    case 'rect': {
      const x0 = half, y0 = half, x1 = w - half, y1 = h - half
      return { closed: true, nodes: [
        { x: x0, y: y0, in: null, out: null },
        { x: x1, y: y0, in: null, out: null },
        { x: x1, y: y1, in: null, out: null },
        { x: x0, y: y1, in: null, out: null },
      ] }
    }
    case 'ellipse': {
      const cx = w / 2, cy = h / 2
      const rx = Math.max(0, w / 2 - half)
      const ry = Math.max(0, h / 2 - half)
      const kx = rx * KAPPA, ky = ry * KAPPA
      return { closed: true, nodes: [
        { x: cx,      y: cy - ry, in: { x: cx - kx, y: cy - ry }, out: { x: cx + kx, y: cy - ry } },
        { x: cx + rx, y: cy,      in: { x: cx + rx, y: cy - ky }, out: { x: cx + rx, y: cy + ky } },
        { x: cx,      y: cy + ry, in: { x: cx + kx, y: cy + ry }, out: { x: cx - kx, y: cy + ry } },
        { x: cx - rx, y: cy,      in: { x: cx - rx, y: cy + ky }, out: { x: cx - rx, y: cy - ky } },
      ] }
    }
    case 'triangle': return { closed: true, nodes: pointsToNodes(trianglePoints(w, h, half)) }
    case 'polygon':  return { closed: true, nodes: pointsToNodes(regularPolygonPoints(w, h, layer.sides ?? 5, half)) }
    case 'star':     return { closed: true, nodes: pointsToNodes(starPoints(w, h, layer.points ?? 5, layer.innerRatio ?? 0.5, half)) }
    /* Line — 2-node open path along the bbox diagonal picked by `slope`
     * (endpoint math mirrors the line branches in LayerRenderer/build.js). */
    case 'line': {
      const nodes = (layer.slope ?? '\\') === '/'
        ? [{ x: half, y: h - half, in: null, out: null }, { x: w - half, y: half,     in: null, out: null }]
        : [{ x: half, y: half,     in: null, out: null }, { x: w - half, y: h - half, in: null, out: null }]
      return { closed: false, nodes }
    }
    default: return null
  }
}
