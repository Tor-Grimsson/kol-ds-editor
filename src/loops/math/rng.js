// Seeded PRNG shared by the math loops (ported from kol-labs-single src/lib/rng.js).

/** Deterministic 0..1 PRNG seeded by an integer. Same seed → same sequence. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
