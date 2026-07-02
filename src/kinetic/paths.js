// Path presets → an SVG path `d` string in viewport (w×h) coordinates. The
// KineticType engine sets this on a `<path>` and walks it with getPointAtLength /
// getTotalLength to place glyphs. `closed` tells the engine a march/orbit can
// wrap seamlessly (no visible jump at the ends).
//
// Ported from kol-labs-single src/pages/kinetic/engine/paths.js (Phase 10).
// UI-only exports (PATH_OPTIONS, isPlaced) dropped — the editor picks presets,
// not arrangements.

const TAU = Math.PI * 2
const r2 = (n) => Math.round(n * 100) / 100

function polyline(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(p[0])} ${r2(p[1])}`).join(' ')
}

// Default control points (normalized 0..1) for the custom path — a gentle S.
export const DEFAULT_POINTS = [[0.12, 0.55], [0.37, 0.32], [0.63, 0.68], [0.88, 0.45]]

// Smooth open curve through normalized control points (Catmull-Rom → cubic bézier).
function catmullRom(points, w, h) {
  const P = points.map(([x, y]) => [x * w, y * h])
  if (P.length < 2) return `M ${r2(w / 2)} ${r2(h / 2)} L ${r2(w / 2 + 1)} ${r2(h / 2)}`
  let d = `M ${r2(P[0][0])} ${r2(P[0][1])}`
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i]
    const p1 = P[i]
    const p2 = P[i + 1]
    const p3 = P[i + 2] || P[i + 1]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d
}

// Engine-placed (no SVG path) arrangements — glyphs are positioned directly.
export const isArray = (type) => type === 'array'
export const isRadial = (type) => type === 'radial'
export const isRings = (type) => type === 'rings'

export const PATH_DEFAULTS = { amp: 0.4, freq: 2, turns: 3, radius: 0.72, rows: 2, cols: 3, count: 12, inner: 0.12, spin: 1, twist: 0.5, grow: 0.6 }

// → { d, closed }
export function buildPath(type, w, h, p = {}) {
  const cx = w / 2
  const cy = h / 2
  const m = Math.min(w, h) * 0.12
  const amp = p.amp ?? PATH_DEFAULTS.amp
  const freq = Math.max(1, Math.round(p.freq ?? PATH_DEFAULTS.freq))
  const turns = Math.max(1, Math.round(p.turns ?? PATH_DEFAULTS.turns))
  const radius = p.radius ?? PATH_DEFAULTS.radius

  switch (type) {
    case 'arc': {
      const y0 = h * 0.62
      const ctrlY = y0 - amp * h * 0.7
      return { d: `M ${r2(m)} ${r2(y0)} Q ${r2(cx)} ${r2(ctrlY)} ${r2(w - m)} ${r2(y0)}`, closed: false }
    }
    case 'circle': {
      const rad = Math.min(w, h) * 0.5 * radius
      return { d: `M ${r2(cx - rad)} ${r2(cy)} A ${r2(rad)} ${r2(rad)} 0 1 1 ${r2(cx + rad)} ${r2(cy)} A ${r2(rad)} ${r2(rad)} 0 1 1 ${r2(cx - rad)} ${r2(cy)} Z`, closed: true }
    }
    case 'ellipse': {
      const rx = (w * 0.5 - m) * radius
      const ry = (h * 0.5 - m) * radius
      return { d: `M ${r2(cx - rx)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 1 ${r2(cx + rx)} ${r2(cy)} A ${r2(rx)} ${r2(ry)} 0 1 1 ${r2(cx - rx)} ${r2(cy)} Z`, closed: true }
    }
    case 'sine': {
      const N = 120
      const pts = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        pts.push([m + t * (w - 2 * m), cy + amp * h * 0.32 * Math.sin(t * freq * TAU)])
      }
      return { d: polyline(pts), closed: false }
    }
    case 'spiral': {
      const N = 420
      const maxR = Math.min(w, h) * 0.45 * radius
      const pts = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const th = t * turns * TAU
        const rad = t * maxR
        pts.push([cx + Math.cos(th) * rad, cy + Math.sin(th) * rad])
      }
      return { d: polyline(pts), closed: false }
    }
    case 'zigzag': {
      const n = freq * 2
      const pts = []
      for (let i = 0; i <= n; i++) {
        const t = i / n
        pts.push([m + t * (w - 2 * m), cy + (i % 2 === 0 ? -1 : 1) * amp * h * 0.28])
      }
      return { d: polyline(pts), closed: false }
    }
    case 'custom': {
      const pts = Array.isArray(p.points) && p.points.length >= 2 ? p.points : DEFAULT_POINTS
      return { d: catmullRom(pts, w, h), closed: false }
    }
    case 'line':
    default: {
      // optional vertical offset (−0.5..0.5 of height) so stacked line instances
      // don't all collapse onto the centre.
      const oy = cy + (p.offset || 0) * h
      return { d: `M ${r2(m)} ${r2(oy)} L ${r2(w - m)} ${r2(oy)}`, closed: false }
    }
  }
}
