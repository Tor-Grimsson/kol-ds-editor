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
 *     min?, max?, step?, options?, format?, when?, animatable? }
 *
 *   type     'range' | 'color' | 'select' | 'segmented' | 'toggle' | 'text'
 *   options  [{ value, label }]   — for select / segmented
 *   format   (v) => string        — hint text for a range
 *   when     (layer) => bool       — conditional visibility (e.g. star-only)
 *   animatable  override; defaults true for range/color, false otherwise
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
}
