// Per-glyph animation — pure functions of u∈[0,1]. Each returns deltas the engine
// layers onto a glyph's base placement on the path:
//   { dLen, dNormal, scale, dRot, opacity, vf }
//   dLen     extra arc-length along the path (march/orbit)
//   dNormal  offset perpendicular to the path (px)
//   scale    multiplier · dRot  extra rotation (deg) · opacity 0..1
//   vf       per-glyph variable-axis overrides, e.g. { wght: 720 }
// All u-dependence is via `u·TAU·cycles` with integer cycles ⇒ frame(0)≡frame(1).
//
// Ported from kol-labs-single src/pages/kinetic/engine/animations.js (Phase 10).
// UI option lists (MOTION_OPTIONS, FIELD_OPTIONS, SWEEP_MODES) dropped.

const TAU = Math.PI * 2
const lerp = (a, b, t) => a + (b - a) * t
const IDENTITY = { dLen: 0, dNormal: 0, scale: 1, dRot: 0, opacity: 1, vf: null }

// c = { i, n, u, m (motion params), sizePx, pathLen, axisTag, axisMin, axisMax }
const MOTIONS = {
  none: () => IDENTITY,

  // Text scrolls along the path. Seamless on closed paths (wraps cleanly).
  march: (c) => ({ ...IDENTITY, dLen: c.u * c.pathLen * Math.max(1, Math.round(c.m.cycles || 1)) }),

  // Text rides a closed path once (or N times) per loop.
  orbit: (c) => ({ ...IDENTITY, dLen: c.u * c.pathLen * Math.max(1, Math.round(c.m.cycles || 1)) }),

  // A variable-axis pulse travels through the word — the headline VF effect.
  vfwave: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const k = 0.5 + 0.5 * Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.5))
    return { ...IDENTITY, vf: { [c.axisTag]: lerp(c.axisMin, c.axisMax, k) } }
  },

  // Each glyph rides a travelling sine perpendicular to the path (flag/ripple).
  glyphwave: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const sw = Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.5))
    return { ...IDENTITY, dNormal: (c.m.amp ?? 0.3) * c.sizePx * sw }
  },

  // Scale/opacity reveal phased by glyph index (cascade in & out per loop).
  cascade: (c) => {
    const cyc = Math.max(1, Math.round(c.m.cycles || 1))
    const k = 0.5 + 0.5 * Math.sin(c.u * TAU * cyc - c.i * (c.m.phase ?? 0.6))
    return { ...IDENTITY, scale: lerp(0.25, 1, k), opacity: lerp(0.15, 1, k) }
  },

  // ── Field sweeps — a moving wavefront crosses the frame; each glyph reads
  // the field at its OWN position (nx,ny) so the animation sweeps spatially. ──
  sweep:       (c) => { const v = sweepAt(c); return { ...IDENTITY, scale: lerp(0.25, 1, v), opacity: lerp(0.12, 1, v) } },
  sweepWeight: (c) => { const v = sweepAt(c); return { ...IDENTITY, vf: { [c.axisTag]: lerp(c.axisMin, c.axisMax, v) } } },
  sweepShift:  (c) => { const v = sweepAt(c); return { ...IDENTITY, dNormal: v * 0.6 * c.sizePx } },
}

// ── sweep field ──
const wrap01 = (x) => x - Math.floor(x)
// raised falloff: 1 at the band centre → 0 at half-width w
function band(dist, w) {
  if (w <= 0) return 0
  const t = Math.min(1, dist / w)
  return 1 - t * t * (3 - 2 * t)
}
// scalar field 0..1 at normalized (nx,ny) for a wavefront looping over u.
function sweepField(field, nx, ny, u, cyc, width) {
  const pos = wrap01(u * cyc)
  const halfW = Math.max(0.02, width * 0.5)
  const bandAt = (v) => { const d = Math.abs(wrap01(v) - pos); return band(Math.min(d, 1 - d), halfW) }
  switch (field) {
    case 'y': return bandAt(ny)
    case 'diagonal': return bandAt(0.5 + (nx - 0.5) * 0.7071 + (ny - 0.5) * 0.7071)
    case 'radial': return bandAt(Math.hypot(nx - 0.5, ny - 0.5) / 0.7071)
    case 'angular': return bandAt(Math.atan2(ny - 0.5, nx - 0.5) / TAU + 0.5)
    case 'wave': { const freq = Math.max(1, Math.round(1 + (1 - width) * 6)); return 0.5 + 0.5 * Math.sin((nx * freq - u * cyc) * TAU) }
    case 'x':
    default: return bandAt(nx)
  }
}
const sweepAt = (c) => sweepField(c.m.field || 'x', c.nx ?? 0.5, c.ny ?? 0.5, c.u, Math.max(1, Math.round(c.m.cycles || 1)), c.m.amp ?? 0.35)

export function glyphAnim(mode, c) {
  return (MOTIONS[mode] || MOTIONS.none)(c)
}
