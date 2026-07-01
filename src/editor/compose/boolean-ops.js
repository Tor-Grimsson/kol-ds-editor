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
 */
import paper from 'paper/dist/paper-core'
import { pathD, shiftNode } from './path-math'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'

export const BOOLEAN_OPS = ['unite', 'subtract', 'intersect', 'exclude']

/* Shape kinds that convert cleanly to a closed paper path. */
const BOOLEANABLE_SHAPE_KINDS = new Set(['rect', 'ellipse', 'triangle', 'polygon', 'star'])

export function isBooleanable(layer) {
  if (!layer || layer.locked) return false
  if (layer.type === 'path') return !!layer.closed && (layer.nodes?.length ?? 0) >= 3
  if (layer.type === 'shape') return BOOLEANABLE_SHAPE_KINDS.has(layer.kind)
  return false
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
 * Combine 2+ layers (given in z-order, bottom first) with a boolean op.
 * Returns `{ nodes, holes }` in CANVAS coords (caller renormalizes), or
 * null when the result is empty (e.g. intersect of disjoint shapes).
 */
export function booleanCombine(layers, op) {
  ensurePaper()
  const items = layers.map(layerToPaperItem)
  try {
    if (items.length < 2 || items.some((i) => !i)) return null
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
