/**
 * Shared plumbing for the labs pixel-FX ports (fxRadar.js, fxEffects.js) —
 * the chain loop of kol-labs-single radar/hooks/useCanvasFx.js
 * applyCanvasFx(), reshaped for the filter contract. Each fx keeps its labs
 * processor (srcData, outData, w, h, params) and calls runFx() with it.
 *
 * - Per-source ImageData buffers are cached by src-canvas identity (the
 *   glass.js pattern): base pixels read once per source, the out buffer
 *   reused every frame — no per-frame getImageData / allocation. Every labs
 *   processor writes the full buffer, so reuse is safe.
 * - `amount` is the labs dry/wet mix: how much of the processed result mixes
 *   back into the pre-FX pixels (0 = original, 100 = full effect).
 * - putImageData ignores the dest ctx's dpr transform, so the result goes
 *   through a shared scratch canvas + drawImage (transform-aware).
 */

export const AMOUNT_PARAM = { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1, default: 100 }

const bufferCache = new WeakMap()
function buffersFor(src) {
  let e = bufferCache.get(src)
  if (!e) {
    const g = src.getContext('2d')
    e = { base: g.getImageData(0, 0, src.width, src.height), out: g.createImageData(src.width, src.height) }
    bufferCache.set(src, e)
  }
  return e
}

let scratch = null
function scratchFor(w, h) {
  if (!scratch) scratch = document.createElement('canvas')
  if (scratch.width !== w) scratch.width = w
  if (scratch.height !== h) scratch.height = h
  return scratch
}

export function runFx(ctx, src, w, h, processor, params, amount) {
  const { base, out } = buffersFor(src)
  processor(base.data, out.data, src.width, src.height, params)
  const amt = amount == null ? 1 : Math.max(0, Math.min(1, amount / 100))
  if (amt < 1) {
    const sd = base.data, od = out.data
    for (let i = 0; i < od.length; i += 4) {
      od[i] = sd[i] + (od[i] - sd[i]) * amt
      od[i + 1] = sd[i + 1] + (od[i + 1] - sd[i + 1]) * amt
      od[i + 2] = sd[i + 2] + (od[i + 2] - sd[i + 2]) * amt
    }
  }
  const s = scratchFor(src.width, src.height)
  s.getContext('2d').putImageData(out, 0, 0)
  ctx.drawImage(s, 0, 0, w, h)
}
