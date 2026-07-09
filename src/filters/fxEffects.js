/**
 * Effects canvas tier — the Canvas-2D effect set of the kol-labs-single
 * effects page (pages/effects → engine/canvasEffects.js over
 * src/lib/imagefilters.js), each imagefilters pass inlined here as a
 * (srcData, outData, w, h, params) processor and run through fxCore's
 * runFx(). The labs page crossfades the whole stack by one global Amount;
 * here each filter carries its own `amount` — same math, per filter.
 *
 * The labs canvas-tier posterize (plain ImageFilters.Posterize) is NOT
 * ported: fx-posterize (fxRadar.js) covers the same 2–32 levels range with
 * cleaner quantisation, so one posterize stays.
 *
 * fx-noise is the only animated one: the labs pass rolled Math.random() per
 * frame (never seamless), so it's replaced by a deterministic per-pixel hash
 * whose seed steps floor(u·flicker) mod flicker — an INTEGER number of
 * frames per loop, frame(0) === frame(1) exactly. Everything else is static.
 */
import { AMOUNT_PARAM, runFx, intHash2 as hash2 } from './fxCore.js'

/* ── HSL (ImageFilters.HSLAdjustment, conversions inlined) ────────────── */
/* labs mapping: HSLAdjustment(hue·180, sat·100, value·50) with its own
 * /360, /100, /100 — net: hueDelta = hue/2 (turns), satDelta = saturation,
 * lightness = value/2. */

function hueChannel(m1, m2, hue) {
  if (hue < 0) hue += 1
  else if (hue > 1) hue -= 1
  let v
  if (6 * hue < 1) v = m1 + (m2 - m1) * hue * 6
  else if (2 * hue < 1) v = m2
  else if (3 * hue < 2) v = m1 + (m2 - m1) * (2 / 3 - hue) * 6
  else v = m1
  return (v * 255 + 0.5) | 0
}

function fxHsl(sd, od, w, h, q) {
  const hueDelta = (q.hue ?? 0) * 0.5
  const satDelta = q.saturation ?? 0
  const lightness = (q.value ?? 0) * 0.5
  for (let i = 0; i < sd.length; i += 4) {
    const r = sd[i] / 255
    const g = sd[i + 1] / 255
    const b = sd[i + 2] / 255
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b)
    const min = r < g ? (r < b ? r : b) : (g < b ? g : b)
    const chroma = max - min
    let hh = 0
    let s = 0
    let l = (min + max) / 2
    if (chroma !== 0) {
      if (r === max) hh = (g - b) / chroma + (g < b ? 6 : 0)
      else if (g === max) hh = (b - r) / chroma + 2
      else hh = (r - g) / chroma + 4
      hh /= 6
      s = l > 0.5 ? chroma / (2 - max - min) : chroma / (max + min)
    }
    hh += hueDelta
    while (hh < 0) hh += 1
    while (hh > 1) hh -= 1
    s += s * satDelta
    if (s < 0) s = 0
    else if (s > 1) s = 1
    if (lightness > 0) l += (1 - l) * lightness
    else if (lightness < 0) l += l * lightness
    if (s === 0) {
      od[i] = od[i + 1] = od[i + 2] = (l * 255 + 0.5) | 0
    } else {
      const m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s
      const m1 = l * 2 - m2
      od[i] = hueChannel(m1, m2, hh + 1 / 3)
      od[i + 1] = hueChannel(m1, m2, hh)
      od[i + 2] = hueChannel(m1, m2, hh - 1 / 3)
    }
    od[i + 3] = sd[i + 3]
  }
}

/* ── Brightness (ImageFilters.BrightnessContrastPhotoshop, contrast 0) ── */

function fxBrightness(sd, od, w, h, q) {
  const b = 1 + (q.brightness ?? 0)
  for (let i = 0; i < sd.length; i += 4) {
    const v = (sd[i] * b + 0.5) | 0
    const v1 = (sd[i + 1] * b + 0.5) | 0
    const v2 = (sd[i + 2] * b + 0.5) | 0
    od[i] = v > 255 ? 255 : v
    od[i + 1] = v1 > 255 ? 255 : v1
    od[i + 2] = v2 > 255 ? 255 : v2
    od[i + 3] = sd[i + 3]
  }
}

/* ── Contrast (ImageFilters.BrightnessContrastPhotoshop, brightness 0) ── */

function fxContrast(sd, od, w, h, q) {
  const c = ((q.contrast ?? 0) + 100) / 100
  for (let i = 0; i < sd.length; i += 4) {
    let v = ((sd[i] - 127.5) * c + 127.5 + 0.5) | 0
    od[i] = v > 255 ? 255 : v < 0 ? 0 : v
    v = ((sd[i + 1] - 127.5) * c + 127.5 + 0.5) | 0
    od[i + 1] = v > 255 ? 255 : v < 0 ? 0 : v
    v = ((sd[i + 2] - 127.5) * c + 127.5 + 0.5) | 0
    od[i + 2] = v > 255 ? 255 : v < 0 ? 0 : v
    od[i + 3] = sd[i + 3]
  }
}

/* ── RGB (ImageFilters.ColorTransformFilter — per-channel offsets) ────── */

function fxRgb(sd, od, w, h, q) {
  const ro = q.red ?? 0, go = q.green ?? 0, bo = q.blue ?? 0
  for (let i = 0; i < sd.length; i += 4) {
    let v = sd[i] + ro
    od[i] = v > 255 ? 255 : v < 0 ? 0 : v
    v = sd[i + 1] + go
    od[i + 1] = v > 255 ? 255 : v < 0 ? 0 : v
    v = sd[i + 2] + bo
    od[i + 2] = v > 255 ? 255 : v < 0 ? 0 : v
    od[i + 3] = sd[i + 3]
  }
}

/* ── Invert (ImageFilters.Invert) ─────────────────────────────────────── */

function fxInvert(sd, od) {
  for (let i = 0; i < sd.length; i += 4) {
    od[i] = 255 - sd[i]
    od[i + 1] = 255 - sd[i + 1]
    od[i + 2] = 255 - sd[i + 2]
    od[i + 3] = sd[i + 3]
  }
}

/* ── Sepia (ImageFilters.Sepia — the classic tone matrix) ─────────────── */

function fxSepia(sd, od) {
  for (let i = 0; i < sd.length; i += 4) {
    const r = sd[i], g = sd[i + 1], b = sd[i + 2]
    let v = r * 0.393 + g * 0.769 + b * 0.189
    od[i] = v > 255 ? 255 : (v + 0.5) | 0
    v = r * 0.349 + g * 0.686 + b * 0.168
    od[i + 1] = v > 255 ? 255 : (v + 0.5) | 0
    v = r * 0.272 + g * 0.534 + b * 0.131
    od[i + 2] = v > 255 ? 255 : (v + 0.5) | 0
    od[i + 3] = sd[i + 3]
  }
}

/* ── Grayscale (ImageFilters.GrayScale — Rec.601 fixed-point luma) ────── */

function fxGrayscale(sd, od) {
  for (let i = 0; i < sd.length; i += 4) {
    od[i] = od[i + 1] = od[i + 2] = (sd[i] * 19595 + sd[i + 1] * 38470 + sd[i + 2] * 7471) >> 16
    od[i + 3] = sd[i + 3]
  }
}

/* ── Blur (ImageFilters.StackBlur — Mario Klingemann's stack blur) ────── */

const MUL_TABLE = [
  512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512,
  454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512,
  482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456,
  437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512,
  497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328,
  320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456,
  446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335,
  329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512,
]
const SHG_TABLE = [
  9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
  17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
  19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
  20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
  21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
  21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
  22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
  22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
]

function BlurStack() {
  this.r = 0
  this.g = 0
  this.b = 0
  this.a = 0
  this.next = null
}

/* In-place stack blur over `px` (RGBA). Radius capped to the table range
 * (the UI max is 40 anyway). Faithful port of the labs StackBlur body. */
function stackBlurInPlace(px, w, h, radius) {
  let x, y, i, p, yp, yi, yw
  let rSum, gSum, bSum, aSum
  let rOut, gOut, bOut, aOut
  let rIn, gIn, bIn, aIn
  let pr, pg, pb, pa, rbs
  const div = radius + radius + 1
  const widthMinus1 = w - 1
  const heightMinus1 = h - 1
  const radiusPlus1 = radius + 1
  const sumFactor = (radiusPlus1 * (radiusPlus1 + 1)) / 2
  const stackStart = new BlurStack()
  let stack = stackStart
  let stackIn, stackOut, stackEnd
  const mulSum = MUL_TABLE[radius]
  const shgSum = SHG_TABLE[radius]

  for (i = 1; i < div; i++) {
    stack = stack.next = new BlurStack()
    if (i === radiusPlus1) stackEnd = stack
  }
  stack.next = stackStart
  yw = yi = 0

  for (y = 0; y < h; y++) {
    rIn = gIn = bIn = aIn = rSum = gSum = bSum = aSum = 0
    rOut = radiusPlus1 * (pr = px[yi])
    gOut = radiusPlus1 * (pg = px[yi + 1])
    bOut = radiusPlus1 * (pb = px[yi + 2])
    aOut = radiusPlus1 * (pa = px[yi + 3])
    rSum += sumFactor * pr
    gSum += sumFactor * pg
    bSum += sumFactor * pb
    aSum += sumFactor * pa
    stack = stackStart
    for (i = 0; i < radiusPlus1; i++) {
      stack.r = pr; stack.g = pg; stack.b = pb; stack.a = pa
      stack = stack.next
    }
    for (i = 1; i < radiusPlus1; i++) {
      p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2)
      rSum += (stack.r = (pr = px[p])) * (rbs = radiusPlus1 - i)
      gSum += (stack.g = (pg = px[p + 1])) * rbs
      bSum += (stack.b = (pb = px[p + 2])) * rbs
      aSum += (stack.a = (pa = px[p + 3])) * rbs
      rIn += pr; gIn += pg; bIn += pb; aIn += pa
      stack = stack.next
    }
    stackIn = stackStart
    stackOut = stackEnd
    for (x = 0; x < w; x++) {
      px[yi] = (rSum * mulSum) >> shgSum
      px[yi + 1] = (gSum * mulSum) >> shgSum
      px[yi + 2] = (bSum * mulSum) >> shgSum
      px[yi + 3] = (aSum * mulSum) >> shgSum
      rSum -= rOut; gSum -= gOut; bSum -= bOut; aSum -= aOut
      rOut -= stackIn.r; gOut -= stackIn.g; bOut -= stackIn.b; aOut -= stackIn.a
      p = (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2
      rIn += (stackIn.r = px[p])
      gIn += (stackIn.g = px[p + 1])
      bIn += (stackIn.b = px[p + 2])
      aIn += (stackIn.a = px[p + 3])
      rSum += rIn; gSum += gIn; bSum += bIn; aSum += aIn
      stackIn = stackIn.next
      rOut += (pr = stackOut.r); gOut += (pg = stackOut.g); bOut += (pb = stackOut.b); aOut += (pa = stackOut.a)
      rIn -= pr; gIn -= pg; bIn -= pb; aIn -= pa
      stackOut = stackOut.next
      yi += 4
    }
    yw += w
  }

  for (x = 0; x < w; x++) {
    gIn = bIn = aIn = rIn = gSum = bSum = aSum = rSum = 0
    yi = x << 2
    rOut = radiusPlus1 * (pr = px[yi])
    gOut = radiusPlus1 * (pg = px[yi + 1])
    bOut = radiusPlus1 * (pb = px[yi + 2])
    aOut = radiusPlus1 * (pa = px[yi + 3])
    rSum += sumFactor * pr
    gSum += sumFactor * pg
    bSum += sumFactor * pb
    aSum += sumFactor * pa
    stack = stackStart
    for (i = 0; i < radiusPlus1; i++) {
      stack.r = pr; stack.g = pg; stack.b = pb; stack.a = pa
      stack = stack.next
    }
    yp = w
    for (i = 1; i <= radius; i++) {
      yi = (yp + x) << 2
      rSum += (stack.r = (pr = px[yi])) * (rbs = radiusPlus1 - i)
      gSum += (stack.g = (pg = px[yi + 1])) * rbs
      bSum += (stack.b = (pb = px[yi + 2])) * rbs
      aSum += (stack.a = (pa = px[yi + 3])) * rbs
      rIn += pr; gIn += pg; bIn += pb; aIn += pa
      stack = stack.next
      if (i < heightMinus1) yp += w
    }
    yi = x
    stackIn = stackStart
    stackOut = stackEnd
    for (y = 0; y < h; y++) {
      p = yi << 2
      px[p] = (rSum * mulSum) >> shgSum
      px[p + 1] = (gSum * mulSum) >> shgSum
      px[p + 2] = (bSum * mulSum) >> shgSum
      px[p + 3] = (aSum * mulSum) >> shgSum
      rSum -= rOut; gSum -= gOut; bSum -= bOut; aSum -= aOut
      rOut -= stackIn.r; gOut -= stackIn.g; bOut -= stackIn.b; aOut -= stackIn.a
      p = (x + ((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * w) << 2
      rSum += rIn += (stackIn.r = px[p])
      gSum += gIn += (stackIn.g = px[p + 1])
      bSum += bIn += (stackIn.b = px[p + 2])
      aSum += aIn += (stackIn.a = px[p + 3])
      stackIn = stackIn.next
      rOut += (pr = stackOut.r); gOut += (pg = stackOut.g); bOut += (pb = stackOut.b); aOut += (pa = stackOut.a)
      rIn -= pr; gIn -= pg; bIn -= pb; aIn -= pa
      stackOut = stackOut.next
      yi += w
    }
  }
}

function fxBlur(sd, od, w, h, q) {
  od.set(sd)
  const radius = Math.min(Math.round(q.blurRadius ?? 0), MUL_TABLE.length - 1)
  if (radius >= 1) stackBlurInPlace(od, w, h, radius)
}

/* ── Pixelate (ImageFilters.Mosaic — block-average) ───────────────────── */

function fxPixelate(sd, od, w, h, q) {
  const blockSize = Math.max(1, Math.round(q.pixelSize ?? 1))
  if (blockSize <= 1) { od.set(sd); return }
  const cols = Math.ceil(w / blockSize)
  const rows = Math.ceil(h / blockSize)
  for (let row = 0; row < rows; row++) {
    const yStart = row * blockSize
    const yEnd = Math.min(yStart + blockSize, h)
    for (let col = 0; col < cols; col++) {
      const xStart = col * blockSize
      const xEnd = Math.min(xStart + blockSize, w)
      let r = 0, g = 0, b = 0, a = 0
      const size = (xEnd - xStart) * (yEnd - yStart)
      for (let y = yStart; y < yEnd; y++) {
        const yIndex = y * w
        for (let x = xStart; x < xEnd; x++) {
          const i = (yIndex + x) << 2
          r += sd[i]; g += sd[i + 1]; b += sd[i + 2]; a += sd[i + 3]
        }
      }
      r = (r / size + 0.5) | 0
      g = (g / size + 0.5) | 0
      b = (b / size + 0.5) | 0
      a = (a / size + 0.5) | 0
      for (let y = yStart; y < yEnd; y++) {
        const yIndex = y * w
        for (let x = xStart; x < xEnd; x++) {
          const i = (yIndex + x) << 2
          od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = a
        }
      }
    }
  }
}

/* ── Solarize (ImageFilters.Solarize) ─────────────────────────────────── */

function fxSolarize(sd, od, w, h) {
  for (let i = 0; i < sd.length; i += 4) {
    let v = sd[i]
    od[i] = (v > 127 ? (v - 127.5) * 2 : (127.5 - v) * 2) | 0
    v = sd[i + 1]
    od[i + 1] = (v > 127 ? (v - 127.5) * 2 : (127.5 - v) * 2) | 0
    v = sd[i + 2]
    od[i + 2] = (v > 127 ? (v - 127.5) * 2 : (127.5 - v) * 2) | 0
    od[i + 3] = sd[i + 3]
  }
}

/* ── Emboss (ImageFilters.Emboss — 3×3 convolution, centre-clamp edges) ─ */

const EMBOSS_KERNEL = [-2, -1, 0, -1, 1, 1, 0, 1, 2]

function fxEmboss(sd, od, w, h) {
  let index = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, index += 4) {
      let r = 0, g = 0, b = 0, m = 0
      for (let row = -1; row <= 1; row++) {
        const rowIndex = y + row
        // labs ConvolutionFilter clamp: out-of-bounds row/col falls back to
        // the CENTRE row/col, not the nearest edge
        const offset = (rowIndex >= 0 && rowIndex < h ? rowIndex : y) * w
        for (let col = -1; col <= 1; col++) {
          const k = EMBOSS_KERNEL[m++]
          if (k === 0) continue
          let colIndex = x + col
          if (colIndex < 0 || colIndex >= w) colIndex = x
          const p = (offset + colIndex) << 2
          r += k * sd[p]
          g += k * sd[p + 1]
          b += k * sd[p + 2]
        }
      }
      od[index] = r > 255 ? 255 : r < 0 ? 0 : r | 0
      od[index + 1] = g > 255 ? 255 : g < 0 ? 0 : g | 0
      od[index + 2] = b > 255 ? 255 : b < 0 ? 0 : b | 0
      od[index + 3] = sd[index + 3]
    }
  }
}

/* ── Enhance (ImageFilters.Enrich — 3×3 convolution, ÷10 −40 bias) ────── */

const ENRICH_KERNEL = [0, -2, 0, -2, 20, -2, 0, -2, 0]

function fxEnhance(sd, od, w, h) {
  let index = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, index += 4) {
      let r = 0, g = 0, b = 0, m = 0
      for (let row = -1; row <= 1; row++) {
        const rowIndex = y + row
        // same centre-clamp edge fallback as fxEmboss (labs ConvolutionFilter)
        const offset = (rowIndex >= 0 && rowIndex < h ? rowIndex : y) * w
        for (let col = -1; col <= 1; col++) {
          const k = ENRICH_KERNEL[m++]
          if (k === 0) continue
          let colIndex = x + col
          if (colIndex < 0 || colIndex >= w) colIndex = x
          const p = (offset + colIndex) << 2
          r += k * sd[p]
          g += k * sd[p + 1]
          b += k * sd[p + 2]
        }
      }
      r = r / 10 - 40
      g = g / 10 - 40
      b = b / 10 - 40
      od[index] = r > 255 ? 255 : r < 0 ? 0 : r | 0
      od[index + 1] = g > 255 ? 255 : g < 0 ? 0 : g | 0
      od[index + 2] = b > 255 ? 255 : b < 0 ? 0 : b | 0
      od[index + 3] = sd[index + 3]
    }
  }
}

/* ── Noise (canvasEffects.applyNoise, made deterministic + loopable) ──── */
/* per-pixel hash — fxCore's intHash2 */

function fxNoise(sd, od, w, h, q) {
  const mag = (q.noise ?? 0) * 255
  if (mag <= 0) { od.set(sd); return }
  const seed = q.seed | 0
  for (let i = 0, px = 0; i < sd.length; i += 4, px++) {
    const n = (hash2(px, seed) - 0.5) * 2 * mag
    let v = sd[i] + n
    od[i] = v < 0 ? 0 : v > 255 ? 255 : v
    v = sd[i + 1] + n
    od[i + 1] = v < 0 ? 0 : v > 255 ? 255 : v
    v = sd[i + 2] + n
    od[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v
    od[i + 3] = sd[i + 3]
  }
}

/* ── filter defs ──────────────────────────────────────────────────────── */

export const EFFECTS_FX = [
  {
    id: 'fx-hsl',
    label: 'HSL',
    animated: false,
    params: [
      { key: 'hue', label: 'Hue', type: 'range', min: -1, max: 1, step: 0.01, default: 0 },
      { key: 'saturation', label: 'Saturation', type: 'range', min: -2, max: 10, step: 0.1, default: 0 },
      { key: 'value', label: 'Value', type: 'range', min: -2, max: 2, step: 0.1, default: 0 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxHsl, { hue: p.hue ?? 0, saturation: p.saturation ?? 0, value: p.value ?? 0 }, p.amount)
    },
  },
  {
    /* labs runs filter-hsv through the SAME HSLAdjustment pass as filter-hsl
     * (canvasEffects.js applyOne fall-through) — the alias is kept faithfully. */
    id: 'fx-hsv',
    label: 'HSV',
    animated: false,
    params: [
      { key: 'hue', label: 'Hue', type: 'range', min: -1, max: 1, step: 0.01, default: 0 },
      { key: 'saturation', label: 'Saturation', type: 'range', min: -2, max: 10, step: 0.1, default: 0 },
      { key: 'value', label: 'Value', type: 'range', min: -2, max: 2, step: 0.1, default: 0 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxHsl, { hue: p.hue ?? 0, saturation: p.saturation ?? 0, value: p.value ?? 0 }, p.amount)
    },
  },
  {
    id: 'fx-brightness',
    label: 'Brightness',
    animated: false,
    params: [
      { key: 'brightness', label: 'Brightness', type: 'range', min: -1, max: 1, step: 0.01, default: 0 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxBrightness, { brightness: p.brightness ?? 0 }, p.amount)
    },
  },
  {
    id: 'fx-contrast',
    label: 'Contrast',
    animated: false,
    params: [
      { key: 'contrast', label: 'Contrast', type: 'range', min: -100, max: 100, step: 1, default: 0 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxContrast, { contrast: p.contrast ?? 0 }, p.amount)
    },
  },
  {
    id: 'fx-rgb',
    label: 'RGB',
    animated: false,
    params: [
      { key: 'red', label: 'Red', type: 'range', min: -255, max: 255, step: 1, default: 0 },
      { key: 'green', label: 'Green', type: 'range', min: -255, max: 255, step: 1, default: 0 },
      { key: 'blue', label: 'Blue', type: 'range', min: -255, max: 255, step: 1, default: 0 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxRgb, { red: p.red ?? 0, green: p.green ?? 0, blue: p.blue ?? 0 }, p.amount)
    },
  },
  {
    id: 'fx-invert',
    label: 'Invert',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxInvert, null, p.amount)
    },
  },
  {
    id: 'fx-sepia',
    label: 'Sepia',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxSepia, null, p.amount)
    },
  },
  {
    id: 'fx-grayscale',
    label: 'Grayscale',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxGrayscale, null, p.amount)
    },
  },
  {
    id: 'fx-enhance',
    label: 'Enhance',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxEnhance, null, p.amount)
    },
  },
  {
    id: 'fx-blur',
    label: 'Blur',
    animated: false,
    params: [
      { key: 'blurRadius', label: 'Radius', type: 'range', min: 0, max: 40, step: 1, default: 4 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      /* radius is authored in css px; the source is dpr-backed — scale into
       * source-pixel space (k = 1 at dpr 1 — identical). */
      const k = src.width / w || 1
      runFx(ctx, src, w, h, fxBlur, { blurRadius: (p.blurRadius ?? 4) * k }, p.amount)
    },
  },
  {
    id: 'fx-pixelate',
    label: 'Pixelate',
    animated: false,
    params: [
      { key: 'pixelSize', label: 'Pixel size', type: 'range', min: 1, max: 20, step: 1, default: 6 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p) {
      /* block size in css px → source-pixel space (k = 1 at dpr 1). */
      const k = src.width / w || 1
      runFx(ctx, src, w, h, fxPixelate, { pixelSize: (p.pixelSize ?? 6) * k }, p.amount)
    },
  },
  {
    id: 'fx-solarize',
    label: 'Solarize',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxSolarize, null, p.amount)
    },
  },
  {
    id: 'fx-emboss',
    label: 'Emboss',
    animated: false,
    params: [AMOUNT_PARAM],
    apply(ctx, src, w, h, p) {
      runFx(ctx, src, w, h, fxEmboss, null, p.amount)
    },
  },
  {
    id: 'fx-noise',
    label: 'Noise',
    animated: true,
    params: [
      { key: 'noise', label: 'Noise', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 },
      { key: 'flicker', label: 'Flicker · steps', type: 'range', min: 0, max: 12, step: 1, default: 8 },
      AMOUNT_PARAM,
    ],
    apply(ctx, src, w, h, p, u) {
      const steps = Math.max(0, Math.round(p.flicker ?? 8))
      const seed = steps > 0 ? Math.floor(u * steps) % steps : 0
      runFx(ctx, src, w, h, fxNoise, { noise: p.noise ?? 0.2, seed }, p.amount)
    },
  },
]
