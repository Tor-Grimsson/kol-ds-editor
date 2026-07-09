// Reference axes / grid overlays for the math loops (ported from
// kol-labs-single math/components/axes2d.js + axes3d.js, StylePanel's
// axis system). Colour comes in as a themable layer param (role 'fg' in
// each loop's schema) — never hardcoded — so the loops' theme/invert
// machinery recolours the grid with the rest of the layer.
//
// Pure functions of their inputs; safe anywhere in a loop's draw path.

const toRGB = (h) => {
  const s = (h || '#ffffff').replace('#', '')
  return `${parseInt(s.slice(0, 2), 16) || 0},${parseInt(s.slice(2, 4), 16) || 0},${parseInt(s.slice(4, 6), 16) || 0}`
}

export const AXIS_2D_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'axes', label: 'Axes' },
  { value: 'grid', label: 'Grid' },
]
export const AXIS_3D_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'axes', label: 'Axes' },
  { value: 'box', label: 'Box' },
]

// 2D screen-space axes/grid for the plane loops (fields, waveform).
// `style` = { axis, gridColor, gridOpacity }; `view` = { cx, cy, range }
// (world units across the width). Step auto-picks a 1/2/5 decade from
// range/8 (labs axes2d). 'axes' draws just the two zero lines ('axes' and
// 'grid' were conflated in labs axes2d; split here so the option matters).
export function drawAxes2D(ctx, w, h, style, view) {
  const { axis, gridColor = '#ffffff', gridOpacity = 0.12 } = style || {}
  if (!axis || axis === 'none') return
  const { cx = 0, cy = 0, range = 1 } = view || {}
  const rgb = toRGB(gridColor)
  const ppw = w / range
  const sx = (x) => w / 2 + (x - cx) * ppw
  const sy = (y) => h / 2 - (y - cy) * ppw
  ctx.lineWidth = 1

  if (axis === 'axes') {
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, gridOpacity * 3)})`
    const X = sx(0)
    const Y = sy(0)
    if (X >= 0 && X <= w) { ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, h); ctx.stroke() }
    if (Y >= 0 && Y <= h) { ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(w, Y); ctx.stroke() }
    return
  }

  ctx.strokeStyle = `rgba(${rgb},${gridOpacity})`
  const raw = range / 8
  const p = Math.pow(10, Math.floor(Math.log10(raw) || 0))
  const m = raw / p
  const step = p * (m >= 5 ? 5 : m >= 2 ? 2 : 1)
  const halfW = range / 2
  const halfH = (range * h) / w / 2
  for (let x = Math.ceil((cx - halfW) / step) * step; x <= cx + halfW; x += step) {
    const X = sx(x)
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, h); ctx.stroke()
  }
  for (let y = Math.ceil((cy - halfH) / step) * step; y <= cy + halfH; y += step) {
    const Y = sy(y)
    ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(w, Y); ctx.stroke()
  }
}

// 3D axes / bounding box projected through `proj` (the surface/curves
// projector). `ext` is the figure half-extent; `style` = { axis, gridColor,
// gridOpacity, space } ('2D' skips the z axis for planar figures).
export function drawAxes3D(ctx, proj, ext, style) {
  const { axis, gridColor = '#ffffff', gridOpacity = 0.1, space = '3D' } = style || {}
  if (!axis || axis === 'none') return
  const rgb = toRGB(gridColor)
  const L = ext
  ctx.lineWidth = 1
  const P = (x, y, z) => ({ x, y, z })
  const seg = (a, b, alpha) => {
    const [ax, ay] = proj(a)
    const [bx, by] = proj(b)
    ctx.strokeStyle = `rgba(${rgb},${alpha})`
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }

  if (axis === 'axes') {
    const a = Math.min(1, gridOpacity * 3)
    seg(P(-L, 0, 0), P(L, 0, 0), a)
    seg(P(0, -L, 0), P(0, L, 0), a)
    if (space === '3D') seg(P(0, 0, -L), P(0, 0, L), a)
  } else if (axis === 'box') {
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map((c) => P(c[0] * L, c[1] * L, c[2] * L))
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    for (const [a, b] of E) seg(v[a], v[b], Math.min(1, gridOpacity * 1.5))
  }
}
