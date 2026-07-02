/**
 * rasterizeLayer — the universal-effects SOURCE seam (plan.md Phase 7): turn
 * a DOM/SVG layer's own render into a canvas so an image filter can consume
 * it (`filter.apply(ctx, src, …)` — the same `src` contract photo filters
 * use).
 *
 * Builds a single-layer SVG via build.js's layerToSvg with the effect and
 * host-level styling STRIPPED (filterId, rotation/flip, opacity/blend live
 * on the outer canvas host — baking them into the source would double-apply
 * them), viewBoxed to the layer's own bounds, then decodes it to a canvas.
 *
 * Async (SVG → Image decode). Callers cache by `sourceKey(layer)` and
 * re-rasterize only when the content actually changes — a filter-param edit
 * must NOT trigger a re-raster.
 */
import { layerToSvg } from './build'
import { filterById } from '../../filters'

/* Layer stripped to pure content: no effect, no host-level transform. */
function contentOnly(layer) {
  return {
    ...layer,
    filterId: null,
    rotation: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    blend: 'normal',
    visible: true,
  }
}

/* Cache key: the content-relevant layer state. Filter params ride flat on
 * the layer, so a naive JSON of the whole layer would re-raster on every
 * slider drag — strip the active filter's param keys first. */
export function sourceKey(layer, palette) {
  const f = filterById(layer.filterId)
  const skip = new Set(['filterId', 'rotation', 'flipX', 'flipY', 'opacity', 'blend', 'cameraDrag'])
  if (f) for (const p of f.params) skip.add(p.key)
  const slim = {}
  for (const k in layer) if (!skip.has(k)) slim[k] = layer[k]
  return JSON.stringify(slim) + '|' + JSON.stringify(palette)
}

/* Rasterize the layer's content to a canvas at w×h CSS px (dpr baked by the
 * caller's draw). Resolves null when the layer emits no SVG body. */
export function rasterizeLayer(layer, palette, w, h) {
  const defs = []
  const body = layerToSvg(contentOnly(layer), palette, w, h, 'fx', defs)
  if (!body) return Promise.resolve(null)
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
      c.width = Math.max(1, Math.round(w))
      c.height = Math.max(1, Math.round(h))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
