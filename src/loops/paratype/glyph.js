// Para-type glyph (ported from kol-labs-single para-type/lab: engines/index.js
// renderGlyph + the engine-consumed subset of data.js PARAM_DEFS). Each engine
// renderer returns { width, paths: [{ d, part, fillRule? }] } in font units —
// baseline at y=0, y-up. Geometry (render/fit/specimen layout) lives in
// specimen.js, shared with the flatten-to-vector builder (flatten.js).
//
// Layouts: 'single' paints the one `glyph` centered at 80% fit; 'specimen'
// is the labs review loop (ParaTypePage.jsx:374-410) — the big focus glyph
// over the full glyph grid in one canvas, scoped by `filterSet` +
// `visibleCount`. Click-to-focus stayed behind (canvas has no per-cell hit
// targets; the `glyph` select covers it). `showGuides` / `showAnatomy`
// overlay the labs metric lines / anatomy callouts on the big glyph.
//
// STATIC — u is intentionally unused; the render is a pure function of the
// anatomy params (frame(u) is constant, trivially seamless).
//
// Dropped from labs (dependency- or pipeline-driven): mathjs expression params
// (resolveParams / envelopes — every axis here is a frozen numeric range), and
// the PARAM_DEFS keys the engines never read (capHeight, spacing, roughen,
// noiseFreq, noiseSeed, weightFx, warpBend/Dh/Dv, flatness, simplify,
// perlinAmt/Freq — those feed the page-level FX pipeline, not the glyphs).

import {
  GLYPH_ORDER, FILTER_SETS,
  glyphPlacements, drawGlyphPlacement, drawSpecimenChrome, drawGuides, drawAnatomy,
} from './specimen.js'

export { GLYPH_ORDER }

const R = (key, label, min, max, def, step = 1) =>
  ({ key, label, type: 'range', min, max, step, default: def })

/* Anatomy params are glyph- (and engine-) dependent — gate each knob to the
 * glyphs whose renderer actually reads it (see classic.js / skeleton.js).
 * In the specimen layout every glyph renders, so the glyph gates open up
 * (isSpec) — engine gates stay. */
const isSpec = (l) => (l.layout ?? 'single') === 'specimen'
const hasG = (l, ks) => ks.includes(l.glyph ?? 'o')
const isG = (l, ks) => isSpec(l) || hasG(l, ks)
const isClassic = (l) => (l.engine ?? 'classic') === 'classic'

export default {
  id: 'paratype-glyph',
  label: 'Glyph',
  group: 'paratype',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'glyph', label: 'Glyph', type: 'select', options: GLYPH_ORDER.map((g) => ({ value: g, label: g })), default: 'o' },
    { key: 'engine', label: 'Engine', type: 'select', options: [{ value: 'classic', label: 'Classic' }, { value: 'skeleton', label: 'Skeleton' }], default: 'classic' },
    /* view (labs View rail section) — chrome, never randomized */
    { key: 'layout', label: 'Layout', type: 'select', noRandom: true, options: [{ value: 'single', label: 'Single' }, { value: 'specimen', label: 'Specimen' }], default: 'single' },
    { key: 'filterSet', label: 'Glyph set', type: 'select', noRandom: true, options: Object.keys(FILTER_SETS).map((k) => ({ value: k, label: k })), default: 'All', when: isSpec },
    { key: 'visibleCount', label: 'Visible', type: 'select', noRandom: true, options: [{ value: '6', label: '6' }, { value: '8', label: '8' }, { value: '10', label: '10' }, { value: 'all', label: 'all' }], default: 'all', when: isSpec },
    { key: 'showGuides', label: 'Guides', type: 'toggle', noRandom: true, default: false },
    { key: 'showAnatomy', label: 'Anatomy', type: 'toggle', noRandom: true, default: false },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'fg', label: 'Glyph colour', type: 'color', role: 'fg', default: '#e8e4dc' },
    /* metrics */
    { ...R('xHeight', 'X-height', 40, 220, 100), when: (l) => isSpec(l) || (l.glyph ?? 'o') !== 'l' },
    { ...R('ascender', 'Ascender', 60, 260, 150), when: (l) => isG(l, ['l', 'd', 'b', 'h']) },
    { ...R('descender', 'Descender', 5, 100, 40), when: (l) => isG(l, ['p', 'q']) },
    { ...R('overshoot', 'Overshoot', 0, 20, 4), when: (l) => isSpec(l) || !hasG(l, ['l', 'i', 't']) },
    /* weights */
    R('stemWidth', 'Stem width', 2, 60, 18),
    { ...R('oWidth', 'Round width', 30, 220, 95), when: (l) => isG(l, ['o', 'c', 'e', 'n', 'm', 'h']) },
    { ...R('bowlWidth', 'Bowl width', 30, 220, 88), when: (l) => isG(l, ['d', 'b', 'p', 'q']) },
    { ...R('hairWidth', 'Hairline', 0.5, 30, 6, 0.5), when: (l) => isG(l, ['o', 'd', 'b', 'p', 'q', 'e', 'n', 'm', 'h']) || (isClassic(l) && l.glyph === 'c') },
    /* expressive (METAFONT/Amstelvar/Prototypo lineage) */
    { ...R('aperture', 'Aperture', 0.1, 1, 0.7, 0.01), when: (l) => isG(l, ['c', 'e']) },
    { ...R('archHeight', 'Arch height', 0.5, 1.05, 0.92, 0.01), when: (l) => isG(l, ['n', 'm', 'h']) },
    { ...R('shoulder', 'Shoulder', 0, 0.4, 0.12, 0.01), when: (l) => isG(l, ['n', 'm', 'h']) },
    { ...R('superness', 'Superness', 0.1, 1.5, 0.5, 0.01), when: (l) => isG(l, ['o', 'd', 'b', 'p', 'q']) || (!isClassic(l) && isG(l, ['c', 'e'])) },
    { ...R('serif', 'Serif', 0, 1, 0, 0.01), when: (l) => isClassic(l) && isG(l, ['l', 'i', 'd', 'b', 'n', 'm', 'h']) },
    { ...R('jut', 'Jut length', 0, 1, 0, 0.01), when: (l) => isClassic(l) && isG(l, ['l', 'i', 'd', 'b', 'n', 'm', 'h']) && (l.serif ?? 0) > 0 },
    /* resolution */
    { ...R('segments', 'Segments', 6, 200, 48), noRandom: true, when: (l) => isSpec(l) || (l.glyph ?? 'o') === 'o' || (!isClassic(l) && isG(l, ['c', 'e'])) },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const placements = glyphPlacements(p, w, h)
    if (!placements.length) return
    const focus = placements.find((pl) => pl.kind === 'focus')
    const specimen = (p.layout ?? 'single') === 'specimen'

    if (specimen) drawSpecimenChrome(ctx, p, placements)
    /* labs z-order: guides under the glyph, anatomy over it. */
    if (p.showGuides && focus) drawGuides(ctx, focus, focus.region.x, focus.region.x + focus.region.w, p)

    ctx.fillStyle = p.fg
    for (const pl of placements) drawGlyphPlacement(ctx, pl)

    if (p.showAnatomy && focus) drawAnatomy(ctx, focus, focus.region.x, focus.region.x + focus.region.w, p)
  },
}
