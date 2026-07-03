// Vector shape sources for the generative engines — the decoupling from the glyph.
// Ported from kol-labs-single src/pages/penrose/shapes.js. Every prototype grows
// inside an abstract SDF (proto.init({ sdf })); these are alternative substrates:
// any vector outline → a white-on-black mask, which the host feeds through the
// same computeSDF pipeline as a letter. A glyph is just one shape source.
//
// One deviation from labs: labs only ever baked square masks (res×res);
// rasterizeShape here takes an arbitrary w×h and draws the shape into the
// CENTERED square of side min(w, h) — "contain" fit, so a non-square loop
// layer letterboxes the shape instead of stretching it. (rasterizeGlyph
// already contains natively via its shrink-to-fit + center baseline.)

const poly = (ctx, cx, cy, r, n, rot = -Math.PI / 2) => {
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

// Each shape fills a centred white path on a black res×res canvas (~0.8 short side).
export const VECTOR_SHAPES = [
  { id: 'circle', label: 'Circle', draw: (c, w, h) => { c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); c.fill() } },
  { id: 'triangle', label: 'Triangle', draw: (c, w, h) => poly(c, w / 2, h / 2 + h * 0.04, w * 0.46, 3) },
  { id: 'square', label: 'Square', draw: (c, w, h) => c.fillRect(w * 0.13, h * 0.13, w * 0.74, h * 0.74) },
  { id: 'hexagon', label: 'Hexagon', draw: (c, w, h) => poly(c, w / 2, h / 2, w * 0.44, 6, 0) },
  {
    id: 'star', label: 'Star',
    draw: (c, w, h) => {
      const cx = w / 2, cy = h / 2, R = w * 0.46, r = R * 0.42
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
        const rr = i % 2 ? r : R
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
        i ? c.lineTo(x, y) : c.moveTo(x, y)
      }
      c.closePath(); c.fill()
    },
  },
  {
    id: 'blob', label: 'Blob',
    draw: (c, w, h) => {
      const cx = w / 2, cy = h / 2, base = w * 0.34
      c.beginPath()
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2
        const rr = base * (1 + 0.22 * Math.sin(a * 3) + 0.12 * Math.sin(a * 5 + 1))
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
        i ? c.lineTo(x, y) : c.moveTo(x, y)
      }
      c.closePath(); c.fill()
    },
  },
  {
    id: 'ring', label: 'Ring', // holed / non-convex — proves the mask carries topology
    draw: (c, w, h) => {
      c.beginPath(); c.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2); c.fill()
      const prev = c.fillStyle
      c.fillStyle = '#000'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.2, 0, Math.PI * 2); c.fill()
      c.fillStyle = prev
    },
  },
]

export const shapeById = (id) => VECTOR_SHAPES.find((s) => s.id === id)

// Shape-source picker options: the glyph (typographic substrate) + every vector.
export const SHAPE_SOURCES = [{ id: 'glyph', label: 'Glyph' }, ...VECTOR_SHAPES.map((s) => ({ id: s.id, label: s.label }))]

// Vector shape → white-on-black w×h mask (1 = inside), same shape/units as
// rasterizeGlyph's output so it drops into the existing computeSDF bake.
// The shape draws in the centered min(w,h) square (contain fit — see header).
export function rasterizeShape(shapeId, w, h = w) {
  const s = shapeById(shapeId)
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  if (s) {
    const side = Math.min(w, h)
    ctx.save()
    ctx.translate((w - side) / 2, (h - side) / 2)
    s.draw(ctx, side, side)
    ctx.restore()
  }
  const px = ctx.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0
  return mask
}
