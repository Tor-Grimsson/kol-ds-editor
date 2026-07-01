/**
 * path-math — pure geometry for the vector `path` layer type.
 *
 * A path node: `{ x, y, in, out }` where `x,y` is the anchor and `in`/`out`
 * are the incoming/outgoing cubic-bezier control points (absolute, same
 * coord space as the anchor) or `null` for a corner (control collapses to
 * the anchor → that side renders as a straight segment).
 *
 * Node coords are LOCAL to the layer's `{x, y}` translation. Keeping them
 * layer-local means a whole-path move is just an `{x, y}` update — the same
 * gesture every other positioned layer already uses — with no per-node math.
 */

/* Build an SVG path `d`. Every segment is emitted as a cubic `C`; a corner
 * node (null handle) uses its anchor as the control, degenerating the cubic
 * into the straight line we want. Uniform command stream = one code path. */
export function pathD(nodes, closed = false) {
  if (!nodes || nodes.length === 0) return ''
  if (nodes.length === 1) return `M ${nodes[0].x} ${nodes[0].y}`
  const seg = (p, c) => {
    const c1 = p.out ?? p
    const c2 = c.in ?? c
    return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${c.x} ${c.y}`
  }
  let d = `M ${nodes[0].x} ${nodes[0].y}`
  for (let i = 1; i < nodes.length; i++) d += ` ${seg(nodes[i - 1], nodes[i])}`
  if (closed) d += ` ${seg(nodes[nodes.length - 1], nodes[0])} Z`
  return d
}

/* Anchor-only bounding box. Handles are intentionally excluded so the
 * selection wireframe doesn't jump when a handle is pulled far out.
 * ponytail: anchor bbox, not the true curve extent — a selection hint, not
 * a clip. Swap to a de Casteljau extent solve if tight bounds are needed. */
export function pathBounds(nodes) {
  if (!nodes || nodes.length === 0) return { minX: 0, minY: 0, w: 1, h: 1 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
}

/* Translate a node (anchor + both handles) by (dx, dy). */
export function shiftNode(n, dx, dy) {
  return {
    x: n.x + dx,
    y: n.y + dy,
    in:  n.in  ? { x: n.in.x  + dx, y: n.in.y  + dy } : null,
    out: n.out ? { x: n.out.x + dx, y: n.out.y + dy } : null,
  }
}

/* Re-origin a node list so its anchor bbox starts at (0,0). Returns the
 * shifted nodes plus the (dx, dy) that must be ADDED to the layer's {x,y}
 * to keep the path visually fixed. Called after create + after any node
 * edit so nodes stay layer-local and {x,y,w,h} stay in sync. */
export function normalizePath(nodes) {
  const { minX, minY, w, h } = pathBounds(nodes)
  return {
    nodes: nodes.map((n) => shiftNode(n, -minX, -minY)),
    dx: minX,
    dy: minY,
    w,
    h,
  }
}

/* Scale a node list (anchors + handles) around the local origin. Used when
 * the layer's {w,h} bbox is resized so the geometry tracks the box. Nodes
 * are normalized (bbox origin at 0,0), so plain multiplication preserves
 * normalization: min stays 0, max becomes the new w/h. */
export function scalePathNodes(nodes, sx, sy) {
  const s = (p) => (p ? { x: p.x * sx, y: p.y * sy } : null)
  return nodes.map((n) => ({ x: n.x * sx, y: n.y * sy, in: s(n.in), out: s(n.out) }))
}

/* Re-origin a MULTI-RING path (outer nodes + optional hole rings, both
 * introduced by boolean ops) so the combined anchor bbox starts at (0,0).
 * Same contract as normalizePath, but bounds span every ring and holes
 * shift in lockstep with the outer ring. `holes` may be null/empty. */
export function normalizePathRings(nodes, holes) {
  const rings = [nodes, ...(holes ?? [])]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of rings) for (const n of ring) {
    if (n.x < minX) minX = n.x
    if (n.y < minY) minY = n.y
    if (n.x > maxX) maxX = n.x
    if (n.y > maxY) maxY = n.y
  }
  if (!Number.isFinite(minX)) return { nodes, holes: holes ?? null, dx: 0, dy: 0, w: 1, h: 1 }
  return {
    nodes: nodes.map((n) => shiftNode(n, -minX, -minY)),
    holes: holes?.length ? holes.map((ring) => ring.map((n) => shiftNode(n, -minX, -minY))) : null,
    dx: minX,
    dy: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  }
}

/* Rotate a node list by `deg` (clockwise, y-down) about (cx, cy). Used to
 * BAKE a layer's live `rotation` into path geometry when entering node-edit
 * mode — node editing always operates on rotation-free geometry, mirroring
 * how flips are baked. */
export function rotatePathNodes(nodes, deg, cx, cy) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const r = (p) => (p ? {
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  } : null)
  return nodes.map((n) => ({ ...r(n), in: r(n.in), out: r(n.out) }))
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  const sq = [
    { x: 10, y: 10, in: null, out: null },
    { x: 30, y: 10, in: null, out: null },
    { x: 30, y: 40, in: null, out: null },
  ]
  const b = pathBounds(sq)
  console.assert(b.minX === 10 && b.minY === 10 && b.w === 20 && b.h === 30, 'pathBounds')
  const n = normalizePath(sq)
  console.assert(n.dx === 10 && n.dy === 10 && n.nodes[0].x === 0 && n.nodes[0].y === 0, 'normalizePath origin')
  console.assert(pathD(sq).startsWith('M 10 10 C'), 'pathD corner→cubic')
  console.assert(pathD(sq, true).endsWith('Z'), 'pathD closed')
}
