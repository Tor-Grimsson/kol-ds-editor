/* Snap-and-guides helper for canvas drag/resize. Figma-style: the moving
 * rect's edges + center test against canvas edges/center and every other
 * positioned layer's edges/center. Snaps to the nearest target within
 * SNAP_THRESHOLD virtual px on each axis independently.
 *
 * Pure functions — caller (CanvasArea) owns the live drag math + guide
 * rendering. */

export const SNAP_THRESHOLD = 6

/* Build the candidate target list from the canvas bounds, every positioned
 * layer except the one being moved, and (optionally) the ruler guides
 * `{ h: y[], v: x[] }` — vertical guides are x targets, horizontal ones
 * y targets. */
export function computeSnapTargets(layers, excludeId, canvasW, canvasH, guides = null) {
  const h = [
    { value: 0,             source: 'canvas-left'   },
    { value: canvasW / 2,   source: 'canvas-center' },
    { value: canvasW,       source: 'canvas-right'  },
  ]
  const v = [
    { value: 0,             source: 'canvas-top'    },
    { value: canvasH / 2,   source: 'canvas-middle' },
    { value: canvasH,       source: 'canvas-bottom' },
  ]
  for (const l of layers) {
    if (l.id === excludeId) continue
    if (typeof l.x !== 'number' || typeof l.y !== 'number') continue
    const lw = l.w ?? 0
    const lh = l.h ?? 0
    h.push({ value: l.x,            source: `${l.id}-left`   })
    h.push({ value: l.x + lw / 2,   source: `${l.id}-center` })
    h.push({ value: l.x + lw,       source: `${l.id}-right`  })
    v.push({ value: l.y,            source: `${l.id}-top`    })
    v.push({ value: l.y + lh / 2,   source: `${l.id}-middle` })
    v.push({ value: l.y + lh,       source: `${l.id}-bottom` })
  }
  if (guides) {
    for (const x of guides.v ?? []) h.push({ value: x, source: 'guide' })
    for (const y of guides.h ?? []) v.push({ value: y, source: 'guide' })
  }
  return { h, v }
}

/* For a moving rect, find the best snap (smallest distance ≤ threshold)
 * on each axis. Returns { dx, dy, hGuide, vGuide } where dx/dy are the
 * coordinate offsets to apply, and hGuide/vGuide are the snap-line
 * positions (or null if no snap on that axis). */
export function findSnap(rect, targets) {
  const featuresH = [
    rect.x,
    rect.x + rect.w / 2,
    rect.x + rect.w,
  ]
  const featuresV = [
    rect.y,
    rect.y + rect.h / 2,
    rect.y + rect.h,
  ]
  let bestH = null
  let bestV = null
  for (const f of featuresH) {
    for (const t of targets.h) {
      const d = Math.abs(f - t.value)
      if (d <= SNAP_THRESHOLD && (bestH == null || d < bestH.d)) {
        bestH = { d, dx: t.value - f, guide: t.value }
      }
    }
  }
  for (const f of featuresV) {
    for (const t of targets.v) {
      const d = Math.abs(f - t.value)
      if (d <= SNAP_THRESHOLD && (bestV == null || d < bestV.d)) {
        bestV = { d, dy: t.value - f, guide: t.value }
      }
    }
  }
  return {
    dx:     bestH?.dx    ?? 0,
    dy:     bestV?.dy    ?? 0,
    hGuide: bestH?.guide ?? null,
    vGuide: bestV?.guide ?? null,
  }
}
