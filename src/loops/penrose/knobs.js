// Per-prototype dev knobs. A prototype declares `params: Param[]` statically.
// The KnobsPanel React component (main.jsx) renders the schema; value changes
// remount the prototype. fmt is exported for the panel's slider readouts.

export function defaultValues(params) {
  const v = {}
  if (!params) return v
  for (const p of params) v[p.key] = p.default
  return v
}

export function fmt(v, isInt) {
  if (isInt) return String(Math.round(v))
  return Number(v).toFixed(2)
}

// Convenience helpers for prototypes reading values with defaults.
export function num(v, key, fallback) {
  const x = v[key]
  return typeof x === 'number' ? x : fallback
}
export function bool(v, key, fallback) {
  const x = v[key]
  return typeof x === 'boolean' ? x : fallback
}
export function str(v, key, fallback) {
  const x = v[key]
  return typeof x === 'string' ? x : fallback
}
