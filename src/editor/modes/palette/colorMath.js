/**
 * HSL conversion + mode generators for the Combo Lab palette engine.
 *
 * Two generation paths:
 *   - Pool-based: random sample from the pool, OR pick a random base + derive
 *     via HSL math.
 *   - Seed-based: slot 0 = user-supplied base, slots 1–4 derived via mode.
 */

export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex(h, s, l) {
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if      (h <  60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)]

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

const fillTo = (arr, n) => {
  if (arr.length >= n) return arr.slice(0, n)
  const out = [...arr]
  while (out.length < n) out.push(pickRandom(arr))
  return out
}

/* Pool-based modes — pick a random base from pool, derive slots 0-5. */
const MODES = {
  random: (pool) => fillTo(shuffle(pool), 6),

  monochromatic: (pool) => {
    const { h, s } = hexToHsl(pickRandom(pool))
    return [10, 25, 40, 55, 70, 85].map((l) => hslToHex(h, s, l))
  },

  analogous: (pool) => {
    const { h, s, l } = hexToHsl(pickRandom(pool))
    return [-45, -25, -10, 10, 25, 45].map((o) => hslToHex((h + o + 360) % 360, s, l))
  },

  complementary: (pool) => {
    const { h, s, l } = hexToHsl(pickRandom(pool))
    return [
      hslToHex(h, s, Math.max(15, l - 25)),
      hslToHex(h, s, l),
      hslToHex(h, s, Math.min(85, l + 25)),
      hslToHex((h + 180) % 360, s, Math.max(15, l - 15)),
      hslToHex((h + 180) % 360, s, l),
      hslToHex((h + 180) % 360, s, Math.min(85, l + 15)),
    ]
  },

  triadic: (pool) => {
    const { h, s, l } = hexToHsl(pickRandom(pool))
    return [
      hslToHex(h, s, l),
      hslToHex((h + 120) % 360, s, l),
      hslToHex((h + 240) % 360, s, l),
      hslToHex(h, s, Math.min(85, l + 20)),
      hslToHex((h + 120) % 360, s, Math.max(15, l - 20)),
      hslToHex((h + 240) % 360, s, Math.min(85, l + 20)),
    ]
  },

  doubleComplementary: (pool) => {
    const { h, s, l } = hexToHsl(pickRandom(pool))
    return [
      hslToHex(h, s, l),
      hslToHex((h + 90) % 360, s, l),
      hslToHex((h + 180) % 360, s, l),
      hslToHex((h + 270) % 360, s, l),
      hslToHex(h, s, Math.min(85, l + 20)),
      hslToHex((h + 180) % 360, s, Math.max(15, l - 20)),
    ]
  },
}

/* Seed-based modes — slot 0 = user base, slots 1-5 derived via mode.
 * Each call jitters the parameters so consecutive randomize clicks produce
 * visibly different but harmonically-related variants around the same seed. */
const jitter = (range) => (Math.random() - 0.5) * 2 * range

const SEED_MODES = {
  random: (base) => {
    const { h, s, l } = hexToHsl(base)
    return [
      base,
      hslToHex((h + Math.random() * 360) % 360, s, l),
      hslToHex((h + Math.random() * 360) % 360, s, l),
      hslToHex(h, s, Math.max(10, l - 25 + jitter(10))),
      hslToHex(h, s, Math.min(90, l + 25 + jitter(10))),
      hslToHex(h, s * (0.4 + Math.random() * 0.4), l),
    ]
  },

  monochromatic: (base) => {
    const { h, s, l } = hexToHsl(base)
    const j = 8
    return [
      base,
      hslToHex(h, s, Math.max(10, l - 30 + jitter(j))),
      hslToHex(h, s, Math.max(20, l - 15 + jitter(j))),
      hslToHex(h, s, Math.min(85, l + 15 + jitter(j))),
      hslToHex(h, s, Math.min(95, l + 30 + jitter(j))),
      hslToHex(h, s, Math.min(98, l + 45 + jitter(j))),
    ]
  },

  analogous: (base) => {
    const { h, s, l } = hexToHsl(base)
    return [
      base,
      hslToHex((h - 30 + jitter(8) + 360) % 360, s, l),
      hslToHex((h - 15 + jitter(8) + 360) % 360, s, l),
      hslToHex((h + 15 + jitter(8)) % 360, s, l),
      hslToHex((h + 30 + jitter(8)) % 360, s, l),
      hslToHex((h + 45 + jitter(8)) % 360, s, l),
    ]
  },

  complementary: (base) => {
    const { h, s, l } = hexToHsl(base)
    return [
      base,
      hslToHex(h, s, Math.max(15, l - 25 + jitter(8))),
      hslToHex(h, s, Math.min(85, l + 25 + jitter(8))),
      hslToHex((h + 180 + jitter(10)) % 360, s, l),
      hslToHex((h + 180 + jitter(10)) % 360, s, Math.max(15, l - 15 + jitter(8))),
      hslToHex((h + 180 + jitter(10)) % 360, s, Math.min(85, l + 15 + jitter(8))),
    ]
  },

  triadic: (base) => {
    const { h, s, l } = hexToHsl(base)
    return [
      base,
      hslToHex((h + 120 + jitter(10)) % 360, s, l),
      hslToHex((h + 240 + jitter(10)) % 360, s, l),
      hslToHex(h, s, Math.min(85, l + 20 + jitter(8))),
      hslToHex((h + 120 + jitter(10)) % 360, s, Math.max(15, l - 20 + jitter(8))),
      hslToHex((h + 240 + jitter(10)) % 360, s, Math.min(85, l + 20 + jitter(8))),
    ]
  },

  doubleComplementary: (base) => {
    const { h, s, l } = hexToHsl(base)
    return [
      base,
      hslToHex((h + 90 + jitter(10)) % 360, s, l),
      hslToHex((h + 180 + jitter(10)) % 360, s, l),
      hslToHex((h + 270 + jitter(10)) % 360, s, l),
      hslToHex(h, s, Math.min(85, l + 20 + jitter(8))),
      hslToHex((h + 180 + jitter(10)) % 360, s, Math.max(15, l - 20 + jitter(8))),
    ]
  },
}

/**
 * Pick a pool color suitable for the BG slot. Excludes any color already used
 * by the 5 layout slots. If the pool is exhausted, extends the ramp via HSL
 * lightness shift.
 */
function pickBgColor(layoutColors, pool) {
  const used = new Set(layoutColors.map((c) => c.toUpperCase()))
  const candidates = pool.filter((c) => !used.has(c.toUpperCase()))
  if (candidates.length > 0) return pickRandom(candidates)

  const base = pickRandom(pool)
  const { h, s, l } = hexToHsl(base)
  const shifts = [-20, 20, -35, 35, -50, 50]
  for (const shift of shifts) {
    const candidate = hslToHex(h, s, Math.max(5, Math.min(95, l + shift))).toUpperCase()
    if (!used.has(candidate)) return candidate
  }
  return hslToHex(h, s, l > 50 ? 5 : 95)
}

/** BG for seed-based palettes — derived from the seed via lightness shift. */
function pickBgFromSeed(layoutColors, baseColor) {
  const used = new Set(layoutColors.map((c) => c.toUpperCase()))
  const { h, s, l } = hexToHsl(baseColor)
  const shifts = [-50, 50, -35, 35, -20, 20]
  for (const shift of shifts) {
    const candidate = hslToHex(h, s, Math.max(5, Math.min(95, l + shift))).toUpperCase()
    if (!used.has(candidate)) return candidate
  }
  return hslToHex(h, s, l > 50 ? 5 : 95)
}

/**
 * Generate 6 colors using the chosen pool/mode, preserving locked slots.
 *
 * If `baseColor` is provided (seed pool), slots are derived from the base via
 * SEED_MODES. Otherwise pool sampling via MODES.
 */
export function generatePalette(pool, mode, currentColors, locks, baseColor) {
  let layoutColors
  let bgColor
  if (baseColor) {
    const gen = SEED_MODES[mode] ?? SEED_MODES.random
    layoutColors = gen(baseColor).slice(0, 5)
    bgColor = pickBgFromSeed(layoutColors, baseColor)
  } else {
    const gen = MODES[mode] ?? MODES.random
    layoutColors = gen(pool).slice(0, 5)
    bgColor = pickBgColor(layoutColors, pool)
  }
  const final = [...layoutColors, bgColor]
  return final.map((c, i) => (locks[i] ? currentColors[i] : c))
}
