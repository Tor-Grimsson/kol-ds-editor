// OpenType feature toggles for a type instance, rendered as a CSS
// `font-feature-settings` string on the per-glyph <text> elements (and the
// measure node, so advances reflect the active features).
//
// Ported from kol-labs-single src/pages/kinetic/engine/opentype.js (renamed —
// no relation to the opentype.js npm package). The feature list UI is not
// ported; compositions carry `opentype` objects opaquely.

// { liga: true, smcp: false } → `"liga" 1, "smcp" 0`. Empty → 'normal'.
export function featureString(ot) {
  if (!ot) return 'normal'
  const parts = []
  for (const [tag, on] of Object.entries(ot)) parts.push(`"${tag}" ${on ? 1 : 0}`)
  return parts.length ? parts.join(', ') : 'normal'
}
