/**
 * Compose SVG builder — walks the layer stack and emits an SVG string.
 *
 * Used for live export (PNG / SVG download). The runtime canvas renders
 * layers as DOM (LayerRenderer) — this module re-implements the same
 * visual semantics in SVG so downloaded files match what the user sees.
 *
 * Layer types handled: background / pattern / photo / shape / text. Text
 * carries full Type Lab typography props (cut, weight, italic, size,
 * tracking, lineHeight, case, textAlign).
 *
 * Reuses Compositor's `downloadCompositionSvg` / `downloadCompositionPng`
 * for the actual blob/canvas plumbing — those are generic SVG helpers.
 */

import logomarkRaw    from '../../brand/logos/svg/kol-logomark.svg?raw'
import wordmarkRaw    from '../../brand/logos/svg/kol-wordmark.svg?raw'
import lockupHoriRaw  from '../../brand/logos/svg/kol-lockup-hori.svg?raw'
import lockupVertRaw  from '../../brand/logos/svg/kol-lockup-vert.svg?raw'
import { ASPECTS }    from '../shell/aspects'
import { resolveColor, CANVAS_W } from './state'
import { familyFor }  from '../modes/type/cuts'
import { buildPatternSvg } from '../modes/pattern/render'
import { getShapeSvg }     from '../modes/pattern/shapes'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'
import { pathD } from './path-math'
import { loopById } from '../../loops/registry'
import { transport } from '../params/transport'

const LOGO_RAW = {
  logomark:      logomarkRaw,
  wordmark:      wordmarkRaw,
  'lockup-hori': lockupHoriRaw,
  'lockup-vert': lockupVertRaw,
}

const DEFAULT_VIEW_BOX = '0 0 100 100'

function parseSvg(raw) {
  if (!raw) return { viewBox: DEFAULT_VIEW_BOX, body: '' }
  const vb    = raw.match(/viewBox=["']([^"']+)["']/i)?.[1] ?? DEFAULT_VIEW_BOX
  const inner = raw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)?.[1]?.trim() ?? ''
  return { viewBox: vb, body: inner }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function aspectToWH(aspect, customRatio) {
  const found = ASPECTS.find((a) => a.id === aspect) ?? ASPECTS[0]
  const ratio = aspect === 'custom' ? (customRatio || 1) : found.ratio
  return { w: CANVAS_W, h: Math.round(CANVAS_W / ratio) }
}

function wrap(layer, body) {
  if (!body) return ''
  const opacity   = layer.opacity ?? 1
  const blend     = layer.blend && layer.blend !== 'normal' ? layer.blend : null
  const styleAttr = blend ? ` style="mix-blend-mode: ${blend}"` : ''
  const opAttr    = opacity < 1 ? ` opacity="${opacity.toFixed(3)}"` : ''
  /* rotation + flipX/flipY about the layer's bbox center — matches the DOM
   * renderer's `rotate() scale()` (center origin, mirror-then-rotate).
   * Transform props are only ever set on layers with numeric bounds. */
  let xformAttr = ''
  const rot = typeof layer.rotation === 'number' ? layer.rotation : 0  /* animated rotation exports at base */
  if ((rot || layer.flipX || layer.flipY) && layer.x != null && layer.w != null) {
    const cx = layer.x + layer.w / 2
    const cy = layer.y + layer.h / 2
    const rotPart  = rot ? ` rotate(${rot.toFixed(2)})` : ''
    const flipPart = (layer.flipX || layer.flipY)
      ? ` scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`
      : ''
    xformAttr = ` transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})${rotPart}${flipPart} translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})"`
  }
  return `<g${opAttr}${styleAttr}${xformAttr}>${body}</g>`
}

function backgroundLayerSvg(layer, palette, w, h) {
  const color = resolveColor(layer.color, palette) ?? '#000000'
  return `<rect width="${w}" height="${h}" fill="${color}"/>`
}

function patternLayerSvg(layer, palette, w, h, idx) {
  const shapeSvg = getShapeSvg(layer.shapeId, layer.customSvg)
  if (!shapeSvg) return ''
  const color  = resolveColor(layer.color, palette) ?? '#FFFFFF'
  const bg     = layer.bgOn ? (resolveColor(layer.bg, palette) ?? null) : null
  const stroke = resolveColor(layer.stroke, palette)
  const sw     = layer.strokeWidth ?? 0
  const scale  = layer.scale ?? 256
  const tile = buildPatternSvg({
    shapeSvg,
    cols:     layer.cols,
    rows:     layer.rows,
    gap:      layer.gap,
    padding:  layer.padding,
    stretch:  layer.stretch,
    overflow: layer.overflow,
    rules:    layer.rules ?? [],
    color,
    bg,
    stroke:      sw > 0 ? stroke : null,
    strokeWidth: sw,
    size:        scale,
  })
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(tile)}`
  const id = `kol-compose-pattern-${idx}`
  const def = `<pattern id="${id}" x="0" y="0" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse"><image href="${dataUrl}" x="0" y="0" width="${scale}" height="${scale}"/></pattern>`
  /* Phase 1b: positioned. Defensive defaults fall back to full-canvas for
   * any pre-1b data lacking bounds. */
  const lx = layer.x ?? 0
  const ly = layer.y ?? 0
  const lw = layer.w ?? w
  const lh = layer.h ?? h
  const fill = `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="url(#${id})"/>`
  return { def, body: fill }
}

function photoLayerSvg(layer, w, h, idx, defs) {
  if (!layer.src) return ''
  const lx = layer.x ?? 0
  const ly = layer.y ?? 0
  const lw = layer.w ?? w
  const lh = layer.h ?? h
  /* Filtered photo — snapshot the LIVE filter canvas (same idiom as engine
   * loops): the DOM renderer owns the pixels; re-running a filter offscreen
   * would duplicate sim state (dither free-runs). Falls through to the plain
   * photo paths when no canvas is mounted (crop active renders as <img>). */
  if (layer.filterId && layer.imgW == null && typeof document !== 'undefined') {
    const live = document.querySelector(`canvas[data-layer-id="${layer.id}"]`)
    if (live) return `<image href="${escapeXml(live.toDataURL('image/png'))}" x="${lx}" y="${ly}" width="${lw}" height="${lh}"/>`
  }
  /* Cropped photo — explicit crop window (imgX/Y/W/H frame-local): image
   * at its own rect, clipped to the frame. Mirrors PhotoLayer's cropped
   * branch. */
  if (layer.imgW != null && layer.w != null) {
    const clipId = `kol-crop-${idx}`
    defs.push(`<clipPath id="${clipId}"><rect x="${lx}" y="${ly}" width="${lw}" height="${lh}"/></clipPath>`)
    return `<g clip-path="url(#${clipId})"><image href="${escapeXml(layer.src)}" x="${(lx + layer.imgX).toFixed(2)}" y="${(ly + layer.imgY).toFixed(2)}" width="${layer.imgW.toFixed(2)}" height="${layer.imgH.toFixed(2)}" preserveAspectRatio="none"/></g>`
  }
  const par = layer.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
  return `<image href="${escapeXml(layer.src)}" x="${lx}" y="${ly}" width="${lw}" height="${lh}" preserveAspectRatio="${par}"/>`
}

/* Shape layers emit by `kind`:
 *   - `logo`    — brand logo SVG, scaled to fit width, centered vertically.
 *   - `flatten` — pre-rendered SVG content stored on the layer; embed as
 *                 a nested `<svg>` positioned at the layer's bounds. `fit`
 *                 controls preserveAspectRatio (fill = stretch, contain =
 *                 preserve aspect).
 * Future kinds (primitive, customSvg) plug in here. */
const FIT_PAR_EXPORT = { fill: 'none', contain: 'xMidYMid meet' }

function shapeLayerSvg(layer, palette) {
  const kind = layer.kind ?? 'logo'

  if (kind === 'flatten' && layer.svg) {
    const { viewBox, body } = parseSvg(layer.svg)
    const par = FIT_PAR_EXPORT[layer.fit ?? 'fill'] ?? 'none'
    /* Wrap in a <g style="color: ..."> so the inner SVG's fill="currentColor"
     * resolves correctly in standalone export. */
    const color = resolveColor(layer.color, palette)
    const colorStyle = color ? ` style="color: ${color}"` : ''
    return `<g${colorStyle}><svg x="${(layer.x ?? 0).toFixed(2)}" y="${(layer.y ?? 0).toFixed(2)}" width="${(layer.w ?? 0).toFixed(2)}" height="${(layer.h ?? 0).toFixed(2)}" viewBox="${viewBox}" preserveAspectRatio="${par}">${body}</svg></g>`
  }

  if (kind === 'rect' || kind === 'ellipse' || kind === 'triangle' || kind === 'polygon' || kind === 'star') {
    const fill   = layer.color === null ? 'none' : (resolveColor(layer.color, palette) ?? '#FFFFFF')
    const stroke = resolveColor(layer.stroke, palette)
    const sw     = layer.strokeWidth ?? 0
    const half   = sw > 0 ? sw / 2 : 0
    const lx = layer.x ?? 0
    const ly = layer.y ?? 0
    const lw = layer.w ?? 0
    const lh = layer.h ?? 0
    const strokeAttrs = stroke
      ? ` stroke="${stroke}" stroke-width="${sw}"` +
        (layer.strokeDasharray ? ` stroke-dasharray="${layer.strokeDasharray}"` : '') +
        (layer.strokeLinecap   ? ` stroke-linecap="${layer.strokeLinecap}"`     : '') +
        (layer.strokeLinejoin  ? ` stroke-linejoin="${layer.strokeLinejoin}"`   : '')
      : ''
    if (kind === 'rect') {
      const x = lx + half
      const y = ly + half
      const w = Math.max(0, lw - sw)
      const h = Math.max(0, lh - sw)
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill}"${strokeAttrs}/>`
    }
    if (kind === 'ellipse') {
      const cx = lx + lw / 2
      const cy = ly + lh / 2
      const rx = Math.max(0, lw / 2 - half)
      const ry = Math.max(0, lh / 2 - half)
      return `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${fill}"${strokeAttrs}/>`
    }
    /* polygon-style shapes share a translate-and-points pattern. */
    let pts
    if (kind === 'triangle') pts = trianglePoints(lw, lh, half)
    else if (kind === 'polygon') pts = regularPolygonPoints(lw, lh, layer.sides ?? 5, half)
    else                        pts = starPoints(lw, lh, layer.points ?? 5, layer.innerRatio ?? 0.5, half)
    return `<polygon transform="translate(${lx.toFixed(2)} ${ly.toFixed(2)})" points="${pts}" fill="${fill}"${strokeAttrs}/>`
  }

  if (kind === 'line') {
    const stroke = resolveColor(layer.stroke, palette) ?? resolveColor(layer.color, palette) ?? '#000000'
    const sw     = layer.strokeWidth ?? 2
    const half   = sw / 2
    const lx = layer.x ?? 0
    const ly = layer.y ?? 0
    const lw = layer.w ?? 0
    const lh = layer.h ?? 0
    const slope = layer.slope ?? '\\'
    const x1 = lx + half
    const y1 = slope === '/' ? ly + lh - half : ly + half
    const x2 = lx + lw - half
    const y2 = slope === '/' ? ly + half      : ly + lh - half
    const cap = layer.strokeLinecap ?? 'round'
    const dash = layer.strokeDasharray ? ` stroke-dasharray="${layer.strokeDasharray}"` : ''
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}"${dash}/>`
  }

  /* logo (default) */
  const raw = LOGO_RAW[layer.variant ?? 'logomark']
  if (!raw) return ''
  const color = resolveColor(layer.color, palette) ?? '#FFFFFF'
  const { viewBox, body } = parseSvg(raw)
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number)
  /* preserve aspect: scale uniformly to fit width, vertically center inside layer.h */
  const scale = layer.w / vbW
  const renderedH = vbH * scale
  const dy = (layer.h - renderedH) / 2
  const strokeColor = resolveColor(layer.stroke, palette)
  const sw          = layer.strokeWidth ?? 0
  const styleParts  = [`color: ${color}`]
  if (strokeColor && sw > 0) {
    styleParts.push(`stroke: ${strokeColor}`, `stroke-width: ${sw / scale}`, 'paint-order: stroke fill')
    if (layer.strokeLinecap)  styleParts.push(`stroke-linecap: ${layer.strokeLinecap}`)
    if (layer.strokeLinejoin) styleParts.push(`stroke-linejoin: ${layer.strokeLinejoin}`)
  }
  return `<g transform="translate(${layer.x.toFixed(2)} ${(layer.y + dy).toFixed(2)}) scale(${scale.toFixed(4)})" style="${styleParts.join('; ')}">${body}</g>`
}

/* Path layer — mirrors LayerRenderer's PathLayer: nodes are layer-local,
 * drawn 1:1 inside a translate to {x,y}. Fill follows the shape convention
 * (`null` = explicit no-fill); stroke falls back to the fill color when
 * stroked but colorless (the DOM `currentColor` behavior). */
function pathLayerSvg(layer, palette) {
  const hasHoles = (layer.holes?.length ?? 0) > 0
  const d = hasHoles
    ? [layer.nodes ?? [], ...layer.holes].map((r) => pathD(r, true)).join(' ')
    : pathD(layer.nodes ?? [], layer.closed)
  if (!d) return ''
  const hasFill     = layer.color !== null
  const fill        = hasFill ? (resolveColor(layer.color, palette) ?? '#FFFFFF') : 'none'
  const strokeColor = resolveColor(layer.stroke, palette)
  const sw          = layer.strokeWidth ?? 0
  const strokeAttrs = sw > 0
    ? ` stroke="${strokeColor ?? (hasFill ? fill : 'none')}" stroke-width="${sw}"` +
      ` stroke-linecap="${layer.strokeLinecap ?? 'round'}" stroke-linejoin="${layer.strokeLinejoin ?? 'round'}"` +
      (layer.strokeDasharray ? ` stroke-dasharray="${layer.strokeDasharray}"` : '')
    : ''
  const fillRuleAttr = hasHoles ? ' fill-rule="evenodd"' : ''
  return `<path transform="translate(${(layer.x ?? 0).toFixed(2)} ${(layer.y ?? 0).toFixed(2)})" d="${d}" fill="${fill}"${fillRuleAttr}${strokeAttrs}/>`
}

function textLayerSvg(layer, palette) {
  const color       = resolveColor(layer.color, palette) ?? '#FFFFFF'
  const strokeColor = resolveColor(layer.stroke, palette)
  const sw          = layer.strokeWidth ?? 0
  const family = `'${familyFor(layer.width ?? 'Tight')}', 'Right Grotesk', sans-serif`
  const weight = layer.weight ?? 600
  const italic = layer.italic ? 'italic' : 'normal'
  const size   = layer.size ?? 96
  const track  = layer.tracking ?? -0.01
  const lh     = layer.lineHeight ?? 1.05
  const tcase  = layer.case === 'upper' ? 'uppercase' : layer.case === 'lower' ? 'lowercase' : 'none'
  const align  = layer.textAlign ?? 'center'
  const text   = escapeXml(layer.text ?? '').replace(/\n/g, '<br/>')
  const strokeCss = strokeColor && sw > 0
    ? `-webkit-text-stroke:${sw}px ${strokeColor};paint-order:stroke fill;`
    : ''
  return `<foreignObject x="${layer.x.toFixed(2)}" y="${layer.y.toFixed(2)}" width="${layer.w.toFixed(2)}" height="${layer.h.toFixed(2)}">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;font-family:${family};font-weight:${weight};font-style:${italic};font-size:${size}px;letter-spacing:${track}em;line-height:${lh};text-transform:${tcase};text-align:${align};color:${color};${strokeCss}white-space:pre-wrap;word-wrap:break-word;">${text}</div>
</foreignObject>`
}

/* Loop layer — rasterize the loop's CURRENT frame (transport t) to a data
 * URL and embed as <image>, mirroring the photo path. Vector export of a
 * canvas2d draw fn isn't possible; a 2× raster snapshot matches what the
 * user sees. */
function loopLayerSvg(layer) {
  const loop = loopById(layer.loopId)
  if (!loop || typeof document === 'undefined') return ''
  const lw = Math.max(1, layer.w ?? 0)
  const lh = Math.max(1, layer.h ?? 0)
  const x = (layer.x ?? 0).toFixed(2)
  const y = (layer.y ?? 0).toFixed(2)
  /* Engine (GL) loops: snapshot the LIVE layer canvas — every engine renders
   * with preserveDrawingBuffer, so toDataURL captures the current frame.
   * Spinning a throwaway engine offscreen per export would drag the whole GL
   * stack in for one frame. */
  if (loop.kind === 'engine') {
    const live = document.querySelector(`canvas[data-layer-id="${layer.id}"]`)
    if (!live) return ''
    return `<image href="${escapeXml(live.toDataURL('image/png'))}" x="${x}" y="${y}" width="${lw.toFixed(2)}" height="${lh.toFixed(2)}"/>`
  }
  const scale = 2
  const c = document.createElement('canvas')
  c.width = Math.round(lw * scale)
  c.height = Math.round(lh * scale)
  const g = c.getContext('2d')
  g.scale(scale, scale)
  loop.draw(g, transport.getT(), lw, lh, layer)
  return `<image href="${escapeXml(c.toDataURL('image/png'))}" x="${x}" y="${y}" width="${lw.toFixed(2)}" height="${lh.toFixed(2)}"/>`
}

/* Recursive group export: a `<g transform="translate(gx gy)">` containing
 * each child's wrapped body. Children's own x/y/w/h are group-relative;
 * the translate restores canvas-absolute positioning. */
function groupLayerSvg(layer, palette, w, h, idx, defs) {
  const gx = layer.x ?? 0
  const gy = layer.y ?? 0
  const childBodies = (layer.children ?? [])
    .map((child, i) => layerToSvg(child, palette, w, h, `${idx}-${i}`, defs))
    .filter(Boolean)
    .join('\n')
  if (!childBodies) return ''
  return `<g transform="translate(${gx} ${gy})">${childBodies}</g>`
}

/* Per-layer dispatch + opacity/blend wrap. Returns the wrapped body string,
 * or empty string for invisible / unrenderable layers. Mutates `defs`
 * (pattern layer pushes a `<pattern>` def). */
function layerToSvg(layer, palette, w, h, idx, defs) {
  if (!layer.visible) return ''
  let body = ''
  switch (layer.type) {
    case 'background': body = backgroundLayerSvg(layer, palette, w, h); break
    case 'pattern': {
      const out = patternLayerSvg(layer, palette, w, h, idx)
      if (out) { defs.push(out.def); body = out.body }
      break
    }
    case 'photo':      body = photoLayerSvg(layer, w, h, idx, defs); break
    case 'shape':      body = shapeLayerSvg(layer, palette); break
    case 'path':       body = pathLayerSvg(layer, palette); break
    case 'text':       body = textLayerSvg(layer, palette); break
    case 'group':      body = groupLayerSvg(layer, palette, w, h, idx, defs); break
    case 'loop':       body = loopLayerSvg(layer); break
    default: break
  }
  if (!body) return ''
  return wrap(layer, body)
}

export function buildLayersSvg({ layers, palette, aspect = '1:1', customRatio = null, canvasW = null, canvasH = null }) {
  /* Virtual coordinate space (what layers are positioned in) stays at the
   * 1080-wide baseline; the SVG's width/height carry the real output pixels.
   * viewBox = virtual, so a 1920×1080 export just scales the same geometry —
   * no per-layer coordinate change. Falls back to aspect when no explicit
   * dimensions are passed (legacy callers). */
  const useDims = canvasW > 0 && canvasH > 0
  const vw = CANVAS_W
  const vh = useDims ? Math.round(CANVAS_W * (canvasH / canvasW)) : aspectToWH(aspect, customRatio).h
  const outW = useDims ? canvasW : vw
  const outH = useDims ? canvasH : vh

  const defs = []
  const bodies = []

  layers.forEach((layer, idx) => {
    const body = layerToSvg(layer, palette, vw, vh, idx, defs)
    if (body) bodies.push(body)
  })

  const defsBlock = defs.length ? `<defs>${defs.join('')}</defs>` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${vw} ${vh}">
${defsBlock}
${bodies.join('\n')}
</svg>`
}

/* Generic blob/canvas helpers for SVG + PNG download. Inlined here after
 * Compositor lab folded into Compose; previously these lived in
 * `compositor/build.js`. */
export function downloadComposeSvg(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadComposePng(svgString, filename, scale = 1) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const img  = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = (img.width  || 1080) * scale
    canvas.height = (img.height || 1080) * scale
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return
      const pngUrl = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href     = pngUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}
