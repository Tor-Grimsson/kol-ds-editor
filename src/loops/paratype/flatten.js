/* Flatten-to-vector for the paratype loop (labs exports the glyph set as
 * real SVG paths — ParaTypePage.jsx buildSVGString:251-280; here the same
 * engine path data becomes editable shape layers instead of a download).
 *
 * buildParatypeFlattenGroup(layer, colors, newId) → a `group` layer that
 * replaces the misc layer in place (state.jsx flattenPattern/flattenText
 * precedent): one `shape{kind:'flatten'}` child per drawn glyph, each with
 * its own inner SVG of the engine's real paths, positioned group-relative
 * via the SAME placement math the canvas draw uses (specimen.js
 * glyphPlacements) — so the vector result lands exactly on the raster it
 * replaces. Grid chrome (cell borders, labels) and the guide/anatomy
 * overlays are view chrome, not artwork — they don't flatten. One-way;
 * undo restores. */

import glyphDef from './glyph.js'
import { glyphPlacements } from './specimen.js'

const DEFAULTS = Object.fromEntries(glyphDef.params.map((q) => [q.key, q.default]))

/* Layer params can carry binding objects on animated keys — flatten reads
 * the schema keys raw, so anything non-scalar falls back to its default. */
function schemaParams(layer) {
  const p = { ...DEFAULTS }
  for (const k of Object.keys(DEFAULTS)) {
    const v = layer[k]
    if (v != null && typeof v !== 'object') p[k] = v
  }
  return p
}

/* Horizontal overflow beyond the glyph's [0..width] box, in font units —
 * serif feet extend past the stem (classic serifFoot: ext = max(2, s·0.7)·
 * serif + jut·s·1.5) and the i tittle is a hair wider than the stem. The
 * inner SVG viewBox pads by this so nothing clips at the shape edge. */
function glyphPadX(name, p) {
  const s = p.stemWidth ?? 18
  let pad = 0
  if ((p.serif ?? 0) > 0) pad = Math.max(2, s * 0.7) * p.serif + (p.jut ?? 0) * s * 1.5 + 1
  if (name === 'i') pad = Math.max(pad, s * 0.1 + 1)
  return pad
}

const fmt = (n) => Number(n.toFixed(2))

/* Build the replacement group, or null when the layer isn't a paratype-glyph
 * loop (or nothing renders). `colors` = { fg, bg } — resolved hex from the
 * caller (palette refs resolved in state.jsx); bg null = transparent
 * (layer.bgOn === false), otherwise it becomes a backing rect child
 * (flattenPattern keeps its bg too). */
export function buildParatypeFlattenGroup(layer, colors, newId) {
  if (!layer || layer.loopId !== 'paratype-glyph') return null
  const w = Math.max(1, layer.w ?? 480)
  const h = Math.max(1, layer.h ?? 480)
  const p = schemaParams(layer)

  const placements = glyphPlacements(p, w, h)
  if (!placements.length) return null

  const children = []
  if (colors.bg) {
    children.push({
      id: newId('shape'),
      type: 'shape',
      kind: 'rect',
      color: colors.bg,
      x: 0, y: 0, w, h,
      visible: true, opacity: 1, blend: 'normal',
    })
  }

  for (const pl of placements) {
    const padX = glyphPadX(pl.name, p) + 1.5
    const padY = 1.5
    const vw = pl.gw + padX * 2
    const vh = pl.gh + padY * 2
    /* Font units are y-up with baseline 0; the SVG group flips y and drops
     * the box top (y1 + pad) onto the viewBox origin. */
    const paths = pl.g.paths.map((path) =>
      `<path d="${path.d.replace(/\s+/g, ' ').trim()}"${path.fillRule ? ` fill-rule="${path.fillRule}"` : ''} fill="currentColor"/>`
    ).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(vw)} ${fmt(vh)}" preserveAspectRatio="none"><g transform="translate(${fmt(padX)} ${fmt(pl.y1 + padY)}) scale(1 -1)">${paths}</g></svg>`
    children.push({
      id: newId('shape'),
      type: 'shape',
      kind: 'flatten',
      svg,
      fit: 'fill',
      color: colors.fg,
      /* Group-relative canvas box of the padded viewBox: font x=-padX maps
       * to tx - padX·s, font y=y1+padY (top) maps to ty - (y1+padY)·s. */
      x: fmt(pl.tx - padX * pl.s),
      y: fmt(pl.ty - (pl.y1 + padY) * pl.s),
      w: Math.max(1, fmt(vw * pl.s)),
      h: Math.max(1, fmt(vh * pl.s)),
      visible: true, opacity: 1, blend: 'normal',
    })
  }

  return {
    id: newId('group'),
    type: 'group',
    x: layer.x ?? 0, y: layer.y ?? 0,
    w, h,
    visible: layer.visible ?? true,
    opacity: layer.opacity ?? 1,
    blend: layer.blend ?? 'normal',
    children,
  }
}
