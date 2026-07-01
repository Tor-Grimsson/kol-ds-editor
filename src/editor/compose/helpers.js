/* Walk the layer tree (including group children) and return the layer with
 * `id`, or null if none. Single source of truth — replaces 4 inline copies
 * that were drifting independently. */
export function findLayerDeep(layers, id) {
  for (const l of layers) {
    if (l.id === id) return l
    if (l.type === 'group' && Array.isArray(l.children)) {
      const found = findLayerDeep(l.children, id)
      if (found) return found
    }
  }
  return null
}
