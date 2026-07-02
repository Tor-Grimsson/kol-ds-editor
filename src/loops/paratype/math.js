/* Glyph geometry utilities (ported from kol-labs-single para-type/lab/math.js —
 * the subset the classic/skeleton engines consume; the perlin noise + seeded
 * RNG used only by the page-level FX pipeline stayed behind). Pure,
 * framework-free. */

export const lerp = (a, b, t) => a + (b - a) * t
export const TAU = Math.PI * 2

/* Cardinal / Catmull-Rom spline through a list of 2D points. Returns an SVG
 * path string. `tension` in [0,1]; 0 = uniform Catmull-Rom. Open polyline. */
export function catmullRomPath(points, tension = 0.5) {
  if (points.length < 2) return ''
  const k = (1 - tension) / 6
  const cmd = [`M ${points[0][0]} ${points[0][1]}`]
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    cmd.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`)
  }
  return cmd.join(' ')
}

/* Same but closed (last point connects back to first). */
export function catmullRomClosedPath(points, tension = 0.5) {
  if (points.length < 3) return catmullRomPath(points, tension)
  const k = (1 - tension) / 6
  const n = points.length
  const cmd = [`M ${points[0][0]} ${points[0][1]}`]
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) * k
    const c1y = p1[1] + (p2[1] - p0[1]) * k
    const c2x = p2[0] - (p3[0] - p1[0]) * k
    const c2y = p2[1] - (p3[1] - p1[1]) * k
    cmd.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`)
  }
  cmd.push('Z')
  return cmd.join(' ')
}

/* Superellipse boundary points: |x/a|^n + |y/b|^n = 1.
 * n=2 → ellipse; n→∞ → rectangle; n<1 → astroid-like (pinched).
 * Returns count points evenly around the boundary. */
export function superellipse(cx, cy, a, b, n = 2, count = 64) {
  const pts = []
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * TAU
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    const x = cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * a
    const y = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * b
    pts.push([x, y])
  }
  return pts
}

/* Sample a polyline at evenly-spaced arc lengths. */
export function resampleEven(points, count) {
  if (points.length < 2 || count < 2) return points.slice()
  const lens = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    lens.push(lens[i - 1] + Math.hypot(dx, dy))
  }
  const total = lens[lens.length - 1]
  if (total === 0) return points.slice()
  const out = []
  let j = 1
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total
    while (j < lens.length - 1 && lens[j] < target) j++
    const t = (target - lens[j - 1]) / (lens[j] - lens[j - 1] || 1)
    out.push([
      lerp(points[j - 1][0], points[j][0], t),
      lerp(points[j - 1][1], points[j][1], t),
    ])
  }
  return out
}

/* Normal at index i of a polyline (perpendicular unit vector). */
export function normalAt(points, i) {
  const n = points.length
  const a = points[(i - 1 + n) % n]
  const b = points[(i + 1) % n]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}
