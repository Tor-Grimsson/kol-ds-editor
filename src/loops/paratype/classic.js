/* Classic engine — the original v0.01 glyph renderers, extended with
 * `superness` (superellipse exponent on bowls) and `hairWidth` (explicit
 * horizontal thin stroke; previously derived from contrast * stemWidth).
 *
 * Each renderer returns { width, paths: [{ d, part, fillRule? }] }. */

import { superellipse, catmullRomClosedPath } from './math.js'

/* Bowl shape: outer + inner superellipse contour subtraction.
 * When superness ≈ 0.5, output is ~circular (matches earlier behavior).
 * superness < 0.5 → astroid-like; > 1 → squarish. */
function bowlShape(cx, cy, rx, ry, sideThick, topThick, superness = 0.5, segments = 64) {
  const innerRx = Math.max(0.5, rx - sideThick)
  const innerRy = Math.max(0.5, ry - topThick)
  /* Map superness slider [0.1..1.5] → superellipse n exponent [0.6..6]. */
  const n = 2 * Math.max(0.1, superness) * 2
  const outer = superellipse(cx, cy, rx, ry, n, segments)
  const inner = superellipse(cx, cy, innerRx, innerRy, n, segments).reverse()
  const outerPath = catmullRomClosedPath(outer, 0)
  const innerPath = catmullRomClosedPath(inner, 0)
  return outerPath + ' ' + innerPath
}

function serifFoot(x, w, depth, jut = 0) {
  if (depth <= 0) return ''
  const ext = Math.max(2, w * 0.7) * depth + jut * w * 1.5
  const h = Math.max(1, depth * 5)
  return `M ${x - ext} 0 L ${x + w + ext} 0 L ${x + w + ext} ${h} L ${x - ext} ${h} Z`
}

export const classic = {
  o: (p) => {
    const w = p.oWidth
    const h = p.xHeight + 2 * p.overshoot
    const sideThick = p.stemWidth
    const topThick = Math.max(0.5, p.hairWidth ?? p.stemWidth * (1 - p.contrast))
    return { width: w, paths: [{
      d: bowlShape(w / 2, p.xHeight / 2, w / 2, h / 2, sideThick, topThick, p.superness ?? 0.5, Math.max(12, p.segments | 0 || 64)),
      part: 'bowl', fillRule: 'evenodd',
    }]}
  },
  l: (p) => ({
    width: p.stemWidth,
    paths: [
      { d: `M 0 0 L ${p.stemWidth} 0 L ${p.stemWidth} ${p.ascender} L 0 ${p.ascender} Z`, part: 'stem' },
      ...(p.serif > 0 ? [{ d: serifFoot(0, p.stemWidth, p.serif, p.jut ?? 0), part: 'serif' }] : []),
    ],
  }),
  i: (p) => {
    const dotY = p.xHeight + p.stemWidth * 0.8
    const dotR = p.stemWidth * 0.55
    return { width: p.stemWidth, paths: [
      { d: `M 0 0 L ${p.stemWidth} 0 L ${p.stemWidth} ${p.xHeight} L 0 ${p.xHeight} Z`, part: 'stem' },
      { d: `M ${p.stemWidth/2 - dotR} ${dotY} a ${dotR} ${dotR} 0 1 0 ${2*dotR} 0 a ${dotR} ${dotR} 0 1 0 ${-2*dotR} 0 Z`, part: 'tittle' },
      ...(p.serif > 0 ? [{ d: serifFoot(0, p.stemWidth, p.serif, p.jut ?? 0), part: 'serif' }] : []),
    ]}
  },
  d: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    const side = s, top = Math.max(0.5, p.hairWidth ?? s * (1 - p.contrast))
    return { width: w, paths: [
      { d: bowlShape(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, side, top, p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: `M ${w - s} 0 L ${w} 0 L ${w} ${p.ascender} L ${w - s} ${p.ascender} Z`, part: 'stem' },
      ...(p.serif > 0 ? [{ d: serifFoot(w - s, s, p.serif, p.jut ?? 0), part: 'serif' }] : []),
    ]}
  },
  b: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    const side = s, top = Math.max(0.5, p.hairWidth ?? s * (1 - p.contrast))
    return { width: w, paths: [
      { d: bowlShape(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, side, top, p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: `M 0 0 L ${s} 0 L ${s} ${p.ascender} L 0 ${p.ascender} Z`, part: 'stem' },
      ...(p.serif > 0 ? [{ d: serifFoot(0, s, p.serif, p.jut ?? 0), part: 'serif' }] : []),
    ]}
  },
  p: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    const side = s, top = Math.max(0.5, p.hairWidth ?? s * (1 - p.contrast))
    return { width: w, paths: [
      { d: bowlShape(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, side, top, p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: `M 0 ${-p.descender} L ${s} ${-p.descender} L ${s} ${p.xHeight} L 0 ${p.xHeight} Z`, part: 'stem' },
    ]}
  },
  q: (p) => {
    const w = p.bowlWidth, s = p.stemWidth
    const side = s, top = Math.max(0.5, p.hairWidth ?? s * (1 - p.contrast))
    return { width: w, paths: [
      { d: bowlShape(w/2, p.xHeight/2, w/2, (p.xHeight + 2*p.overshoot)/2, side, top, p.superness ?? 0.5), part: 'bowl', fillRule: 'evenodd' },
      { d: `M ${w - s} ${-p.descender} L ${w} ${-p.descender} L ${w} ${p.xHeight} L ${w - s} ${p.xHeight} Z`, part: 'stem' },
    ]}
  },
  c: (p) => {
    const w = p.oWidth
    const h = p.xHeight + 2*p.overshoot
    const cx = w/2, cy = p.xHeight/2
    const rx = w/2, ry = h/2
    const sideThick = p.stemWidth
    const topThick = Math.max(0.5, p.hairWidth ?? p.stemWidth * (1 - p.contrast))
    const innerRx = Math.max(0.5, rx - sideThick)
    const innerRy = Math.max(0.5, ry - topThick)
    const apertureSafe = Math.min(0.985, Math.max(0, p.aperture))
    const gap = Math.max(0.04, (1 - apertureSafe) * Math.PI)
    const a1 = -gap/2, a2 = gap/2
    const oS = [cx + rx*Math.cos(a2), cy + ry*Math.sin(a2)]
    const oE = [cx + rx*Math.cos(a1), cy + ry*Math.sin(a1)]
    const iS = [cx + innerRx*Math.cos(a2), cy + innerRy*Math.sin(a2)]
    const iE = [cx + innerRx*Math.cos(a1), cy + innerRy*Math.sin(a1)]
    const largeArc = (2*Math.PI - gap) > Math.PI ? 1 : 0
    return { width: w, paths: [{
      d: `M ${oS[0]} ${oS[1]} A ${rx} ${ry} 0 ${largeArc} 0 ${oE[0]} ${oE[1]} L ${iE[0]} ${iE[1]} A ${innerRx} ${innerRy} 0 ${largeArc} 1 ${iS[0]} ${iS[1]} Z`,
      part: 'bowl',
    }]}
  },
  e: (p) => {
    const c = classic.c(p)
    const crossY = p.xHeight * 0.52
    const crossH = (p.hairWidth ?? p.stemWidth * (1 - p.contrast * 0.4))
    const left = p.stemWidth * 0.5
    const right = p.oWidth - p.stemWidth * 0.5
    return { width: p.oWidth, paths: [
      ...c.paths,
      { d: `M ${left} ${crossY - crossH/2} L ${right} ${crossY - crossH/2} L ${right} ${crossY + crossH/2} L ${left} ${crossY + crossH/2} Z`, part: 'crossbar' },
    ]}
  },
  n: (p) => {
    const w = p.oWidth, s = p.stemWidth, h = p.xHeight
    const drop = h * p.shoulder
    const peak = h + p.overshoot
    const counterTop = h - (p.hairWidth ?? s * (1 - p.contrast)) - drop * 0.4
    const d = `
      M 0 0
      L 0 ${h}
      Q ${w/2} ${peak * p.archHeight + h * (1 - p.archHeight)} ${w} ${h - drop}
      L ${w} 0
      L ${w - s} 0
      L ${w - s} ${counterTop - drop * 0.2}
      Q ${w/2} ${counterTop - s * 0.3} ${s} ${counterTop}
      L ${s} 0
      Z`
    return { width: w, paths: [
      { d, part: 'arch' },
      ...(p.serif > 0 ? [
        { d: serifFoot(0, s, p.serif, p.jut ?? 0), part: 'serif' },
        { d: serifFoot(w - s, s, p.serif, p.jut ?? 0), part: 'serif' },
      ] : []),
    ]}
  },
  m: (p) => {
    const w = p.oWidth * 1.55, s = p.stemWidth, h = p.xHeight
    const halfW = w / 2
    const drop = h * p.shoulder
    const peak = h + p.overshoot
    const counterTop = h - (p.hairWidth ?? s * (1 - p.contrast)) - drop * 0.4
    const archY = peak * p.archHeight + h * (1 - p.archHeight)
    const d = `
      M 0 0
      L 0 ${h}
      Q ${halfW/2} ${archY} ${halfW} ${h - drop}
      Q ${halfW + halfW/2} ${archY} ${w} ${h - drop}
      L ${w} 0
      L ${w - s} 0
      L ${w - s} ${counterTop - drop * 0.2}
      Q ${halfW + halfW/2} ${counterTop - s * 0.3} ${halfW + s/2} ${counterTop}
      L ${halfW + s/2} 0
      L ${halfW - s/2} 0
      L ${halfW - s/2} ${counterTop}
      Q ${halfW/2} ${counterTop - s * 0.3} ${s} ${counterTop}
      L ${s} 0
      Z`
    return { width: w, paths: [
      { d, part: 'arch' },
      ...(p.serif > 0 ? [
        { d: serifFoot(0, s, p.serif, p.jut ?? 0), part: 'serif' },
        { d: serifFoot(halfW - s/2, s, p.serif, p.jut ?? 0), part: 'serif' },
        { d: serifFoot(w - s, s, p.serif, p.jut ?? 0), part: 'serif' },
      ] : []),
    ]}
  },
  h: (p) => {
    const w = p.oWidth, s = p.stemWidth, h = p.xHeight, a = p.ascender
    const drop = h * p.shoulder
    const peak = h + p.overshoot
    const counterTop = h - (p.hairWidth ?? s * (1 - p.contrast)) - drop * 0.4
    const archY = peak * p.archHeight + h * (1 - p.archHeight)
    const d = `
      M 0 0
      L 0 ${a}
      L ${s} ${a}
      L ${s} ${h * 0.85}
      Q ${s} ${archY} ${w/2} ${archY}
      Q ${w} ${archY} ${w} ${h - drop}
      L ${w} 0
      L ${w - s} 0
      L ${w - s} ${counterTop - drop * 0.2}
      Q ${w/2} ${counterTop - s * 0.3} ${s} ${counterTop}
      L ${s} 0
      Z`
    return { width: w, paths: [
      { d, part: 'arch' },
      ...(p.serif > 0 ? [
        { d: serifFoot(0, s, p.serif, p.jut ?? 0), part: 'serif' },
        { d: serifFoot(w - s, s, p.serif, p.jut ?? 0), part: 'serif' },
      ] : []),
    ]}
  },
  t: (p) => {
    const s = p.stemWidth, h = p.xHeight
    const crossW = s * 2.8
    const crossH = s * 0.7
    const crossY = h * 0.92
    const stemTop = h * 1.18
    const stemCx = crossW / 2
    return { width: crossW, paths: [
      { d: `M ${stemCx - s/2} 0 L ${stemCx + s/2} 0 L ${stemCx + s/2} ${stemTop} L ${stemCx - s/2} ${stemTop} Z`, part: 'stem' },
      { d: `M 0 ${crossY - crossH/2} L ${crossW} ${crossY - crossH/2} L ${crossW} ${crossY + crossH/2} L 0 ${crossY + crossH/2} Z`, part: 'crossbar' },
    ]}
  },
}
