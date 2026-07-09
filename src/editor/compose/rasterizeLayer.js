/**
 * rasterizeLayer — the universal-effects SOURCE seam (plan.md Phase 7): turn
 * a DOM/SVG layer's own render into a canvas so an image filter can consume
 * it (`filter.apply(ctx, src, …)` — the same `src` contract photo filters
 * use).
 *
 * Builds a single-layer SVG via build.js's layerToSvg with the effect and
 * host-level styling STRIPPED (the filter chain, rotation/flip, opacity/
 * blend live on the outer canvas host — baking them into the source would
 * double-apply them), viewBoxed to the layer's own bounds, then decodes it
 * to a canvas.
 *
 * Async (SVG → Image decode). Callers cache by `sourceKey(layer)` and
 * re-rasterize only when the content actually changes — a filter-param edit
 * must NOT trigger a re-raster.
 */
import { layerToSvg } from './build'
import { filterById } from '../../filters'
import { warmTextFonts } from '../modes/type/textOutline'

/* Layer stripped to pure content: no effect chain, no host-level transform. */
function contentOnly(layer) {
  return {
    ...layer,
    filters: null,
    filterId: null,   /* legacy single-filter shape — belt and braces */
    rotation: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    blend: 'normal',
    visible: true,
  }
}

/* Cache key: the content-relevant layer state. Filter-chain params live
 * NESTED under `filters` — strip the whole chain so a stage-param slider
 * drag never re-rasters. (Legacy un-normalized layers carried params FLAT;
 * their active filter's param keys are stripped too, same as before.)
 *
 * x/y are stripped too: the raster's viewBox starts at the layer's x/y and
 * every SVG writer positions content by pure translation from them (the
 * pattern def anchors its tile phase at the layer origin; path/text/shape/
 * bool bodies translate by x/y), so position cancels out of the output —
 * dragging a filtered layer must NOT trigger an async re-raster. Child x/y
 * inside group/bool `children` stay in the key (they change geometry). */
export function sourceKey(layer, palette) {
  const f = filterById(layer.filterId)
  const skip = new Set(['filters', 'filterId', 'rotation', 'flipX', 'flipY', 'opacity', 'blend', 'cameraDrag', 'x', 'y'])
  if (f) for (const p of f.params) skip.add(p.key)
  const slim = {}
  for (const k in layer) if (!skip.has(k)) slim[k] = layer[k]
  return JSON.stringify(slim) + '|' + JSON.stringify(palette)
}

/* Rasterize the layer's content to a canvas at w×h CSS px × `scale` (the
 * caller's dpr — the SVG decode is vector, so the backing store upsamples
 * losslessly and the filter keeps full retina resolution). Resolves null
 * when the layer emits no SVG body. */
export async function rasterizeLayer(layer, palette, w, h, scale = 1) {
  /* Text content outlines through textOutline's warm Font map; a cold cut
   * would fall back to foreignObject, whose font-family can't resolve inside
   * the isolated SVG-image document this raster decodes in (a fallback face
   * until the next export happened to warm the cache). Warm first — a no-op
   * once parsed (and for non-text layers) — so the caller's pending/
   * supersede handling paints the real cut when the raster lands. */
  await warmTextFonts([layer])
  const defs = []
  const body = layerToSvg(contentOnly(layer), palette, w, h, 'fx', defs)
  if (!body) return null
  const x = layer.x ?? 0
  const y = layer.y ?? 0
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`
    + (defs.length ? `<defs>${defs.join('\n')}</defs>` : '')
    + body
    + '</svg>'
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w * scale))
      c.height = Math.max(1, Math.round(h * scale))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
