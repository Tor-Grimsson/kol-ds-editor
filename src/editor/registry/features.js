/**
 * Feature registry — the plugin seam (plan.md "color modes as a feature" /
 * param-graph RFC). Every editor feature self-registers a manifest here; the
 * shell reads the registry instead of hardcoding the same mode list in three
 * places (Editor dispatch, Editor title map, MenuTop Mode menu).
 *
 * Today the features are the four modes (compose / palette / pattern / type).
 * Tomorrow an effect pack registers the same way. Consumers read only the
 * fields they need, so a new feature can add fields (layerTypes, sources,
 * inspector panels) without touching existing consumers — that is the seam.
 *
 * Manifest fields (all optional except id):
 *   id       unique slug, also the /editor/:mode route segment
 *   title    display label (Mode menu + page title)
 *   Provider React context provider wrapping the whole editor (state persists
 *            across mode switches); omit for a stateless feature
 *   Body     route body rendered when this feature is the active mode
 *   nav      show in the Mode menu (default true)
 *
 * ponytail: a Map + register/get, not a plugin framework. Grows a field at a
 * time when a real consumer needs one.
 */
const features = new Map()

export function registerFeature(manifest) {
  if (!manifest?.id) throw new Error('feature manifest needs an id')
  features.set(manifest.id, manifest)
  return manifest
}

export function getFeatures() {
  return [...features.values()]
}

export function getFeature(id) {
  return features.get(id)
}

/* Dev self-check — register/get round-trips, missing id throws. */
if (import.meta.env?.DEV) {
  const before = features.size
  registerFeature({ id: '__selfcheck', title: 'x' })
  console.assert(getFeature('__selfcheck')?.title === 'x', 'registry round-trip')
  let threw = false
  try { registerFeature({}) } catch { threw = true }
  console.assert(threw, 'missing id must throw')
  features.delete('__selfcheck')
  console.assert(features.size === before, 'self-check left no residue')
}
