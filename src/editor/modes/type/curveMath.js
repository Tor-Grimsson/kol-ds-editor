/**
 * Shared curve math for the morph-blend distribution. Used by MorphedText
 * (live render), buildTypeSvg (export), and CurveOverlay (visualizer).
 *
 * Curves return a blend in [0..1] given a position `t` in [0..1] across the
 * text. `phase` is the slider — for 'flat' it IS the blend; for non-flat
 * preset curves it shifts the curve through the text. For 'custom' we use a
 * cubic-bezier defined by two control points (CSS animation timing model).
 */

import { TAU } from '../../../loops/lib/util.js'

// generalized (lo, hi) clamp — deliberately not lib/util's fixed clamp01
export const clamp = (v, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v

/**
 * CSS-style cubic-bezier easing. Given control points (x1, y1) and (x2, y2)
 * in [0..1], find the parameter s such that the bezier's x(s) ≈ t, then
 * return y(s). 30 bisection iterations is plenty for sub-pixel precision.
 */
function cubicBezier(x1, y1, x2, y2, t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0, hi = 1
  for (let i = 0; i < 30; i++) {
    const s = (lo + hi) / 2
    const oneMs = 1 - s
    const x = 3 * oneMs * oneMs * s * x1 + 3 * oneMs * s * s * x2 + s * s * s
    if (x < t) lo = s
    else       hi = s
  }
  const s = (lo + hi) / 2
  const oneMs = 1 - s
  return 3 * oneMs * oneMs * s * y1 + 3 * oneMs * s * s * y2 + s * s * s
}

export function curveBlend(t, curve, phase, cp1, cp2) {
  /* Output bias: phase shifts the whole curve up/down so 0 = all A, 1 = all B,
   * 0.5 = pure curve. Same pattern as linear/reverse. */
  const bias = (phase - 0.5) * 2
  switch (curve) {
    case 'linear':    return clamp(t + bias)
    case 'reverse':   return clamp((1 - t) + bias)
    case 'ease':      return clamp((t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) + bias)
    case 'expo-in':   return clamp(Math.pow(t, 3) + bias)
    case 'expo-out':  return clamp(1 - Math.pow(1 - t, 3) + bias)
    case 'log':       return clamp(Math.log(1 + t * 9) / Math.log(10) + bias)
    case 'sine':      return 0.5 + 0.5 * Math.sin((t + phase) * TAU)
    case 'custom':    return clamp(cubicBezier(cp1.x, cp1.y, cp2.x, cp2.y, t) + bias)
    case 'flat':
    default:          return phase
  }
}

export const CURVE_OPTIONS = [
  { value: 'flat',     label: 'Flat — uniform blend' },
  { value: 'linear',   label: 'Linear — A → B' },
  { value: 'reverse',  label: 'Reverse — B → A' },
  { value: 'ease',     label: 'Ease in-out (S-curve)' },
  { value: 'expo-in',  label: 'Expo in (cubic)' },
  { value: 'expo-out', label: 'Expo out' },
  { value: 'log',      label: 'Logarithmic' },
  { value: 'sine',     label: 'Sine wave' },
  { value: 'custom',   label: 'Custom — drag on canvas' },
]
