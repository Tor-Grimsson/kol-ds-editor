/* Bounding-box utilities for positioned layer sets. */

/* Compute the AABB of N positioned layers. Returns null if the set is
 * empty or no layer is positioned. */
export function computeBBox(layers) {
  const positioned = layers.filter(
    (l) => typeof l.x === 'number' && typeof l.y === 'number'
  )
  if (!positioned.length) return null
  const xs  = positioned.map((l) => l.x)
  const ys  = positioned.map((l) => l.y)
  const xs2 = positioned.map((l) => l.x + (l.w ?? 0))
  const ys2 = positioned.map((l) => l.y + (l.h ?? 0))
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs2) - x, h: Math.max(...ys2) - y }
}
