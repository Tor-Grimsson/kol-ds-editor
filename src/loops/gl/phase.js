/**
 * Per-layer loop phase — a layer's `duration` param sets how fast its engine
 * animation cycles relative to the ONE global transport loop. Seamlessness
 * demands an integer cycle count (the pose at u=1 must equal u=0), so an
 * arbitrary loopSeconds/duration ratio QUANTIZES to the nearest integer ≥ 1:
 * a layer runs 1, 2, 3… full cycles per transport loop, never a fraction.
 * Durations longer than the global loop clamp to one cycle — a layer can't be
 * slower than the loop without breaking the loop point.
 *
 * Pure + three-free so inspector components can import it statically
 * (gl/host.js itself only loads lazily, dragging three with it).
 */
export function layerCycles(duration, loopSeconds) {
  const d = Number(duration)
  const L = Number(loopSeconds)
  if (!d || d <= 0 || !L || L <= 0) return 1
  return Math.max(1, Math.round(L / d))
}

/* Layer-local phase from the global playhead. */
export function layerPhase(u, cycles) {
  return (u * cycles) % 1
}
