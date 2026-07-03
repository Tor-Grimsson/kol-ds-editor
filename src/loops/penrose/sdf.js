// Glyph rasterization + signed distance field via Felzenszwalb–Huttenlocher EDT.
// Ported verbatim from kol-labs-single src/pages/penrose/sdf.js. The glyph
// faces come from the editor's kinetic font registry (src/kinetic/fonts.js) —
// host.js calls its loadFonts() before rasterizing.

async function ensureFont(family, weight) {
  await document.fonts.load(`${weight} 64px "${family}"`)
  await document.fonts.ready
}

export async function rasterizeGlyph(
  text,
  family,
  weight,
  fontSize,
  w,
  h,
) {
  await ensureFont(family, weight)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Shrink the requested size so multi-letter strings fit the canvas width.
  let fs = fontSize
  ctx.font = `${weight} ${fs}px "${family}"`
  const maxW = w * 0.9
  const measured = ctx.measureText(text).width
  if (measured > maxW) {
    fs = Math.max(8, fs * (maxW / measured))
    ctx.font = `${weight} ${fs}px "${family}"`
  }
  ctx.fillText(text, w / 2, h / 2)
  const img = ctx.getImageData(0, 0, w, h)
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = img.data[i * 4] > 127 ? 1 : 0
  }
  return mask
}

function edt1d(f, n) {
  const d = new Float32Array(n)
  const v = new Int32Array(n)
  const z = new Float32Array(n + 1)
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  let k = 0
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]))
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]))
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
  return d
}

function edt2d(mask, w, h, inverted) {
  const INF = 1e20
  const out = new Float32Array(w * h)
  const colBuf = new Float32Array(h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const m = mask[y * w + x]
      const on = inverted ? !m : !!m
      colBuf[y] = on ? 0 : INF
    }
    const d = edt1d(colBuf, h)
    for (let y = 0; y < h; y++) out[y * w + x] = d[y]
  }
  const rowBuf = new Float32Array(w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) rowBuf[x] = out[y * w + x]
    const d = edt1d(rowBuf, w)
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x])
  }
  return out
}

export function computeSDF(mask, w, h) {
  const outside = edt2d(mask, w, h, false)
  const inside = edt2d(mask, w, h, true)
  const sdf = new Float32Array(w * h)
  for (let i = 0; i < sdf.length; i++) {
    sdf[i] = mask[i] ? -inside[i] : outside[i]
  }
  return sdf
}
