import { classic } from './classic.js'
import { skeleton } from './skeleton.js'

// Para-type glyph (ported from kol-labs-single para-type/lab: engines/index.js
// renderGlyph + the engine-consumed subset of data.js PARAM_DEFS). Each engine
// renderer returns { width, paths: [{ d, part, fillRule? }] } in font units —
// baseline at y=0, y-up. The draw paints the glyph centered, scaled to fit
// ~80% of min(w,h) via Path2D.
//
// STATIC — u is intentionally unused; the render is a pure function of the
// anatomy params (frame(u) is constant, trivially seamless).
//
// Dropped from labs (dependency- or pipeline-driven): mathjs expression params
// (resolveParams / envelopes — every axis here is a frozen numeric range), and
// the PARAM_DEFS keys the engines never read (capHeight, spacing, roughen,
// noiseFreq, noiseSeed, weightFx, warpBend/Dh/Dv, flatness, simplify,
// perlinAmt/Freq — those feed the page-level FX pipeline, not the glyphs).

const ENGINES = { classic, skeleton }

export const GLYPH_ORDER = ['o', 'l', 'i', 'd', 'b', 'p', 'q', 'c', 'e', 'n', 'h', 'm', 't']

function renderGlyph(engineName, glyphName, params) {
  const engine = ENGINES[engineName] || ENGINES.classic
  const fn = engine[glyphName]
  if (!fn) return null
  return fn(params)
}

// Vertical extents [yMin, yMax] in font units (y-up, baseline 0), per glyph —
// used to center + fit. Derived from the engine geometry: bowls overshoot the
// x-height band, ascenders/descenders extend it, i carries the tittle.
function glyphBounds(name, p) {
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

const R = (key, label, min, max, def, step = 1) =>
  ({ key, label, type: 'range', min, max, step, default: def })

export default {
  id: 'paratype-glyph',
  label: 'Glyph',
  group: 'paratype',
  kind: '2d',
  duration: 6,
  params: [
    { key: 'glyph', label: 'Glyph', type: 'select', options: GLYPH_ORDER.map((g) => ({ value: g, label: g })), default: 'o' },
    { key: 'engine', label: 'Engine', type: 'select', options: [{ value: 'classic', label: 'Classic' }, { value: 'skeleton', label: 'Skeleton' }], default: 'classic' },
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0b0b0e' },
    { key: 'fg', label: 'Glyph colour', type: 'color', role: 'fg', default: '#e8e4dc' },
    /* metrics */
    R('xHeight', 'X-height', 40, 220, 100),
    R('ascender', 'Ascender', 60, 260, 150),
    R('descender', 'Descender', 5, 100, 40),
    R('overshoot', 'Overshoot', 0, 20, 4),
    /* weights */
    R('stemWidth', 'Stem width', 2, 60, 18),
    R('oWidth', 'Round width', 30, 220, 95),
    R('bowlWidth', 'Bowl width', 30, 220, 88),
    R('hairWidth', 'Hairline', 0.5, 30, 6, 0.5),
    /* expressive (METAFONT/Amstelvar/Prototypo lineage) */
    R('contrast', 'Contrast', 0, 1, 0.35, 0.01),
    R('aperture', 'Aperture', 0.1, 1, 0.7, 0.01),
    R('archHeight', 'Arch height', 0.5, 1.05, 0.92, 0.01),
    R('shoulder', 'Shoulder', 0, 0.4, 0.12, 0.01),
    R('superness', 'Superness', 0.1, 1.5, 0.5, 0.01),
    R('serif', 'Serif', 0, 1, 0, 0.01),
    R('jut', 'Jut length', 0, 1, 0, 0.01),
    /* resolution */
    { ...R('segments', 'Segments', 6, 200, 48), noRandom: true },
  ],
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    const g = renderGlyph(p.engine, p.glyph, p)
    if (!g) return

    const [y0, y1] = glyphBounds(p.glyph, p)
    const gw = Math.max(1, g.width)
    const gh = Math.max(1, y1 - y0)
    const s = (0.8 * Math.min(w, h)) / Math.max(gw, gh)

    ctx.save()
    // Center the glyph box; flip y (font units are y-up, canvas is y-down).
    ctx.translate(w / 2 - (gw * s) / 2, h / 2 + ((y0 + y1) / 2) * s)
    ctx.scale(s, -s)
    ctx.fillStyle = p.fg
    for (const path of g.paths) {
      ctx.fill(new Path2D(path.d), path.fillRule === 'evenodd' ? 'evenodd' : 'nonzero')
    }
    ctx.restore()
  },
}
