/* Skeleton engine — LeonSans / METAFONT-style.
 *
 * Each glyph is described as one or more "strokes": a centerline (polyline)
 * plus a thickness profile. The renderer offsets the centerline by half the
 * thickness in both directions, joins ends, and emits an SVG path.
 *
 * Compared to the classic engine, this surfaces:
 *  - Per-stroke variable thickness along arc length.
 *  - Superness on bowls via superellipse centerlines.
 *  - Smooth, continuous outlines (Catmull-Rom on offset polylines). */

import {
  superellipse,
  resampleEven,
  normalAt,
  catmullRomPath,
  catmullRomClosedPath,
  TAU,
} from './math.js'

/* Offset a centerline by ±halfThick to produce a closed outline. */
function strokeOutline(centerline, halfThickFn, segments = 80) {
  const pts = resampleEven(centerline, segments)
  const left = []
  const right = []
  for (let i = 0; i < pts.length; i++) {
    const [nx, ny] = normalAt(pts, i)
    const h = halfThickFn(i / (pts.length - 1))
    left.push([pts[i][0] + nx * h, pts[i][1] + ny * h])
    right.push([pts[i][0] - nx * h, pts[i][1] - ny * h])
  }
  const outline = [...left, ...right.reverse()]
  return catmullRomClosedPath(outline, 0)
}

/* Build a closed superellipse bowl as a hollow ring: outer ellipse minus
 * inner ellipse, with stroke width varying around the perimeter. */
function bowlRing(cx, cy, rx, ry, sideThick, topThick, superness, segments = 80) {
  const n = 2 * Math.max(0.1, superness) * 2
  const outer = superellipse(cx, cy, rx, ry, n, segments)
  const innerRx = Math.max(1, rx - sideThick)
  const innerRy = Math.max(1, ry - topThick)
  const inner = superellipse(cx, cy, innerRx, innerRy, n, segments).reverse()
  return catmullRomClosedPath(outer, 0) + ' ' + catmullRomClosedPath(inner, 0)
}

const constThick = (h) => () => h / 2

export const skeleton = {
  o: (p) => {
    const w = p.oWidth
    const h = p.xHeight + 2 * p.overshoot
    return { width: w, paths: [{
      d: bowlRing(w / 2, p.xHeight / 2, w / 2, h / 2, p.stemWidth, Math.max(0.5, p.hairWidth ?? p.stemWidth * (1 - p.contrast)), p.superness ?? 0.5, Math.max(24, p.segments | 0 || 80)),
      part: 'bowl', fillRule: 'evenodd',
    }]}
  },
  l: (p) => {
    const half = p.stemWidth / 2
    return { width: p.stemWidth, paths: [{
      d: strokeOutline(
        [[half, 0], [half, p.ascender]],
        constThick(p.stemWidth),
        2,
      ),
      part: 'stem',
    }]}
  },
  i: (p) => {
    const half = p.stemWidth / 2
    const dotY = p.xHeight + p.stemWidth * 0.8
    const dotR = p.stemWidth * 0.55
    return { width: p.stemWidth, paths: [
      { d: strokeOutline([[half, 0], [half, p.xHeight]], constThick(p.stemWidth), 2), part: 'stem' },
      { d: `M ${half - dotR} ${dotY} a ${dotR} ${dotR} 0 1 0 ${2*dotR} 0 a ${dotR} ${dotR} 0 1 0 ${-2*dotR} 0 Z`, part: 'tittle' },
    ]}
  },
  d: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    return { width: w, paths: [
      { d: bowlRing(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, s, Math.max(0.5, p.hairWidth ?? s*(1-p.contrast)), p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: strokeOutline([[w - s/2, 0], [w - s/2, p.ascender]], constThick(s), 2), part: 'stem' },
    ]}
  },
  b: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    return { width: w, paths: [
      { d: bowlRing(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, s, Math.max(0.5, p.hairWidth ?? s*(1-p.contrast)), p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: strokeOutline([[s/2, 0], [s/2, p.ascender]], constThick(s), 2), part: 'stem' },
    ]}
  },
  p: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    return { width: w, paths: [
      { d: bowlRing(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, s, Math.max(0.5, p.hairWidth ?? s*(1-p.contrast)), p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: strokeOutline([[s/2, -p.descender], [s/2, p.xHeight]], constThick(s), 2), part: 'stem' },
    ]}
  },
  q: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    return { width: w, paths: [
      { d: bowlRing(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, s, Math.max(0.5, p.hairWidth ?? s*(1-p.contrast)), p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: strokeOutline([[w - s/2, -p.descender], [w - s/2, p.xHeight]], constThick(s), 2), part: 'stem' },
    ]}
  },
  c: (p) => {
    const w = p.oWidth
    const h = p.xHeight + 2 * p.overshoot
    const cx = w / 2, cy = p.xHeight / 2
    const rx = w / 2, ry = h / 2
    const apertureSafe = Math.min(0.985, Math.max(0, p.aperture))
    const gap = Math.max(0.04, (1 - apertureSafe) * Math.PI)
    const segments = Math.max(24, p.segments | 0 || 64)
    /* Sample superellipse arc skipping [-gap/2, gap/2] on the right side. */
    const n = 2 * Math.max(0.1, p.superness ?? 0.5) * 2
    const pts = []
    const span = TAU - gap
    for (let i = 0; i <= segments; i++) {
      const theta = (gap / 2) + (i / segments) * span
      const co = Math.cos(theta), si = Math.sin(theta)
      pts.push([
        cx + Math.sign(co) * Math.pow(Math.abs(co), 2 / n) * rx,
        cy + Math.sign(si) * Math.pow(Math.abs(si), 2 / n) * ry,
      ])
    }
    return { width: w, paths: [{
      d: strokeOutline(pts, constThick(p.stemWidth), segments),
      part: 'bowl',
    }]}
  },
  e: (p) => {
    const cParts = skeleton.c(p)
    const crossY = p.xHeight * 0.52
    const crossH = (p.hairWidth ?? p.stemWidth * (1 - p.contrast * 0.4))
    const left = p.stemWidth * 0.6
    const right = p.oWidth - p.stemWidth * 0.6
    return { width: p.oWidth, paths: [
      ...cParts.paths,
      { d: strokeOutline([[left, crossY], [right, crossY]], constThick(crossH), 2), part: 'crossbar' },
    ]}
  },
  n: (p) => {
    const w = p.oWidth, s = p.stemWidth, h = p.xHeight
    const drop = h * p.shoulder
    const archY = h * p.archHeight + p.overshoot * 0.5
    /* Skeleton: left stem up, shoulder curve, right stem down. */
    const center = [
      [s/2, 0],
      [s/2, h * 0.7],
    ]
    const arch = []
    const steps = 24
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      /* Quadratic bezier-ish: P(t) = (1-t)²·A + 2(1-t)t·C + t²·B */
      const ax = s/2, ay = h * 0.7
      const cx = w / 2, cy = archY
      const bx = w - s/2, by = h - drop
      const x = (1-tt)*(1-tt)*ax + 2*(1-tt)*tt*cx + tt*tt*bx
      const y = (1-tt)*(1-tt)*ay + 2*(1-tt)*tt*cy + tt*tt*by
      arch.push([x, y])
    }
    const right = [[w - s/2, h - drop], [w - s/2, 0]]
    const full = [...center, ...arch, ...right]
    return { width: w, paths: [{
      d: strokeOutline(full, constThick(s), 80),
      part: 'arch',
    }]}
  },
  m: (p) => {
    const w = p.oWidth * 1.55, s = p.stemWidth, h = p.xHeight
    const half = w / 2
    const drop = h * p.shoulder
    const archY = h * p.archHeight + p.overshoot * 0.5
    /* Build M as one continuous skeleton: left stem up, arch 1, mid stem,
     * arch 2, right stem down. */
    const stroke = []
    stroke.push([s/2, 0])
    stroke.push([s/2, h * 0.7])
    const steps = 20
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const x = (1-tt)*(1-tt)*(s/2) + 2*(1-tt)*tt*(half/2) + tt*tt*(half)
      const y = (1-tt)*(1-tt)*(h*0.7) + 2*(1-tt)*tt*archY + tt*tt*(h - drop)
      stroke.push([x, y])
    }
    stroke.push([half, h * 0.7])
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const x = (1-tt)*(1-tt)*(half) + 2*(1-tt)*tt*(half + half/2) + tt*tt*(w - s/2)
      const y = (1-tt)*(1-tt)*(h*0.7) + 2*(1-tt)*tt*archY + tt*tt*(h - drop)
      stroke.push([x, y])
    }
    stroke.push([w - s/2, 0])
    return { width: w, paths: [{
      d: strokeOutline(stroke, constThick(s), 120),
      part: 'arch',
    }]}
  },
  h: (p) => {
    const w = p.oWidth, s = p.stemWidth, h = p.xHeight, a = p.ascender
    const drop = h * p.shoulder
    const archY = h * p.archHeight + p.overshoot * 0.5
    const stroke = []
    stroke.push([s/2, 0])
    stroke.push([s/2, a])
    stroke.push([s/2, h * 0.7])
    const steps = 24
    for (let i = 0; i <= steps; i++) {
      const tt = i / steps
      const x = (1-tt)*(1-tt)*(s/2) + 2*(1-tt)*tt*(w/2) + tt*tt*(w - s/2)
      const y = (1-tt)*(1-tt)*(h*0.7) + 2*(1-tt)*tt*archY + tt*tt*(h - drop)
      stroke.push([x, y])
    }
    stroke.push([w - s/2, 0])
    return { width: w, paths: [{
      d: strokeOutline(stroke, constThick(s), 80),
      part: 'arch',
    }]}
  },
  t: (p) => {
    const s = p.stemWidth, h = p.xHeight
    const crossW = s * 2.8
    const crossY = h * 0.92
    const stemTop = h * 1.18
    const cx = crossW / 2
    return { width: crossW, paths: [
      { d: strokeOutline([[cx, 0], [cx, stemTop]], constThick(s), 2), part: 'stem' },
      { d: strokeOutline([[0, crossY], [crossW, crossY]], constThick(s * 0.7), 2), part: 'crossbar' },
    ]}
  },
}
