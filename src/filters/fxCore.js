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

/* noRandom: Amount is the dry/wet mix dial, not a look param — the seeded
 * filter Randomize must not thrash the user's blend. */
export const AMOUNT_PARAM = { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1, default: 100, noRandom: true }

/* ── per-source cache registry ──────────────────────────────────────────
 * Every filter-side cache keyed on src-canvas identity (base pixels, luma
 * grids, samplers) registers its WeakMap here so invalidateSource() can drop
 * a source whose PIXELS changed under a stable identity — chain intermediates
 * (each stage rewrites the same canvas every frame) and in-place-redrawn loop
 * sources. Fresh-identity sources (fitted photo rebuilds) never need it. */
const sourceCaches = new Set()
export function registerSourceCache(cache) {
  sourceCaches.add(cache)
}
export function invalidateSource(src) {
  for (const c of sourceCaches) c.delete(src)
}

const bufferCache = new WeakMap()
registerSourceCache(bufferCache)
/* Shared per-source ImageData cache, keyed on src-canvas identity — base
 * pixels read once per source, the out buffer reused every frame. Also used
 * by glass.js (displacement) and fxHalftoneDither.js (base pixels only). */
export function buffersFor(src) {
  let e = bufferCache.get(src)
  if (!e) {
    const g = src.getContext('2d')
    e = { base: g.getImageData(0, 0, src.width, src.height), out: g.createImageData(src.width, src.height) }
    bufferCache.set(src, e)
  }
  return e
}

/* ── shared deterministic 2D hashes (the two variants used across filters) ──
 * sinHash2 — the labs sin-lattice hash (vnoise/cellRand in the HALFTONE trio
 * + sweeps). intHash2 — the integer-mix hash (glass fields, fx-noise). */
export function sinHash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function intHash2(x, y) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}

let scratch = null
function scratchFor(w, h) {
  if (!scratch) scratch = document.createElement('canvas')
  if (scratch.width !== w) scratch.width = w
  if (scratch.height !== h) scratch.height = h
  return scratch
}

/* Amount for DRAW-based filters (the HALFTONE trio paints glyphs/shapes, not
 * pixel buffers, so runFx's ImageData mix doesn't apply): the labs pages'
 * crossfade — paint the fitted source back over the effect at 1 − amount
 * (AsciiPage/DitherPage `globalAlpha = 1 - a`). Call after the effect pass. */
export function mixSourceOver(ctx, src, w, h, amount) {
  const amt = amount == null ? 1 : Math.max(0, Math.min(1, amount / 100))
  if (amt >= 1) return
  ctx.save()
  ctx.globalAlpha = 1 - amt
  ctx.drawImage(src, 0, 0, w, h)
  ctx.restore()
}

/* ── chain runner ───────────────────────────────────────────────────────
 * Ordered stack of canvas filters, output of one feeding the next — the labs
 * applyCanvasFx loop (useCanvasFx.js:296-329) reshaped for the filter
 * contract: each stage is a full `def.apply(ctx, src, w, h, p, u)` pass, so
 * draw-based filters (the HALFTONE trio) chain exactly like buffer filters.
 *
 * `stages` = [{ def, params }] ENABLED canvas stages in chain order. The
 * final stage draws into `ctx` (the layer canvas, dpr-transformed); earlier
 * stages render into pooled intermediates at the source's own backing size —
 * the dpr-scaled source contract holds through the whole chain (each
 * intermediate is backed at src pixels, its ctx transformed so 1 unit =
 * 1 CSS px). Intermediates are invalidated after every write so identity-
 * keyed pixel caches re-read them. */
const interPool = []
function interFor(i, bw, bh) {
  let c = interPool[i]
  if (!c) { c = document.createElement('canvas'); interPool[i] = c }
  if (c.width !== bw) c.width = bw
  if (c.height !== bh) c.height = bh
  return c
}

export function runChain(ctx, src, w, h, stages, u) {
  const n = stages.length
  if (n === 0) { ctx.drawImage(src, 0, 0, w, h); return }
  let cur = src
  for (let i = 0; i < n; i++) {
    const { def, params } = stages[i]
    if (i === n - 1) {
      def.apply(ctx, cur, w, h, params, u)
      return
    }
    const inter = interFor(i, cur.width, cur.height)
    const g = inter.getContext('2d')
    g.setTransform(inter.width / w, 0, 0, inter.height / h, 0, 0)
    g.clearRect(0, 0, w, h)
    def.apply(g, cur, w, h, params, u)
    invalidateSource(inter)
    cur = inter
  }
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
