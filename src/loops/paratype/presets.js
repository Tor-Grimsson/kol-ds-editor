// Para-type loops (group 'paratype', label 'Para-type') — the parametric glyph
// renderer ported from kol-labs-single para-type/lab. One base loop; one picker
// preset per glyph letter (the labs GLYPH_ORDER), same idiom as shape/field.

import glyph, { GLYPH_ORDER } from './glyph.js'

export const PARATYPE_LOOPS = [glyph]

export const PARATYPE_PRESETS = GLYPH_ORDER.map((g) => ({
  id: `paratype-${g}`,
  label: g,
  loop: 'paratype-glyph',
  params: { glyph: g },
  sub: 'Glyphs',
}))
