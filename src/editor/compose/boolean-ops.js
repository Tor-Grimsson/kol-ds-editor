/**
 * boolean-ops — curve-true boolean geometry (unite / subtract / intersect /
 * exclude) for closed vector layers, via paper.js (paper-core, headless).
 *
 * paper's segment model {point, handleIn, handleOut} maps 1:1 onto our
 * path-node model {x, y, in, out} (handles relative vs absolute is the only
 * conversion), so results come back as REAL bezier paths — no polyline
 * flattening. Compound results (subtract/exclude make donuts) return the
 * largest ring as `nodes` and the rest as `holes`, rendered evenodd.
 *
 * Operand order is layer z-order, bottom first: subtract removes every
 * upper shape from the bottom one (Figma semantics).
 *
 * Two consumers: the non-destructive `bool` group layer (computeBoolean /
 * computeBooleanCached — live geometry over `children`) and flatten
 * (booleanCombine — bakes to a real path layer).
 */
import paper from 'paper/dist/paper-core'
import { pathD, shiftNode, scalePathNodes } from './path-math'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'

export const BOOLEAN_OPS = ['unite', 'subtract', 'intersect', 'exclude']

/* Shape kinds that convert cleanly to a closed paper path. */
const BOOLEANABLE_SHAPE_KINDS = new Set(['rect', 'ellipse', 'triangle', 'polygon', 'star'])

/* Geometry eligibility only — lock is a selection concern, not a shape one:
 * a locked child INSIDE a bool group still contributes to the result.
 * Exported for reparent checks: only these types may enter a bool's
 * children (anything else would silently vanish from the result). */
export function hasBooleanGeometry(layer) {
  if (!layer) return false
  if (layer.type === 'path') return !!layer.closed && (layer.nodes?.length ?? 0) >= 3
  if (layer.type === 'shape') return BOOLEANABLE_SHAPE_KINDS.has(layer.kind)
  if (layer.type === 'bool') return (layer.children?.length ?? 0) >= 1
  return false
}

export function isBooleanable(layer) {
  return !!layer && !layer.locked && hasBooleanGeometry(layer)
}

let paperReady = false
function ensurePaper() {
  if (!paperReady) {
    paper.setup(new paper.Size(1, 1)) /* headless project — no canvas */
    paperReady = true
  }
}

/* "x,y x,y ..." (shape-math point string) → paper segments in canvas coords */
function pointsToSegments(pts, ox, oy) {
  return pts.split(' ').map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [ox + x, oy + y]
  })
}

/* Layer → paper.PathItem in canvas coords, with rotation/flip applied about
 * the layer's box center (matching the renderer's transform). */
function layerToPaperItem(layer) {
  let item = null
  if (layer.type === 'path') {
    const rings = [layer.nodes, ...(layer.holes ?? [])]
    const d = rings
      .map((ring) => pathD(ring.map((n) => shiftNode(n, layer.x, layer.y)), true))
      .join(' ')
    item = paper.PathItem.create(d)
    item.fillRule = 'evenodd'
  } else if (layer.type === 'bool') {
    /* Nested bool group — its computed result IS its geometry (bool-local
     * coords, shifted out to the parent's space). Lets bool groups operate
     * on other bool groups and lets flatten reuse the combine pipeline. */
    const res = computeBoolean(layer.children, layer.op)
    if (!res) return null
    const rings = [res.nodes, ...(res.holes ?? [])]
    const d = rings
      .map((ring) => pathD(ring.map((n) => shiftNode(n, layer.x, layer.y)), true))
      .join(' ')
    item = paper.PathItem.create(d)
    item.fillRule = 'evenodd'
  } else if (layer.type === 'shape') {
    const { x, y, w, h } = layer
    switch (layer.kind) {
      case 'rect':
        item = new paper.Path.Rectangle({ point: [x, y], size: [w, h] })
        break
      case 'ellipse':
        item = new paper.Path.Ellipse({ point: [x, y], size: [w, h] })
        break
      case 'triangle':
        item = new paper.Path({ segments: pointsToSegments(trianglePoints(w, h, 0), x, y), closed: true })
        break
      case 'polygon':
        item = new paper.Path({ segments: pointsToSegments(regularPolygonPoints(w, h, layer.sides ?? 5, 0), x, y), closed: true })
        break
      case 'star':
        item = new paper.Path({ segments: pointsToSegments(starPoints(w, h, layer.points ?? 5, layer.innerRatio ?? 0.5, 0), x, y), closed: true })
        break
      default:
        return null
    }
  }
  if (!item) return null
  const center = new paper.Point(layer.x + layer.w / 2, layer.y + layer.h / 2)
  if (layer.flipX || layer.flipY) item.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1, center)
  if (layer.rotation) item.rotate(layer.rotation, center)
  return item
}

/* paper.Path → our node ring (handles absolute; zero-length handle = null) */
function pathToRing(p) {
  return p.segments.map((seg) => ({
    x: seg.point.x,
    y: seg.point.y,
    in:  seg.handleIn.isZero()  ? null : { x: seg.point.x + seg.handleIn.x,  y: seg.point.y + seg.handleIn.y },
    out: seg.handleOut.isZero() ? null : { x: seg.point.x + seg.handleOut.x, y: seg.point.y + seg.handleOut.y },
  }))
}

/* Anchor-bbox area — picks the outer ring of a compound result. */
function ringArea(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of ring) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  return (maxX - minX) * (maxY - minY)
}

/**
 * Combine layers (given in z-order, bottom first) with a boolean op.
 * Returns `{ nodes, holes }` in CANVAS coords (caller renormalizes), or
 * null when the result is empty (e.g. intersect of disjoint shapes).
 * A single layer passes through as-is (rotation/flip baked) — that's how
 * flatten bakes one bool group to a path.
 */
export function booleanCombine(layers, op) {
  ensurePaper()
  const items = layers.map(layerToPaperItem)
  try {
    if (items.length < 1 || items.some((i) => !i)) return null
    let acc = items[0]
    for (let i = 1; i < items.length; i++) {
      const next = acc[op](items[i], { insert: false })
      acc.remove()
      acc = next
    }
    const paths = (acc.className === 'CompoundPath' ? acc.children : [acc])
      .filter((p) => p.segments && p.segments.length >= 2)
    acc.remove()
    if (paths.length === 0) return null
    const rings = paths.map(pathToRing)
    rings.sort((a, b) => ringArea(b) - ringArea(a))
    return { nodes: rings[0], holes: rings.length > 1 ? rings.slice(1) : null }
  } finally {
    items.forEach((i) => i?.remove())
  }
}

/* Anchor bbox across all rings — {x, y, w, h} in the rings' own coord space. */
function ringsBounds(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of rings) for (const n of ring) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
}

/**
 * Live geometry for a bool group: the boolean pipeline over `children`
 * (bool-local coords, z-order bottom first). Hidden children drop out of
 * the result (Figma behavior); locked children still contribute. Returns
 * `{ nodes, holes, bounds }` in the children's coord space, or null when
 * nothing eligible / result empty. Pure — used by render, export, and
 * flatten.
 */
export function computeBoolean(children, op) {
  const operands = (children ?? []).filter((l) => l.visible !== false && hasBooleanGeometry(l))
  if (operands.length === 0) return null
  const result = booleanCombine(operands, op)
  if (!result || (result.nodes?.length ?? 0) < 2) return null
  return { ...result, bounds: ringsBounds([result.nodes, ...(result.holes ?? [])]) }
}

/* Render-path cache. Keyed on the children ARRAY identity — state updates
 * are immutable, so any child (geometry) edit swaps the array while static
 * frames keep the same reference and pay nothing. `op` rides in the entry
 * since it can change without touching children. */
const boolCache = new WeakMap()

export function computeBooleanCached(layer) {
  const children = layer.children ?? []
  const hit = boolCache.get(children)
  if (hit && hit.op === layer.op) return hit.result
  const result = computeBoolean(children, layer.op)
  boolCache.set(children, { op: layer.op, result })
  return result
}

/* Sub-pixel tolerance for refit — paper results carry float jitter and a
 * refit within it would just churn state. */
const REFIT_EPS = 0.01

/**
 * Refit a bool layer so its frame hugs the computed result (Figma
 * behavior): bounds-origin drift moves into the layer's x/y while children
 * re-offset by the inverse, keeping the rendered geometry visually fixed.
 * Returns the input unchanged when it already hugs (or the result is
 * empty). The recompute here seeds the render cache — and since translation
 * commutes with boolean ops, the shifted children's result is derived by
 * shifting rings, not by re-running paper.
 */
export function refitBoolLayer(layer) {
  const result = computeBooleanCached(layer)
  if (!result) return layer
  const { x: bx, y: by, w, h } = result.bounds
  const hugs = Math.abs(bx) < REFIT_EPS && Math.abs(by) < REFIT_EPS
  if (hugs) {
    if (Math.abs((layer.w ?? 0) - w) < REFIT_EPS && Math.abs((layer.h ?? 0) - h) < REFIT_EPS) return layer
    return { ...layer, w, h }
  }
  const children = (layer.children ?? []).map((c) => ({ ...c, x: (c.x ?? 0) - bx, y: (c.y ?? 0) - by }))
  boolCache.set(children, {
    op: layer.op,
    result: {
      nodes: result.nodes.map((n) => shiftNode(n, -bx, -by)),
      holes: result.holes ? result.holes.map((r) => r.map((n) => shiftNode(n, -bx, -by))) : null,
      bounds: { x: 0, y: 0, w, h },
    },
  })
  return { ...layer, x: (layer.x ?? 0) + bx, y: (layer.y ?? 0) + by, w, h, children }
}

/* Scale bool children (boxes + path geometry + nested bools) about the
 * group's local origin — the bbox-resize counterpart to the path layer's
 * node scaling, so the computed result tracks the box. */
export function scaleBoolChildren(children, kx, ky) {
  return (children ?? []).map((c) => {
    const scaled = { ...c, x: (c.x ?? 0) * kx, y: (c.y ?? 0) * ky, w: (c.w ?? 0) * kx, h: (c.h ?? 0) * ky }
    if (c.type === 'path' && Array.isArray(c.nodes)) {
      scaled.nodes = scalePathNodes(c.nodes, kx, ky)
      if (c.holes?.length) scaled.holes = c.holes.map((r) => scalePathNodes(r, kx, ky))
    }
    if (c.type === 'bool' && Array.isArray(c.children)) {
      scaled.children = scaleBoolChildren(c.children, kx, ky)
    }
    return scaled
  })
}
