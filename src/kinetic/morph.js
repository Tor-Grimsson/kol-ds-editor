// Glyph-outline morphing for the kinetic engine — the "morph monster", ported
// from kol-labs-single src/pages/kinetic/engine/morph.js.
//
// Extract real glyph outlines via opentype.js and interpolate the bézier path
// commands directly, distributed across the word by a curve. Two sources for
// Cut A / Cut B:
//   - SAME variable font at two axis-coordinate sets (wght/wdth) — opentype 2.x
//     applies the variation, so topology is IDENTICAL and the morph is flawless.
//   - TWO different faces — topology usually differs, so we pop to the closer
//     outline at blend 0.5 (same graceful snap the brand tool used).
//
// Pure + framework-agnostic (no DOM): returns SVG path `d` strings + advances,
// which KineticType places onto its paths exactly like the <text> glyphs.
//
// Editor adaptation: labs' `custom` curve (an on-canvas drag-a-bezier overlay)
// is not ported — curveBlend keeps the branch (cp1/cp2 defaults resolve it for
// hand-authored comps) but CURVE_OPTIONS only lists the named curves.

import opentype from 'opentype.js'

const TAU = Math.PI * 2
export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a * (1 - t) + b * t

// Deterministic 0..1 PRNG (mulberry32) — inlined so the kinetic module stays
// self-contained (labs imports it from lib/rng.js; same function).
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── font loading (cached by url) ─────────────────────────────────────────────
const fontCache = new Map() // url → Promise<opentype.Font>

export function loadGlyphFont(url) {
  if (fontCache.has(url)) return fontCache.get(url)
  const promise = (async () => {
    const buf = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`font fetch failed: ${url}`)
      return r.arrayBuffer()
    })
    return opentype.parse(buf)
  })()
  fontCache.set(url, promise)
  promise.catch(() => fontCache.delete(url))
  return promise
}

// Synchronous accessor for an already-resolved font (null until loaded).
const resolved = new Map() // url → Font
export function resolvedFont(url) { return resolved.get(url) || null }
export function ensureGlyphFont(url) {
  if (resolved.has(url)) return Promise.resolve(resolved.get(url))
  return loadGlyphFont(url).then((f) => { resolved.set(url, f); return f })
}

// ── command helpers (lifted from the brand morph, kept byte-faithful) ────────
function commandsToPath(cmds) {
  const out = []
  for (const c of cmds) {
    switch (c.type) {
      case 'M': out.push(`M${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'L': out.push(`L${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'C': out.push(`C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Q': out.push(`Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Z': out.push('Z'); break
      default: break
    }
  }
  return out.join('')
}

function commandsMatch(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].type !== b[i].type) return false
  return true
}

function lerpCommands(a, b, t) {
  return a.map((ca, i) => {
    const cb = b[i]
    const out = { type: ca.type }
    if ('x' in ca && 'x' in cb) out.x = lerp(ca.x, cb.x, t)
    if ('y' in ca && 'y' in cb) out.y = lerp(ca.y, cb.y, t)
    if ('x1' in ca && 'x1' in cb) out.x1 = lerp(ca.x1, cb.x1, t)
    if ('y1' in ca && 'y1' in cb) out.y1 = lerp(ca.y1, cb.y1, t)
    if ('x2' in ca && 'x2' in cb) out.x2 = lerp(ca.x2, cb.x2, t)
    if ('y2' in ca && 'y2' in cb) out.y2 = lerp(ca.y2, cb.y2, t)
    return out
  })
}

function commandsBbox(cmds) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const c of cmds) {
    for (const k of ['x', 'x1', 'x2']) if (k in c) { x1 = Math.min(x1, c[k]); x2 = Math.max(x2, c[k]) }
    for (const k of ['y', 'y1', 'y2']) if (k in c) { y1 = Math.min(y1, c[k]); y2 = Math.max(y2, c[k]) }
  }
  return x1 === Infinity ? { x1: 0, y1: 0, x2: 0, y2: 0 } : { x1, y1, x2, y2 }
}

// ── outline extraction (variation-aware) ─────────────────────────────────────
const variationFor = (font, coords) => {
  if (!coords || !font.tables || !font.tables.fvar) return undefined
  const out = {}
  for (const a of font.tables.fvar.axes) if (coords[a.tag] != null) out[a.tag] = coords[a.tag]
  return Object.keys(out).length ? out : undefined
}

function glyphCommands(font, ch, size, coords) {
  const opts = {}
  const v = variationFor(font, coords)
  if (v) opts.variation = v
  return font.getPath(ch, 0, 0, size, opts).commands
}

// opentype 2.x's getAdvanceWidth ignores the variation axes (the static advance
// comes back unchanged at every coord), so a glyph morphing narrow→wide would
// overlap its neighbour. The OUTLINE does vary, so we space from the varied ink
// bbox instead: advance = ink width + gap. Width-responsive and font-agnostic.
const inkWidth = (bbox) => Math.max(0, bbox.x2 - bbox.x1)
// Advance = varied ink width + ~22% for side bearings (opentype's static advance
// ignores the variation, so bearings are approximated proportionally) + the gap
// (em-fraction + letterSpacing). The proportional term is what stops wide/heavy
// morphed glyphs from overlapping their neighbours.
function advanceFromInk(ch, bbox, size, gap) {
  if (ch === ' ') return size * 0.32 + gap
  return inkWidth(bbox) * 1.22 + gap
}

// ── curve distribution (ported from brand curveMath) ─────────────────────────
function cubicBezier(x1, y1, x2, y2, t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0, hi = 1
  for (let i = 0; i < 30; i++) {
    const s = (lo + hi) / 2
    const o = 1 - s
    const x = 3 * o * o * s * x1 + 3 * o * s * s * x2 + s * s * s
    if (x < t) lo = s; else hi = s
  }
  const s = (lo + hi) / 2
  const o = 1 - s
  return 3 * o * o * s * y1 + 3 * o * s * s * y2 + s * s * s
}

export function curveBlend(t, curve, phase, cp1, cp2) {
  const bias = (phase - 0.5) * 2
  switch (curve) {
    case 'linear': return clamp(t + bias)
    case 'reverse': return clamp((1 - t) + bias)
    case 'ease': return clamp((t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) + bias)
    case 'expo-in': return clamp(Math.pow(t, 3) + bias)
    case 'expo-out': return clamp(1 - Math.pow(1 - t, 3) + bias)
    case 'log': return clamp(Math.log(1 + t * 9) / Math.log(10) + bias)
    case 'sine': return 0.5 + 0.5 * Math.sin((t + phase) * TAU)
    case 'custom': return clamp(cubicBezier(cp1.x, cp1.y, cp2.x, cp2.y, t) + bias)
    case 'flat':
    default: return phase
  }
}

export const CURVE_OPTIONS = [
  { value: 'flat', label: 'Flat — uniform blend' },
  { value: 'linear', label: 'Linear — A → B' },
  { value: 'reverse', label: 'Reverse — B → A' },
  { value: 'ease', label: 'Ease in-out (S-curve)' },
  { value: 'expo-in', label: 'Expo in (cubic)' },
  { value: 'expo-out', label: 'Expo out' },
  { value: 'log', label: 'Logarithmic' },
  { value: 'sine', label: 'Sine wave' },
]

export const MORPH_MODE_OPTIONS = [
  { value: 'morph', label: 'Morph paths' },
  { value: 'fade', label: 'Fade A↔B' },
  { value: 'random', label: 'Random / letter' },
]

// ── the build ────────────────────────────────────────────────────────────────
// cfg = { mode, blend, curve, cp1, cp2, coordsA, coordsB, axes:[{tag,min,max}], gap }
// Returns one entry per char: { ch, mode, advance, bbox, d?, dA?, dB?, bboxA?, bboxB?, opA?, opB? }
// + totalAdvance. Geometry only — caller positions + colours it.
export function buildMorphGlyphs(fontA, fontB, text, size, cfg) {
  const chars = Array.from(text).filter((ch) => ch !== '\n')
  const denom = Math.max(1, chars.length - 1)
  const { mode = 'morph', blend = 0.5, curve = 'flat' } = cfg
  const cp1 = cfg.cp1 || { x: 0.33, y: 0.33 }
  const cp2 = cfg.cp2 || { x: 0.66, y: 0.66 }
  const axes = cfg.axes || []
  const gap = cfg.gap != null ? cfg.gap : size * 0.12
  const rng = mode === 'random' ? mulberry32(Math.floor((blend || 0) * 100000) + 1) : null

  const glyphs = []
  let x = 0
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const t = i / denom
    const bl = curveBlend(t, curve, blend, cp1, cp2)

    if (mode === 'random') {
      // each letter gets its own random coords within the font's axes
      const coords = {}
      for (const a of axes) coords[a.tag] = Math.round(a.min + rng() * (a.max - a.min))
      const cmds = glyphCommands(fontA, ch, size, coords)
      const bbox = commandsBbox(cmds)
      const advance = advanceFromInk(ch, bbox, size, gap)
      glyphs.push({ ch, mode, d: commandsToPath(cmds), bbox, advance })
      x += advance
      continue
    }

    const cmdsA = glyphCommands(fontA, ch, size, cfg.coordsA)
    const cmdsB = glyphCommands(fontB, ch, size, cfg.coordsB)

    if (mode === 'fade') {
      const bboxA = commandsBbox(cmdsA)
      const bboxB = commandsBbox(cmdsB)
      // claim the wider of the two so neither layer clips its neighbour
      const advance = Math.max(advanceFromInk(ch, bboxA, size, gap), advanceFromInk(ch, bboxB, size, gap))
      glyphs.push({
        ch, mode,
        dA: commandsToPath(cmdsA), bboxA, opA: 1 - bl,
        dB: commandsToPath(cmdsB), bboxB, opB: bl,
        advance,
      })
      x += advance
      continue
    }

    // morph — lerp commands when topology matches, else pop to the closer cut
    let cmds
    if (commandsMatch(cmdsA, cmdsB)) {
      cmds = lerpCommands(cmdsA, cmdsB, bl)
    } else {
      cmds = bl < 0.5 ? cmdsA : cmdsB
    }
    cmds = Array.isArray(cmds) ? cmds : []
    const bbox = commandsBbox(cmds)
    const advance = advanceFromInk(ch, bbox, size, gap)
    glyphs.push({ ch, mode, d: commandsToPath(cmds), bbox, advance })
    x += advance
  }
  return { glyphs, totalAdvance: x }
}
