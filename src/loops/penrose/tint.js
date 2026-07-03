// Palette tint — makes the editor theme actually reach the letterform.
// Ported verbatim from kol-labs-single src/pages/penrose/tint.js (OPACITY now
// comes from ./palette.js).
//
// Most prototypes draw with bespoke hardcoded hues (cool lavender structure +
// warm peach highlights + near-bg fade trails) and never read the palette.
// Rather than rewrite ~100 files, we wrap the canvas 2D context handed to
// each prototype: every strokeStyle/fillStyle the prototype sets is remapped
// onto the active palette by ROLE, so the authored composition (bg / dim /
// accent / fg / warm tonal structure) survives but is re-tinted.
//
// CanvasGradient/Pattern objects and unparseable strings pass through untouched.
// Pixel-field prototypes (CA / reaction-diffusion / fractals) write raw
// ImageData via their own buffers and bypass this entirely; they recolour via
// rampRGB/roleRGB in common.js.

import { OPACITY } from './palette.js'

// Parse a CSS colour string → [r, g, b, a] (0–255, 0–1) or null if unparseable.
const NAMED = { white: [255, 255, 255], black: [0, 0, 0] }
export function parseColor(v) {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  if (NAMED[s]) return [...NAMED[s], 1]
  // #rgb / #rgba / #rrggbb / #rrggbbaa
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    const h = m[1]
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]
    if (h.length === 4) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16) / 255]
    if (h.length === 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
    if (h.length === 8) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255]
    return null
  }
  // rgb()/rgba()
  m = /^rgba?\(([^)]+)\)$/.exec(s)
  if (m) {
    const p = m[1].split(',').map((x) => x.trim())
    if (p.length < 3) return null
    return [Math.round(parseFloat(p[0])), Math.round(parseFloat(p[1])), Math.round(parseFloat(p[2])), p[3] != null ? parseFloat(p[3]) : 1]
  }
  return null
}

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b

// Build a colour mapper from a palette of hex stops. Classifies each authored
// colour by temperature + luminance and returns the matching palette stop,
// preserving the original alpha. Stops are parsed once.
export function makeMapper(palette) {
  const stop = (hex) => parseColor(hex) || [255, 255, 255, 1]
  const bg = stop(palette.bg)
  const fg = stop(palette.fg)
  const accent = stop(palette.accent)
  const dim = stop(palette.dim)
  const warm = stop(palette.warm)
  const out = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${Math.min(1, a)})`
  // The background fill (clear) and fade-trails must always read as bg, never get
  // luminance-bucketed into dim — otherwise the whole canvas clears to the wrong
  // colour and floods the frame. Match the palette bg directly (clear() passes it
  // verbatim) before any luminance classification.
  const nearBg = (r, g, b) => Math.abs(r - bg[0]) <= 10 && Math.abs(g - bg[1]) <= 10 && Math.abs(b - bg[2]) <= 10
  // A prototype that already pulls its colours from the palette (via pc()) has
  // placed them deliberately — pass those through verbatim so the luminance remap
  // never second-guesses an intentional role (e.g. a bright accent → fg).
  const stops = [fg, accent, dim, warm]
  const isStop = (r, g, b) => stops.some((s) => Math.abs(r - s[0]) <= 6 && Math.abs(g - s[1]) <= 6 && Math.abs(b - s[2]) <= 6)
  return (value) => {
    const c = parseColor(value)
    if (!c) return value // gradient / pattern / unparseable → leave it
    const [r, g, b, a] = c
    if (nearBg(r, g, b)) return out(bg, a) // the bg fill / clear → bg, whatever its luminance
    if (isStop(r, g, b)) return value // explicit palette role (pc()) → leave it exactly
    const L = lum(r, g, b)
    if (L < 24) return out(bg, a) // very dark authored ink trails → the new bg
    // map to a role + scale by that role's live opacity multiplier
    if (r - b > 14) return out(warm, a * (OPACITY.warm ?? 1)) // warm highlight → warm
    if (L >= 200) return out(fg, a * (OPACITY.fg ?? 1)) // bright cool structure → fg
    if (L >= 120) return out(accent, a * (OPACITY.accent ?? 1)) // mid cool → accent
    return out(dim, a * (OPACITY.dim ?? 1)) // dark cool → dim
  }
}

// Wrap a 2D context so strokeStyle/fillStyle sets pass through the mapper. Method
// calls are bound to the real context; all other props read/write straight
// through. Used at proto.init so the prototype's own draw calls get re-tinted.
export function tintedContext(ctx, mapColor) {
  return new Proxy(ctx, {
    get(t, prop) {
      const v = t[prop]
      return typeof v === 'function' ? v.bind(t) : v
    },
    set(t, prop, value) {
      t[prop] = (prop === 'fillStyle' || prop === 'strokeStyle') ? mapColor(value) : value
      return true
    },
  })
}
