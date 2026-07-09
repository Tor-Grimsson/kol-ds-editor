/* Para-type geometry core — the one home for glyph rendering, fit math and
 * the specimen-grid layout, shared by the loop draw (glyph.js) and the
 * flatten-to-vector builder (flatten.js) so canvas pixels and flattened
 * shapes always agree. Ported from kol-labs-single para-type
 * (ParaTypePage.jsx specimen/grid proportions + lab/data.js FILTER_SETS).
 * Pure canvas/data — no React. */

import { classic } from './classic.js'
import { skeleton } from './skeleton.js'

export const ENGINES = { classic, skeleton }

export const GLYPH_ORDER = ['o', 'l', 'i', 'd', 'b', 'p', 'q', 'c', 'e', 'n', 'h', 'm', 't']

/* Character-set filter chips (labs lab/data.js:120-128) — scopes the
 * specimen grid. */
export const FILTER_SETS = {
  All:        GLYPH_ORDER,
  Rounds:     ['o', 'c', 'e'],
  Stems:      ['l', 'i', 't'],
  Bowls:      ['d', 'b', 'p', 'q'],
  Arches:     ['n', 'm', 'h'],
  Ascenders:  ['l', 'd', 'b', 'h', 't'],
  Descenders: ['p', 'q'],
}

export function renderGlyph(engineName, glyphName, params) {
  const engine = ENGINES[engineName] || ENGINES.classic
  const fn = engine[glyphName]
  if (!fn) return null
  return fn(params)
}

/* Vertical extents [yMin, yMax] in font units (y-up, baseline 0), per glyph —
 * used to center + fit. Derived from the engine geometry: bowls overshoot the
 * x-height band, ascenders/descenders extend it, i carries the tittle. */
export function glyphBounds(name, p) {
  const ov = p.overshoot
  switch (name) {
    case 'o': case 'c': case 'e': return [-ov, p.xHeight + ov]
    case 'd': case 'b': return [-ov, p.ascender]
    case 'p': case 'q': return [-p.descender, p.xHeight + ov]
    case 'l': case 'h': return [0, p.ascender]
    case 'i': return [0, p.xHeight + p.stemWidth * 1.35] // tittle top
    case 'n': case 'm': return [0, p.xHeight + ov]
    case 't': return [0, p.xHeight * 1.18]
    default: return [0, p.xHeight]
  }
}

/* Fit a rendered glyph into a canvas-space box: canvas = translate(tx, ty) ·
 * scale(s, -s) · font units. Font y maps to canvas ty - s·y. */
export function placeGlyph(g, name, p, bx, by, bw, bh, fit = 0.8) {
  const [y0, y1] = glyphBounds(name, p)
  const gw = Math.max(1, g.width)
  const gh = Math.max(1, y1 - y0)
  const s = (fit * Math.min(bw, bh)) / Math.max(gw, gh)
  return {
    tx: bx + bw / 2 - (gw * s) / 2,
    ty: by + bh / 2 + ((y0 + y1) / 2) * s,
    s, gw, gh, y0, y1,
  }
}

/* Grid glyph list under the filterSet / visibleCount params (labs
 * ParaTypePage visibleGlyphs memo). */
export function visibleGlyphList(p) {
  const inSet = FILTER_SETS[p.filterSet] || GLYPH_ORDER
  const list = GLYPH_ORDER.filter((g) => inSet.includes(g))
  const count = p.visibleCount ?? 'all'
  return count === 'all' ? list : list.slice(0, Number(count) || list.length)
}

/* Specimen frame split (labs proportions: big specimen on top 40%, the grid
 * fills the rest; page padding + gap made size-relative). */
export function specimenLayout(p, w, h) {
  const pad = Math.round(Math.min(w, h) * 0.045)
  const gap = Math.round(pad * 0.75)
  const focus = { x: pad, y: pad, w: w - pad * 2, h: Math.max(1, h * 0.4 - pad) }
  const gy = h * 0.4 + gap
  const grid = { x: pad, y: gy, w: Math.max(1, w - pad * 2), h: Math.max(1, h - pad - gy) }
  const names = visibleGlyphList(p)
  const n = Math.max(1, names.length)
  /* labs: repeat(auto-fit, minmax(96px, 1fr)) */
  const cols = Math.max(1, Math.min(n, Math.floor(grid.w / 96)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const cw = grid.w / cols
  const ch = grid.h / rows
  const cells = names.map((name, i) => ({
    name,
    rect: { x: grid.x + (i % cols) * cw, y: grid.y + Math.floor(i / cols) * ch, w: cw, h: ch },
  }))
  return { focus, grid, cells }
}

/* Inner glyph box + label band of a grid cell. */
export function cellMetrics(rect) {
  const inset = Math.min(rect.w, rect.h) * 0.08
  const label = Math.max(7, Math.min(14, Math.min(rect.w, rect.h) * 0.11))
  return {
    inset, label,
    box: {
      x: rect.x + inset,
      y: rect.y + inset,
      w: Math.max(1, rect.w - inset * 2),
      h: Math.max(1, rect.h - inset * 2 - label * 1.4),
    },
  }
}

/* Every glyph placement for the layer's current layout — the shared seam
 * between draw (glyph.js) and flatten (flatten.js). `kind: 'focus'` is the
 * big glyph (the `glyph` param); 'cell' entries carry their grid rect. */
export function glyphPlacements(p, w, h) {
  const out = []
  const focusName = p.glyph ?? 'o'
  if ((p.layout ?? 'single') === 'specimen') {
    const L = specimenLayout(p, w, h)
    const fg = renderGlyph(p.engine, focusName, p)
    if (fg) out.push({ name: focusName, g: fg, kind: 'focus', region: L.focus, ...placeGlyph(fg, focusName, p, L.focus.x, L.focus.y, L.focus.w, L.focus.h, 0.8) })
    for (const c of L.cells) {
      const g = renderGlyph(p.engine, c.name, p)
      if (!g) continue
      const { box } = cellMetrics(c.rect)
      out.push({ name: c.name, g, kind: 'cell', rect: c.rect, ...placeGlyph(g, c.name, p, box.x, box.y, box.w, box.h, 0.9) })
    }
  } else {
    const g = renderGlyph(p.engine, focusName, p)
    if (g) out.push({ name: focusName, g, kind: 'focus', region: { x: 0, y: 0, w, h }, ...placeGlyph(g, focusName, p, 0, 0, w, h, 0.8) })
  }
  return out
}

/* ── canvas helpers (draw-side only) ─────────────────────────────────── */

export function drawGlyphPlacement(ctx, pl) {
  ctx.save()
  ctx.translate(pl.tx, pl.ty)
  ctx.scale(pl.s, -pl.s)
  for (const path of pl.g.paths) {
    ctx.fill(new Path2D(path.d), path.fillRule === 'evenodd' ? 'evenodd' : 'nonzero')
  }
  ctx.restore()
}

/* Cell borders + glyph name labels + focus ring (labs grid buttons).
 * Theme-aware: strokes/labels are the fg role at labs' alpha steps. */
export function drawSpecimenChrome(ctx, p, placements) {
  ctx.save()
  ctx.strokeStyle = p.fg
  ctx.fillStyle = p.fg
  ctx.lineWidth = 1
  for (const pl of placements) {
    if (pl.kind !== 'cell') continue
    const r = pl.rect
    const { inset, label } = cellMetrics(r)
    ctx.globalAlpha = pl.name === (p.glyph ?? 'o') ? 0.4 : 0.08
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    ctx.globalAlpha = 0.55
    ctx.font = `${label}px ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(pl.name, r.x + r.w / 2, r.y + r.h - inset)
  }
  ctx.restore()
}

/* Metric lines over the big glyph (labs ParaTypePage Guides, :188-198):
 * baseline solid at fg·0.4, x-height/ascender/descender dashed at fg·0.16.
 * The cap line is dropped with the capHeight param — the ported engines
 * never read it (lowercase-only set). Drawn from the placement transform so
 * the lines sit on the engine's actual metrics. */
export function drawGuides(ctx, pl, x0, x1, p) {
  const y = (fy) => pl.ty - pl.s * fy
  const line = (fy, alpha, dash) => {
    ctx.globalAlpha = alpha
    ctx.setLineDash(dash)
    ctx.beginPath()
    ctx.moveTo(x0, y(fy))
    ctx.lineTo(x1, y(fy))
    ctx.stroke()
  }
  ctx.save()
  ctx.strokeStyle = p.fg
  ctx.lineWidth = 1
  line(0, 0.4, [])
  line(p.xHeight ?? 100, 0.16, [2, 3])
  line(p.ascender ?? 150, 0.16, [2, 3])
  line(-(p.descender ?? 40), 0.16, [2, 3])
  ctx.restore()
}

/* Labeled anatomy callouts on the big glyph (labs lab/controls/
 * AnatomyOverlay.jsx) — metric-derived, so it ports 1:1; 'cap' dropped with
 * the capHeight param (engines never read it). */
export function drawAnatomy(ctx, pl, x0, x1, p) {
  const rows = [
    ['asc', p.ascender ?? 150],
    ['x', p.xHeight ?? 100],
    ['base', 0],
    ['desc', -(p.descender ?? 40)],
  ]
  const sz = Math.max(8, Math.min(14, Math.round(pl.s * pl.gh * 0.06)))
  ctx.save()
  ctx.strokeStyle = p.fg
  ctx.fillStyle = p.fg
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  ctx.font = `${sz}px ui-monospace, monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  for (const [label, fy] of rows) {
    const cy = pl.ty - pl.s * fy
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(x0, cy)
    ctx.lineTo(x1, cy)
    ctx.stroke()
    ctx.globalAlpha = 0.7
    ctx.fillText(label, x0 + 4, cy - 3)
  }
  ctx.restore()
}
