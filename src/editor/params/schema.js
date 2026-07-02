/**
 * Param schema — one declarative descriptor grammar for every layer type's
 * tunable knobs. The inspector auto-renders controls from it; later the
 * timeline reads `animatable` to know which props accept keyframe/modulation
 * bindings.
 *
 * Adopted from kol-labs `src/loops/contract.js` (the effects repo) so imported
 * loop modules' `params:[...]` arrays drop in with no translation — this is
 * the canonical grammar the two repo dialects normalize to (param-graph RFC).
 *
 * Descriptor:
 *   { key, label, type, default,
 *     min?, max?, step?, options?, format?, when?, animatable?, tab?, section? }
 *
 *   type     'range' | 'color' | 'select' | 'segmented' | 'toggle' | 'text'
 *   options  [{ value, label }]   — for select / segmented
 *   format   (v) => string        — hint text for a range
 *   when     (layer) => bool       — conditional visibility (e.g. star-only)
 *   animatable  override; defaults true for range/color, false otherwise
 *   tab      'generate' | 'style' | 'anim' — Parameters-panel sub-tab; absent
 *            defaults to 'style'. The labs dialect's `tab:'color'` is honored
 *            as style with a 'Color' section.
 *   section  sentence-case group header ('Geometry', 'Motion', …) — consecutive
 *            same-section params share one header; absent = unsectioned run
 */

/* Build the default-value object from a schema (mirrors loopDefaults()). */
export function schemaDefaults(schema) {
  const out = {}
  for (const p of schema) out[p.key] = p.default
  return out
}

/* Params visible for the current layer state (honors `when`). */
export function visibleParams(schema, layer) {
  return schema.filter((p) => !p.when || p.when(layer))
}

const ANIMATABLE_TYPES = new Set(['range', 'color'])
export function isAnimatable(p) {
  return p.animatable ?? ANIMATABLE_TYPES.has(p.type)
}

/* Resolved Parameters-panel sub-tab for a param (see grammar above). */
export function paramTab(p) {
  return p.tab === 'anim' || p.tab === 'generate' ? p.tab : 'style'
}

/* Section header for a param — null means the unsectioned run. */
export function paramSection(p) {
  return p.section ?? (p.tab === 'color' ? 'Color' : null)
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  const s = [
    { key: 'kind', type: 'select', default: 'rect', options: [] },
    { key: 'sides', type: 'range', default: 5, when: (l) => l.kind === 'polygon' },
  ]
  const d = schemaDefaults(s)
  console.assert(d.kind === 'rect' && d.sides === 5, 'schemaDefaults')
  console.assert(visibleParams(s, { kind: 'rect' }).length === 1, 'visibleParams hides when=false')
  console.assert(visibleParams(s, { kind: 'polygon' }).length === 2, 'visibleParams shows when=true')
  console.assert(isAnimatable({ type: 'range' }) && !isAnimatable({ type: 'select' }), 'isAnimatable default by type')
  console.assert(paramTab({}) === 'style' && paramTab({ tab: 'anim' }) === 'anim' && paramTab({ tab: 'color' }) === 'style', 'paramTab defaults + color alias')
  console.assert(paramSection({ tab: 'color' }) === 'Color' && paramSection({ section: 'Geometry' }) === 'Geometry' && paramSection({}) === null, 'paramSection')
}
