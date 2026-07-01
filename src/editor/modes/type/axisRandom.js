/**
 * Per-letter random axis — deterministic (width, weight) pick per char index
 * + seed. Same inputs → same output, so re-renders don't shuffle on every
 * keystroke. Scrubbing the seed (via the canvas blend handle) re-rolls the
 * layout.
 */

import { WIDTHS, WEIGHTS } from './cuts'

/* Pool: every (width, weight) pair from the design system. */
export const CUT_POOL = []
for (const w of WIDTHS) {
  for (const wt of WEIGHTS) {
    CUT_POOL.push([w.id, wt.id])
  }
}

function hash32(x) {
  x = (x | 0) >>> 0
  x = ((x ^ 61) ^ (x >>> 16)) >>> 0
  x = (x + (x << 3)) >>> 0
  x = (x ^ (x >>> 4)) >>> 0
  x = Math.imul(x, 0x27d4eb2d) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  return x
}

/**
 * Deterministic pick from the cut pool.
 *   opts.widthLock  — '' / falsy = any; otherwise restrict to matching width id
 *   opts.weightLock — 0 / falsy = any; otherwise restrict to matching weight
 * If locks reduce the pool to empty, falls back to full pool to avoid blanks.
 */
export function pickCutFor(charIndex, seed, opts = {}) {
  let pool = CUT_POOL
  if (opts.widthLock)  pool = pool.filter(([w])     => w === opts.widthLock)
  if (opts.weightLock) pool = pool.filter(([, wt]) => wt === Number(opts.weightLock))
  if (pool.length === 0) pool = CUT_POOL
  const h = hash32(charIndex * 374761393 + (seed | 0) * 668265263)
  return pool[h % pool.length]
}

/* Seed derived from the frame's `blend` (0..1) — 5-digit prime range so small
 * scrubs visibly change the layout. */
export const seedFromBlend = (blend) => Math.floor((blend ?? 0) * 99991)
