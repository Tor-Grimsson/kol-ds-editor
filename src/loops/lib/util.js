// Small math/color helpers shared by loop definitions. Kept dependency-free so
// loop modules stay cheap to import (the registry pulls them eagerly).

export const TAU = Math.PI * 2

export const clamp01 = (x) => Math.max(0, Math.min(1, x))
export const lerp = (a, b, t) => a + (b - a) * t

const hx = (s) => parseInt(s, 16)

// '#rgb' or '#rrggbb' → [r, g, b] (0–255). Anything unparseable → black.
export function hexToRgb(hex) {
  const s = String(hex || '').replace('#', '')
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  if (f.length < 6) return [0, 0, 0]
  return [hx(f.slice(0, 2)), hx(f.slice(2, 4)), hx(f.slice(4, 6))]
}

// Linear hex→hex mix → an `rgb(…)` string (valid as a canvas fillStyle).
export function mixHex(a, b, t) {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const r = Math.round(lerp(A[0], B[0], t))
  const g = Math.round(lerp(A[1], B[1], t))
  const bl = Math.round(lerp(A[2], B[2], t))
  return `rgb(${r}, ${g}, ${bl})`
}
