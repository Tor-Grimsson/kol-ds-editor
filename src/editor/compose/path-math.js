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

/* Point on the segment a→b at parameter t. Corner nodes collapse their
 * control to the anchor — same degenerate-cubic convention as pathD, so
 * this evaluates straight segments correctly too. */
function segPoint(a, b, t) {
  const p1 = a.out ?? a
  const p2 = b.in ?? b
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
  }
}

/* Nearest parameter on the segment a→b to (px, py): coarse 32-step scan +
 * a fine pass around the winner. Click-time hit-testing only, not a hot
 * path — and the split lands wherever the user perceived the click, so
 * sub-pixel exactness buys nothing. */
export function nearestSegmentT(a, b, px, py) {
  let bestT = 0
  let bestD = Infinity
  const scan = (from, to, steps) => {
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps
      const p = segPoint(a, b, t)
      const d = (p.x - px) ** 2 + (p.y - py) ** 2
      if (d < bestD) { bestD = d; bestT = t }
    }
  }
  scan(0, 1, 32)
  scan(Math.max(0, bestT - 1 / 32), Math.min(1, bestT + 1 / 32), 16)
  return { t: bestT, dist: Math.sqrt(bestD) }
}

/* de Casteljau split of the segment a→b at t. Returns replacement nodes
 * { a, mid, b } — shape-preserving: the two half-cubics retrace the original
 * curve exactly (the new node takes the interior split handles; a/b keep
 * their far handles and get their near handles trimmed). A straight segment
 * (both controls null) yields a handle-less mid so corners stay corners. */
export function splitSegment(a, b, t) {
  if (!a.out && !b.in) {
    return {
      a, b,
      mid: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, in: null, out: null },
    }
  }
  const p1 = a.out ?? a
  const p2 = b.in ?? b
  const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const q0 = lerp(a, p1)
  const q1 = lerp(p1, p2)
  const q2 = lerp(p2, b)
  const r0 = lerp(q0, q1)
  const r1 = lerp(q1, q2)
  const s  = lerp(r0, r1)
  /* A null (corner) side stays null: its split control degenerates to the
   * anchor anyway, and a zero-length handle would just put a dead knob on
   * top of the anchor square. */
  return {
    a:   { ...a, out: a.out ? q0 : null },
    mid: { x: s.x, y: s.y, in: r0, out: r1 },
    b:   { ...b, in: b.in ? q2 : null },
  }
}

/* Smooth a corner anchor: mirrored handles along the neighbor chord
 * (Illustrator convention), each sized to ~1/3 of its adjacent segment
 * length. Open-path endpoints get a single handle toward their only
 * neighbor. The anchor itself never moves. Returns a new node (or the
 * original when there are no neighbors to derive a tangent from). */
export function smoothNode(nodes, i, closed) {
  const n = nodes[i]
  const len = nodes.length
  const prev = (closed || i > 0)       ? nodes[(i - 1 + len) % len] : null
  const next = (closed || i < len - 1) ? nodes[(i + 1) % len]       : null
  if (!prev && !next) return n
  const dPrev = prev ? dist(n.x, n.y, prev.x, prev.y) : 0
  const dNext = next ? dist(n.x, n.y, next.x, next.y) : 0
  let tx = (next ?? n).x - (prev ?? n).x
  let ty = (next ?? n).y - (prev ?? n).y
  const tl = Math.hypot(tx, ty) || 1
  tx /= tl
  ty /= tl
  return {
    ...n,
    in:  prev ? { x: n.x - tx * (dPrev / 3), y: n.y - ty * (dPrev / 3) } : null,
    out: next ? { x: n.x + tx * (dNext / 3), y: n.y + ty * (dNext / 3) } : null,
  }
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
  const sp = splitSegment(sq[0], sq[1], 0.5)
  console.assert(sp.mid.x === 20 && sp.mid.y === 10 && sp.mid.in === null, 'splitSegment straight → corner mid')
  const sm = smoothNode(sq, 1, false)
  console.assert(sm.in && sm.out && sm.x === 30 && sm.y === 10, 'smoothNode handles, anchor fixed')
}
