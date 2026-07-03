// Para-type loops (group 'paratype') — the parametric glyph renderer ported
// from kol-labs-single para-type/lab. One base loop; one picker preset per
// glyph letter (the labs GLYPH_ORDER) plus the labs style presets (curated
// anatomy-slider settings, labs lab/data.js PRESETS — contrast key dropped
// with the param). Surfaces on the `misc` layer, NOT the generative tree.

import glyph, { GLYPH_ORDER } from './glyph.js'

export const PARATYPE_LOOPS = [glyph]

/* Labs PRESETS verbatim minus keys the ported engines don't read. */
const STYLES = [
  ['Neutral',   {}],
  ['Didone',    { oWidth: 95, stemWidth: 26, archHeight: 0.95, shoulder: 0.05, superness: 0.55 }],
  ['Geometric', { oWidth: 110, stemWidth: 18, archHeight: 0.98, shoulder: 0, aperture: 0.5, superness: 0.5 }],
  ['Humanist',  { oWidth: 92, stemWidth: 16, archHeight: 0.88, shoulder: 0.18, aperture: 0.85, superness: 0.6 }],
  ['Heavy',     { stemWidth: 42, oWidth: 110, bowlWidth: 105, xHeight: 130 }],
  ['Spindly',   { stemWidth: 4, oWidth: 80, bowlWidth: 78, xHeight: 110, hairWidth: 2 }],
  ['Tall',      { xHeight: 70, ascender: 220, descender: 70 }],
  ['Square',    { superness: 1.3, aperture: 0.4, archHeight: 0.7, shoulder: 0 }],
  ['Rounded',   { superness: 0.35, aperture: 0.95, archHeight: 1.0 }],
]

export const PARATYPE_PRESETS = [
  ...GLYPH_ORDER.map((g) => ({
    id: `paratype-${g}`,
    label: g,
    loop: 'paratype-glyph',
    params: { glyph: g },
    sub: 'Glyphs',
  })),
  ...STYLES.map(([label, params]) => ({
    id: `paratype-style-${label.toLowerCase()}`,
    label,
    loop: 'paratype-glyph',
    params: { glyph: 'o', ...params },
    sub: 'Styles',
  })),
]
