// rng — the seeded PRNG shared across the experiment pages (gradient, primitive
// and penrose each carried their own copy of this exact function) plus a
// schema-driven param randomiser used by the Randomise button.

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

/** A random integer seed for the seed input / Randomise button. */
export function randomSeed() {
  return Math.floor(Math.random() * 1e9)
}

const randHex = (rng) => Math.floor(rng() * 256).toString(16).padStart(2, '0')
const randColor = (rng) => `#${randHex(rng)}${randHex(rng)}${randHex(rng)}`

/**
 * Roll a value object from a declarative param schema using `rng`.
 * Honours param bounds; SKIPS params flagged `noRandom` (structural — counts,
 * resolution, steps — that would thrash geometry or size arrays).
 *
 * Schema entries: { key, type, min, max, step, options, noRandom }
 *   type 'range'           → min..max snapped to step
 *   type 'select'          → one of options (value or {value})
 *   type 'toggle'|'boolean'→ true/false
 *   type 'color'           → random hex
 * Anything else is left out (caller keeps its current value).
 */
export function randomizeSchema(params, rng) {
  const out = {}
  if (!Array.isArray(params)) return out
  for (const p of params) {
    if (!p || p.noRandom) continue
    if (p.type === 'range') {
      const min = p.min ?? 0
      const max = p.max ?? 1
      const step = p.step || 0.01
      const v = min + rng() * (max - min)
      out[p.key] = step >= 1 ? Math.round(v) : Math.round(v / step) * step
    } else if (p.type === 'select') {
      const opts = p.options || []
      if (!opts.length) continue
      const o = opts[Math.floor(rng() * opts.length)]
      out[p.key] = o && typeof o === 'object' ? o.value : o
    } else if (p.type === 'toggle' || p.type === 'boolean') {
      out[p.key] = rng() > 0.5
    } else if (p.type === 'color') {
      out[p.key] = randColor(rng)
    }
  }
  return out
}
