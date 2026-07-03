import { useEffect, useMemo, useRef, useState } from 'react'
import KolLogo from '../../brand/logos/KolLogo'
import TypeBlock from '../../components/styleguide/TypeBlock'
import { buildPatternSvg } from '../modes/pattern/render'
import { getShapeSvg } from '../modes/pattern/shapes'
import { resolveColor, COVER_TYPES, useComposeState } from './state'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'
import { pathD } from './path-math'
import { computeBooleanCached } from './boolean-ops'
import { hasBindings, resolveLayer } from '../params/resolve'
import { useTransportCtx, transport } from '../params/transport'
import { loopById, loopDrawParams } from '../../loops/registry'
import { filterById } from '../../filters'
import { rasterizeLayer, sourceKey } from './rasterizeLayer'
import KineticType from '../../kinetic/KineticType'
import { loadFonts as loadKineticFonts, warmFontCss as warmKineticFontCss } from '../../kinetic/fonts'

/**
 * LayerRenderer — renders a single layer as a positioned DOM element inside
 * the 1080-virtual canvas.
 *
 * Cover types (background / pattern / photo) fill the canvas and aren't
 * draggable. Positioned types (shape / text) use explicit {x, y, w, h}
 * virtual coords; pointer events bubble up to CanvasArea which owns the
 * drag state.
 *
 * `data-layer-id` on every interactive element so the canvas's pointer
 * router can identify the target.
 */

export default function LayerRenderer({ layer: rawLayer, palette }) {
  /* Resolve any animated/modulated props to concrete values for this frame.
   * Static layers (the whole editor today) skip the subscription entirely —
   * `useTransportCtx(false)` never re-renders — so there's zero cost until a
   * prop is bound. Hook is called unconditionally (rules of hooks); the flag
   * just gates whether it subscribes. */
  const animated = hasBindings(rawLayer)
  const ctx = useTransportCtx(animated)
  const layer = animated ? resolveLayer(rawLayer, ctx) : rawLayer

  if (!layer.visible) return null

  /* rotation (deg, clockwise) + flipX/flipY compose about the layer's own
   * center (default transform origin): mirror in the local frame first,
   * then rotate — same order the SVG export emits. Paths never carry flip
   * flags (baked into nodes); they may carry live rotation, which node-edit
   * entry bakes. */
  const rot  = layer.rotation ?? 0
  const flip = layer.flipX || layer.flipY
  const layerStyle = {
    opacity:      layer.opacity ?? 1,
    mixBlendMode: layer.blend && layer.blend !== 'normal' ? layer.blend : undefined,
    transform: (rot || flip)
      ? `${rot ? `rotate(${rot}deg)` : ''}${flip ? ` scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` : ''}`.trim()
      : undefined,
  }

  switch (layer.type) {
    case 'background': return <BackgroundLayer layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'pattern': {
      const fx = effectFor(layer)
      return fx
        ? <EffectedLayer layer={layer} filter={fx} palette={palette} layerStyle={layerStyle} />
        : <PatternLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
    }
    case 'photo': {
      /* Filtered photo → live filter canvas. Cropped photos (imgW set) ignore
       * filters in v1 — the crop branch's frame-local image math doesn't
       * compose with the fitted-source pipeline; plain photo render wins. */
      const filter = layer.src && layer.imgW == null && layer.w != null ? filterById(layer.filterId) : null
      if (filter?.kind === 'engine') return <EngineFilterLayer layer={layer} filter={filter} layerStyle={layerStyle} />
      return filter
        ? <FilteredPhotoLayer layer={layer} filter={filter} layerStyle={layerStyle} />
        : <PhotoLayer         layer={layer}                 layerStyle={layerStyle} />
    }
    case 'shape':
    case 'path':
    case 'bool':
    case 'text': {
      /* Universal effects (Phase 7): any positioned vector layer with a
       * canvas filter renders through EffectedLayer (its own SVG raster is
       * the filter source). Engine (GL) filters stay photo-only in v1. */
      const fx = effectFor(layer)
      if (fx) return <EffectedLayer layer={layer} filter={fx} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'shape') return <ShapeLayer layer={layer} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'path')  return <PathLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'bool')  return <BoolLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
      return <TextLayer layer={layer} palette={palette} layerStyle={layerStyle} />
    }
    case 'group':      return <GroupLayer      layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'loop': {
      const def = loopById(layer.loopId)
      if (def?.kind === 'engine') return <EngineLoopLayer layer={layer} def={def} layerStyle={layerStyle} />
      const fx = effectFor(layer)
      if (fx) return <EffectedLayer layer={layer} filter={fx} palette={palette} layerStyle={layerStyle} />
      return <LoopLayer layer={layer} layerStyle={layerStyle} />
    }
    case 'kinetic':    return <KineticLayer layer={layer} layerStyle={layerStyle} />
    default:           return null
  }
}

/* Kinetic-type layer — a labs TYPE composition on the ported KineticType
 * engine (src/kinetic), which renders live SVG <text> glyphs into a
 * positioned host div. Externally driven like the loop hosts: transport-
 * subscribed, renderAt(u) per render, comp/size re-applied on change,
 * disposed on unmount. The engine's SVG is pointer-inert; the host div
 * carries data-layer-id for selection/drag. `data-kinetic-host` is the
 * export hook — build.js serializes the live SVG subtree from it. */
function KineticLayer({ layer, layerStyle }) {
  const hostRef = useRef(null)
  const rig = useRef(null)          /* { engine, w, h, comp } */
  const tctx = useTransportCtx(true)

  useEffect(() => {
    if (!hostRef.current) return undefined
    loadKineticFonts()              /* idempotent FontFace registration */
    warmKineticFontCss()            /* pre-bake @font-face css for export */
    const engine = new KineticType(hostRef.current)
    rig.current = { engine, w: 0, h: 0, comp: null }
    return () => {
      rig.current?.engine.dispose()
      rig.current = null
    }
  }, [])

  useEffect(() => {
    const r = rig.current
    if (!r) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    if (w !== r.w || h !== r.h) { r.engine.resize(w, h); r.w = w; r.h = h }
    if (r.comp !== layer.comp) { r.engine.setComposition(layer.comp); r.comp = layer.comp }
    r.engine.renderAt(tctx.t)
  })

  return (
    <div
      ref={hostRef}
      data-layer-id={layer.id}
      data-kinetic-host=""
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        overflow: 'hidden',
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

/* The layer's active CANVAS effect, or null. Engine (GL) filters need a GL
 * source path — photo-only in v1. */
function effectFor(layer) {
  if (!layer.filterId || layer.w == null) return null
  const f = filterById(layer.filterId)
  return f && f.kind !== 'engine' ? f : null
}

/* Effected layer — ANY positioned layer run through a canvas image filter
 * (Phase 7). The layer's own render is the filter source:
 *   - 2d loops: `loop.draw` is synchronous → drawn into a reused source
 *     canvas every frame (live animation flows through the filter).
 *   - SVG types (shape/path/text/pattern): rasterized async via
 *     rasterizeLayer, cached by sourceKey — content edits re-raster, filter
 *     param edits do NOT.
 * Host mirrors FilteredPhotoLayer: transport-subscribed per the filter's
 * `animated` flag (always for loops), dpr backing, data-layer-id. */
function EffectedLayer({ layer, filter, palette, layerStyle }) {
  const canvasRef = useRef(null)
  const srcRef = useRef(null)       /* { key, canvas } (svg) | { canvas } (loop) */
  const lastDraw = useRef(null)
  const [, forceDraw] = useState(0)
  const isLoop = layer.type === 'loop'
  const tctx = useTransportCtx(isLoop || filter.animated !== false)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    /* — source — */
    let src = null
    if (isLoop) {
      const loop = loopById(layer.loopId)
      if (!loop) return
      /* Skip identical redraws (see LoopLayer) — same layer, same t, same
       * loop means loop.draw + filter.apply would repaint the same pixels. */
      const sig = [cv, loop, layer, tctx.t, dpr]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
      let sc = srcRef.current?.canvas
      if (!sc || sc.width !== w || sc.height !== h) {
        sc = document.createElement('canvas')
        sc.width = w
        sc.height = h
        srcRef.current = { canvas: sc }
      }
      const sg = sc.getContext('2d')
      sg.setTransform(1, 0, 0, 1, 0, 0)
      const params = loopDrawParams(loop, layer)
      sg.clearRect(0, 0, w, h)
      loop.draw(sg, tctx.t, w, h, params)
      src = sc
    } else {
      const key = `${sourceKey(layer, palette)}|${w}x${h}`
      if (srcRef.current?.key === key) {
        src = srcRef.current.canvas
      } else if (srcRef.current?.pending !== key) {
        srcRef.current = { ...(srcRef.current ?? {}), pending: key }
        rasterizeLayer(layer, palette, w, h).then((c) => {
          if (srcRef.current?.pending !== key) return   /* superseded */
          srcRef.current = { key, canvas: c }
          forceDraw((n) => n + 1)
        })
        src = srcRef.current.canvas ?? null   /* stale frame while decoding */
      } else {
        src = srcRef.current.canvas ?? null
      }
    }
    if (!src) return
    /* Svg branch: skip identical filter passes — src identity is part of the
     * signature so the async raster landing (forceDraw) still paints. */
    if (!isLoop) {
      const sig = [cv, filter, layer, palette, tctx.t, dpr, src]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
    }

    /* — filter into the layer canvas — */
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    filter.apply(g, src, w, h, layer, tctx.t)
  })

  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Engine loop layer — a GL loop (three.js engine) on the same positioned-
 * canvas host. The heavy module (three + engines) loads lazily on first
 * mount via gl/host.js; until then the canvas is blank. Engine lifecycle
 * is tied to loopId (family swap = rebuild); params re-apply and one frame
 * drives on every render. drive:'dt' engines advance only while the
 * transport plays (dt=0 repaints the held frame). */
function EngineLoopLayer({ layer, def, layerStyle }) {
  const canvasRef = useRef(null)
  const rig = useRef(null)          /* { host, engine, w, h } */
  const lastTs = useRef(null)
  const [, forceDraw] = useState(0)
  const tctx = useTransportCtx(true)

  useEffect(() => {
    let dead = false
    import('../../loops/gl/host.js').then((host) => {
      if (dead || !canvasRef.current) return
      const engine = host.createEngine(def, canvasRef.current)
      rig.current = { host, engine, w: 0, h: 0 }
      forceDraw((n) => n + 1)   /* re-run the draw effect now that the rig exists */
    })
    return () => {
      dead = true
      rig.current?.host.destroyEngine(rig.current.engine)
      rig.current = null
      lastTs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.loopId])

  useEffect(() => {
    const r = rig.current
    if (!r) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    if (w !== r.w || h !== r.h) { r.engine.resize(w, h); r.w = w; r.h = h }
    r.host.applyParams(def, r.engine, layer)
    r.host.setCameraDrag?.(def, r.engine, def.orbit && !!layer.cameraDrag)
    const now = performance.now()
    const dt = transport.isPlaying() && lastTs.current != null ? (now - lastTs.current) / 1000 : 0
    lastTs.current = now
    r.host.driveEngine(def, r.engine, { u: tctx.t, dt })
  })

  /* Camera drag on: the engine's OrbitControls own the pointer — swallow
   * events so CanvasArea's move-drag router never sees them. */
  const camDrag = def.orbit && !!layer.cameraDrag
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      onPointerDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      onMouseDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camDrag ? 'grab' : 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Loop layer — an imported generative loop (src/loops) drawn to a positioned
 * <canvas>. Time-driven by design, so it always subscribes to the transport:
 * play advances `u`, seek/pause snap to a frame, param edits redraw via the
 * normal re-render. Draw runs after every render (sub-ms canvas2d fills at
 * layer size).
 * ponytail: canvas backing = layer px × dpr (≤2) — soft under deep zoom-in;
 * scale by CanvasZoomContext if it ever reads blurry. */
function LoopLayer({ layer, layerStyle }) {
  const canvasRef = useRef(null)
  const lastDraw = useRef(null)
  const tctx = useTransportCtx(true)
  useEffect(() => {
    const cv = canvasRef.current
    const loop = loopById(layer.loopId)
    if (!cv || !loop) return
    const w = Math.max(1, layer.w ?? 1)
    const h = Math.max(1, layer.h ?? 1)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    /* Skip identical redraws. Renders reach here with everything unchanged —
     * paused transport notifies on every mousemove, and dragging ANY layer
     * re-renders the whole stack — and a field loop repaint is 10-100ms.
     * Unbound layers keep object identity across unrelated re-renders, so
     * this signature only misses when a redraw would actually differ. */
    const sig = [cv, loop, layer, tctx.t, dpr]
    if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
    lastDraw.current = sig
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    /* bgOn === false → bg param suppressed to transparent; the loop's own
     * backdrop fill no longer clears the canvas, so clear it here. */
    const params = loopDrawParams(loop, layer)
    if (params !== layer) g.clearRect(0, 0, w, h)
    loop.draw(g, tctx.t, w, h, params)
  })
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Group layer — translates a positioned container; children render at
 * their group-relative coords. data-layer-id on the container so
 * clicking the group selects it (children's own data-layer-id still
 * wins via .closest() bubbling, so clicking a child selects the child). */
function GroupLayer({ layer, palette, layerStyle }) {
  return (
    <div
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x ?? 0, top: layer.y ?? 0,
        width: layer.w ?? '100%', height: layer.h ?? '100%',
        cursor: 'move',
        ...layerStyle,
      }}
    >
      {(layer.children ?? []).map((child) => (
        <LayerRenderer key={child.id} layer={child} palette={palette} />
      ))}
    </div>
  )
}

function BackgroundLayer({ layer, palette, layerStyle }) {
  const color = resolveColor(layer.color, palette) ?? '#000000'
  return (
    <div
      data-layer-id={layer.id}
      data-layer-cover="true"
      style={{
        position: 'absolute', inset: 0,
        background: color,
        cursor: 'pointer',
        ...layerStyle,
      }}
    />
  )
}

/**
 * Pattern layer — builds a tile SVG via Pattern Lab's `buildPatternSvg` from
 * the layer's authored params (layer is self-contained, no spec snapshot).
 * The SVG is memoized by serialized params so the rules engine doesn't re-run
 * on unrelated re-renders. `currentColor` in the rendered tile resolves to
 * the layer's `color`; bg only renders when `bgOn`.
 *
 * Phase 1b: positioned. Renders at layer.x/y/w/h. Defensive defaults
 * fall back to full-canvas (inset:0 equivalent) for any pre-1b data
 * lacking bounds.
 */
function PatternLayer({ layer, palette, layerStyle }) {
  const color  = resolveColor(layer.color, palette) ?? '#FFFFFF'
  const bg     = layer.bgOn ? (resolveColor(layer.bg, palette) ?? null) : null
  const stroke = resolveColor(layer.stroke, palette)
  const sw     = layer.strokeWidth ?? 0

  const tileSize = layer.scale ?? 256

  const svg = useMemo(() => {
    const shapeSvg = getShapeSvg(layer.shapeId, layer.customSvg)
    if (!shapeSvg) return null
    return buildPatternSvg({
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
      size:        tileSize,
    })
  }, [
    layer.shapeId, layer.customSvg, layer.cols, layer.rows, layer.gap,
    layer.padding, layer.stretch, layer.overflow, layer.rules,
    color, bg, stroke, sw, tileSize,
  ])

  const hasBounds = layer.w != null && layer.h != null
  const positionStyle = hasBounds
    ? { left: layer.x, top: layer.y, width: layer.w, height: layer.h }
    : { inset: 0 }

  return (
    <div
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        ...positionStyle,
        backgroundColor: 'transparent',
        backgroundImage: svg
          ? `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
          : 'none',
        backgroundSize: `${tileSize}px ${tileSize}px`,
        backgroundRepeat: 'repeat',
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

function PhotoLayer({ layer, layerStyle }) {
  if (!layer.src) return null
  const hasBounds = layer.w != null && layer.h != null
  /* Video source — a positioned <video> element plays on its own (no canvas,
   * no per-frame JS). Crop is excluded for video (crop math assumes a still),
   * so any leftover imgW from a previous image src is ignored. The ref
   * re-asserts `muted` — React drops the attribute and Chrome refuses
   * autoplay without it. */
  if (layer.srcType === 'video') {
    const positionStyle = hasBounds
      ? { left: layer.x, top: layer.y, width: layer.w, height: layer.h }
      : { inset: 0, width: '100%', height: '100%' }
    return (
      <video
        src={layer.src}
        data-layer-id={layer.id}
        autoPlay loop muted playsInline
        ref={(el) => { if (el) el.muted = true }}
        style={{
          position: 'absolute',
          ...positionStyle,
          objectFit: layer.fit ?? 'cover',
          cursor: 'move',
          ...layerStyle,
        }}
      />
    )
  }
  /* Cropped photo — explicit crop window: the image draws at its own
   * frame-local rect inside an overflow-hidden frame. Set by crop mode
   * (CropOverlay); absent = legacy object-fit render below. */
  if (hasBounds && layer.imgW != null) {
    return (
      <div
        data-layer-id={layer.id}
        style={{
          position: 'absolute',
          left: layer.x, top: layer.y,
          width: layer.w, height: layer.h,
          overflow: 'hidden',
          cursor: 'move',
          ...layerStyle,
        }}
      >
        <img
          src={layer.src} alt="" draggable={false}
          style={{
            position: 'absolute',
            left: layer.imgX, top: layer.imgY,
            width: layer.imgW, height: layer.imgH,
            maxWidth: 'none',
          }}
        />
      </div>
    )
  }
  const positionStyle = hasBounds
    ? { left: layer.x, top: layer.y, width: layer.w, height: layer.h }
    : { inset: 0, width: '100%', height: '100%' }
  return (
    <img
      src={layer.src}
      alt=""
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        ...positionStyle,
        objectFit: layer.fit ?? 'cover',
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Draw a media element (image or the video's current frame) into canvas `c`,
 * honoring `fit` (cover / contain / fill). Shared by the one-shot fitted
 * build (stills) and the per-frame GL redraw (video frames advance, the
 * fitted pixels must follow). */
function drawFitted(media, c, fit) {
  const g = c.getContext('2d')
  const sw = media.naturalWidth || media.videoWidth || media.width
  const sh = media.naturalHeight || media.videoHeight || media.height
  g.clearRect(0, 0, c.width, c.height)
  if (fit === 'fill' || !sw || !sh) {
    g.drawImage(media, 0, 0, c.width, c.height)
    return
  }
  const k = fit === 'contain' ? Math.min(c.width / sw, c.height / sh) : Math.max(c.width / sw, c.height / sh)
  const dw = sw * k
  const dh = sh * k
  g.drawImage(media, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
}

/* Fitted-source build for filters: the layer's media drawn into a canvas at
 * the layer's CSS-px size. Always a FRESH canvas — filters key their
 * per-source pixel/luma caches on canvas identity, so a rebuild must change
 * identity. (GL video is the one exception: it redraws IN place via
 * drawFitted + touchSource to keep the CanvasTexture binding.) */
function fitSource(media, w, h, fit) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  drawFitted(media, c, fit)
  return c
}

/* Decode a photo layer's source into a drawable element (the labs
 * ImageContext idiom): image → HTMLImageElement; video → muted looping
 * HTMLVideoElement with .width/.height mirrored from the intrinsic size so
 * it drops in anywhere an image works (drawImage, GL textures). Returns
 * null until decoded. crossOrigin only on absolute http(s) URLs — the
 * /media proxy path is same-origin and object/data URLs never taint. */
function useSourceMedia(src, srcType) {
  const [media, setMedia] = useState(null)
  useEffect(() => {
    if (!src) { setMedia(null); return undefined }
    if (srcType === 'video') {
      const v = document.createElement('video')
      if (/^https?:/.test(src)) v.crossOrigin = 'anonymous'
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.onloadedmetadata = () => {
        v.width = v.videoWidth
        v.height = v.videoHeight
        setMedia(v)
        const pr = v.play()
        if (pr && pr.catch) pr.catch(() => {})
      }
      v.src = src
      return () => {
        v.onloadedmetadata = null
        v.pause()
        v.removeAttribute('src')
        v.load()
        setMedia(null)
      }
    }
    const img = new Image()
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => setMedia(img)
    img.src = src
    return () => { img.onload = null; setMedia(null) }
  }, [src, srcType])
  return media
}

/* Filtered photo layer — the photo run through an image filter (src/filters)
 * on a positioned <canvas>, mirroring LoopLayer's host: transport-subscribed
 * per the filter's `animated` flag, draw runs after every render, backing =
 * layer px × dpr. The decoded media + fitted source canvas are cached and
 * only rebuilt when src / fit / size change — except video, whose frames
 * advance: the fitted source rebuilds FRESH per tick (2d filters key their
 * per-source pixel caches on canvas identity, so an in-place redraw would
 * serve stale base pixels), and the transport subscription is forced on. */
function FilteredPhotoLayer({ layer, filter, layerStyle }) {
  const canvasRef = useRef(null)
  const fittedRef = useRef(null)   /* { key, media, canvas } */
  const lastDraw = useRef(null)
  const isVideo = layer.srcType === 'video'
  const media = useSourceMedia(layer.src, layer.srcType)
  const tctx = useTransportCtx(isVideo || filter.animated !== false)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !media) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    /* Skip identical redraws (see LoopLayer) — stills only: video frames
     * advance outside the transport clock, so video never skips. */
    if (!isVideo) {
      const sig = [cv, filter, layer, media, tctx.t, dpr]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
    }
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const fit = layer.fit ?? 'cover'
    const key = `${w}x${h}|${fit}`
    if (isVideo || !fittedRef.current || fittedRef.current.key !== key || fittedRef.current.media !== media) {
      fittedRef.current = { key, media, canvas: fitSource(media, w, h, fit) }
    }
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    filter.apply(g, fittedRef.current.canvas, w, h, layer, tctx.t)
  })

  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Engine filter layer — a GL image filter (three.js engine, src/filters/gl)
 * on the same host shape as EngineLoopLayer: lazy host import (three stays
 * out of the base bundle), engine lifecycle keyed to filterId, source pushed
 * on fitted-canvas identity change, params re-applied + one drive per render.
 * Synth-style engines are feedback-based → free-running dt drive (advance
 * only while the transport plays; dt=0 repaints the held frame). */
function EngineFilterLayer({ layer, filter, layerStyle }) {
  const canvasRef = useRef(null)
  const rig = useRef(null)          /* { host, engine, w, h, srcCanvas } */
  const fittedRef = useRef(null)    /* { key, media, canvas } */
  const lastTs = useRef(null)
  const [, forceDraw] = useState(0)
  const isVideo = layer.srcType === 'video'
  const media = useSourceMedia(layer.src, layer.srcType)
  const tctx = useTransportCtx(true)

  useEffect(() => {
    let dead = false
    import('../../filters/gl/host.js').then((host) => {
      if (dead || !canvasRef.current) return
      rig.current = { host, engine: host.createEngine(filter, canvasRef.current), w: 0, h: 0, srcCanvas: null }
      forceDraw((n) => n + 1)
    })
    return () => {
      dead = true
      rig.current?.host.destroyEngine(rig.current.engine)
      rig.current = null
      lastTs.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.filterId])

  useEffect(() => {
    const r = rig.current
    if (!r || !media) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const fit = layer.fit ?? 'cover'
    const key = `${w}x${h}|${fit}`
    if (!fittedRef.current || fittedRef.current.key !== key || fittedRef.current.media !== media) {
      fittedRef.current = { key, media, canvas: fitSource(media, w, h, fit) }
    } else if (isVideo) {
      /* Video frames advance — redraw INTO the same canvas so the engine's
       * CanvasTexture binding survives; touchSource below re-uploads it. */
      drawFitted(media, fittedRef.current.canvas, fit)
    }
    if (w !== r.w || h !== r.h) { r.engine.resize(w, h); r.w = w; r.h = h }
    if (r.srcCanvas !== fittedRef.current.canvas) {
      r.host.setSource(filter, r.engine, fittedRef.current.canvas)
      r.srcCanvas = fittedRef.current.canvas
    } else if (isVideo) {
      r.host.touchSource?.(filter, r.engine)
    }
    r.host.applyParams(filter, r.engine, layer)
    r.host.setCameraDrag?.(filter, r.engine, filter.orbit && !!layer.cameraDrag)
    const now = performance.now()
    const dt = transport.isPlaying() && lastTs.current != null ? (now - lastTs.current) / 1000 : 0
    lastTs.current = now
    r.host.driveEngine(filter, r.engine, { u: tctx.t, dt })
  })

  /* Camera drag on: the engine's OrbitControls own the pointer (Rutt-Etra). */
  const camDrag = filter.orbit && !!layer.cameraDrag
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      onPointerDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      onMouseDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camDrag ? 'grab' : 'move',
        ...layerStyle,
      }}
    />
  )
}

/* `fit` controls how shape SVG content fills the layer bounds.
 *   - `fill`    — stretch to bounds (preserveAspectRatio="none"). Default.
 *   - `contain` — preserve aspect, letterboxed (preserveAspectRatio default).
 * Applied at render time by regex-replacing the inner SVG's
 * preserveAspectRatio attribute. */
const FIT_PAR = { fill: 'none', contain: 'xMidYMid meet' }
function applySvgFit(svgString, fit) {
  if (!svgString) return svgString
  const par = FIT_PAR[fit] ?? 'none'
  if (/<svg[^>]*preserveAspectRatio=/i.test(svgString)) {
    return svgString.replace(/(<svg[^>]*?)preserveAspectRatio=["'][^"']*["']/i, `$1preserveAspectRatio="${par}"`)
  }
  return svgString.replace(/<svg([^>]*)>/i, `<svg$1 preserveAspectRatio="${par}">`)
}

/* Shape layers render by `kind`:
 *   - `logo`     — brand logo via KolLogo (default for legacy data).
 *   - `flatten`  — raw SVG content stored on the layer (output of pattern
 *                  / text flatten); inlined via dangerouslySetInnerHTML.
 *   - `rect`     — vector rectangle filling the layer bounds.
 *   - `ellipse`  — vector ellipse inscribed in the layer bounds.
 *   - `triangle` — equilateral, apex at top-center.
 *   - `line`     — diagonal from top-left to bottom-right of bbox; stroke-only.
 *   - `polygon`  — regular n-gon, `sides` (3-12, default 5).
 *   - `star`     — n-pointed star, `points` (3-12) + `innerRatio` (default 0.5).
 *
 * Stroke props honored: stroke / strokeWidth / strokeDasharray /
 * strokeLinecap / strokeLinejoin. Stroke is painted INSIDE the layer
 * bounds via a half-stroke inset so the visible bounds match the
 * wireframe. */
function ShapeLayer({ layer, palette, layerStyle }) {
  /* `null` color = explicit "no fill" (cleared via N or the swatch-stack
   * none marker). `undefined` / non-null falsy = default → fall back to
   * white so logos/flatten content remain visible. */
  const hasFill = layer.color !== null
  const color   = hasFill ? (resolveColor(layer.color, palette) ?? '#FFFFFF') : 'transparent'
  const kind    = layer.kind ?? 'logo'
  const renderedSvg = kind === 'flatten' ? applySvgFit(layer.svg, layer.fit ?? 'fill') : null

  const strokeColor = resolveColor(layer.stroke, palette)
  const sw   = layer.strokeWidth ?? 0
  const half = sw > 0 ? sw / 2 : 0

  return (
    <div
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y,
        width: layer.w, height: layer.h,
        color,
        cursor: 'move',
        overflow: 'hidden',
        ...layerStyle,
      }}
    >
      {kind === 'logo' && (
        <KolLogo
          variant={layer.variant ?? 'logomark'}
          width={layer.w}
          height={layer.h}
          preserveAspectRatio={layer.fit === 'contain' ? 'xMidYMid meet' : 'none'}
          stroke={sw > 0 ? (strokeColor ?? undefined) : undefined}
          strokeWidth={sw > 0 ? sw : undefined}
          strokeLinejoin={layer.strokeLinejoin ?? undefined}
          strokeLinecap={layer.strokeLinecap ?? undefined}
          style={{
            display: 'block',
            paintOrder: sw > 0 ? 'stroke fill' : undefined,
          }}
        />
      )}
      {kind === 'flatten' && renderedSvg && (
        <div
          className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
        />
      )}
      {kind === 'rect' && (
        /* viewBox sized to the layer's intrinsic w/h so we can use plain
         * numeric coords (SVG attributes don't accept CSS calc()).
         * preserveAspectRatio="none" lets the SVG stretch to fill the
         * positioned div. */
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${Math.max(1, layer.w ?? 1)} ${Math.max(1, layer.h ?? 1)}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <rect
            x={half} y={half}
            width={Math.max(0, (layer.w ?? 0) - sw)}
            height={Math.max(0, (layer.h ?? 0) - sw)}
            fill={hasFill ? 'currentColor' : 'none'}
            stroke={strokeColor ?? 'none'}
            strokeWidth={sw}
            strokeDasharray={layer.strokeDasharray ?? undefined}
            strokeLinecap={layer.strokeLinecap ?? undefined}
            strokeLinejoin={layer.strokeLinejoin ?? undefined}
          />
        </svg>
      )}
      {kind === 'ellipse' && (
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${Math.max(1, layer.w ?? 1)} ${Math.max(1, layer.h ?? 1)}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <ellipse
            cx={(layer.w ?? 0) / 2}
            cy={(layer.h ?? 0) / 2}
            rx={Math.max(0, (layer.w ?? 0) / 2 - half)}
            ry={Math.max(0, (layer.h ?? 0) / 2 - half)}
            fill={hasFill ? 'currentColor' : 'none'}
            stroke={strokeColor ?? 'none'}
            strokeWidth={sw}
            strokeDasharray={layer.strokeDasharray ?? undefined}
            strokeLinecap={layer.strokeLinecap ?? undefined}
            strokeLinejoin={layer.strokeLinejoin ?? undefined}
          />
        </svg>
      )}
      {kind === 'triangle' && (
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${Math.max(1, layer.w ?? 1)} ${Math.max(1, layer.h ?? 1)}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <polygon
            points={trianglePoints(layer.w ?? 0, layer.h ?? 0, half)}
            fill={hasFill ? 'currentColor' : 'none'}
            stroke={strokeColor ?? 'none'}
            strokeWidth={sw}
            strokeDasharray={layer.strokeDasharray ?? undefined}
            strokeLinecap={layer.strokeLinecap ?? undefined}
            strokeLinejoin={layer.strokeLinejoin ?? 'round'}
          />
        </svg>
      )}
      {kind === 'line' && (() => {
        /* Line slope picks which bbox diagonal to render. Set by the pen
         * tool from the user's two clicks; preserved through move/resize
         * (bbox is the canonical position store, slope rides along). */
        const slope = layer.slope ?? '\\'
        const w0 = layer.w ?? 0
        const h0 = layer.h ?? 0
        const x1 = slope === '/' ? half             : half
        const y1 = slope === '/' ? h0 - half        : half
        const x2 = slope === '/' ? w0 - half        : w0 - half
        const y2 = slope === '/' ? half             : h0 - half
        return (
          <svg
            width="100%" height="100%"
            viewBox={`0 0 ${Math.max(1, w0)} ${Math.max(1, h0)}`}
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={strokeColor ?? 'currentColor'}
              strokeWidth={sw > 0 ? sw : 2}
              strokeDasharray={layer.strokeDasharray ?? undefined}
              strokeLinecap={layer.strokeLinecap ?? 'round'}
            />
          </svg>
        )
      })()}
      {kind === 'polygon' && (
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${Math.max(1, layer.w ?? 1)} ${Math.max(1, layer.h ?? 1)}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <polygon
            points={regularPolygonPoints(layer.w ?? 0, layer.h ?? 0, layer.sides ?? 5, half)}
            fill={hasFill ? 'currentColor' : 'none'}
            stroke={strokeColor ?? 'none'}
            strokeWidth={sw}
            strokeDasharray={layer.strokeDasharray ?? undefined}
            strokeLinecap={layer.strokeLinecap ?? undefined}
            strokeLinejoin={layer.strokeLinejoin ?? 'round'}
          />
        </svg>
      )}
      {kind === 'star' && (
        <svg
          width="100%" height="100%"
          viewBox={`0 0 ${Math.max(1, layer.w ?? 1)} ${Math.max(1, layer.h ?? 1)}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <polygon
            points={starPoints(layer.w ?? 0, layer.h ?? 0, layer.points ?? 5, layer.innerRatio ?? 0.5, half)}
            fill={hasFill ? 'currentColor' : 'none'}
            stroke={strokeColor ?? 'none'}
            strokeWidth={sw}
            strokeDasharray={layer.strokeDasharray ?? undefined}
            strokeLinecap={layer.strokeLinecap ?? undefined}
            strokeLinejoin={layer.strokeLinejoin ?? 'round'}
          />
        </svg>
      )}
    </div>
  )
}

/* Path layer — cubic-bezier vector authored by the pen tool. Nodes are
 * layer-local, so the svg positions at {x,y} and draws in local px at 1:1
 * (no viewBox stretch); `overflow: visible` lets curves/strokes that bulge
 * past the anchor bbox show. Fill/stroke follow the shape convention
 * (`currentColor` fill, resolved stroke). Stroke scales with the canvas
 * transform like every other layer — no non-scaling-stroke here. */
function PathLayer({ layer, palette, layerStyle }) {
  const hasFill     = layer.color !== null
  const color       = hasFill ? (resolveColor(layer.color, palette) ?? '#FFFFFF') : 'transparent'
  const strokeColor = resolveColor(layer.stroke, palette)
  const sw          = layer.strokeWidth ?? 0
  /* Boolean results carry hole rings — emit every ring and fill evenodd so
   * holes punch through. Plain paths keep the single-ring fast path. */
  const hasHoles    = (layer.holes?.length ?? 0) > 0
  const d           = hasHoles
    ? [layer.nodes ?? [], ...layer.holes].map((r) => pathD(r, true)).join(' ')
    : pathD(layer.nodes ?? [], layer.closed)

  return (
    <svg
      data-layer-id={layer.id}
      width={Math.max(1, layer.w ?? 1)}
      height={Math.max(1, layer.h ?? 1)}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y,
        overflow: 'visible',
        color,
        cursor: 'move',
        /* Hit-test the painted geometry, not the svg's rectangular box — an
         * open stroke-only path must not steal clicks across its whole bbox.
         * The root opts out; the <path> re-enables (visiblePainted: fill
         * hits only when filled, stroke only when stroked). closest()
         * still resolves data-layer-id from the path target. */
        pointerEvents: 'none',
        ...layerStyle,
      }}
    >
      <path
        d={d}
        pointerEvents="visiblePainted"
        fillRule={hasHoles ? 'evenodd' : undefined}
        fill={hasFill ? 'currentColor' : 'none'}
        stroke={sw > 0 ? (strokeColor ?? 'currentColor') : 'none'}
        strokeWidth={sw}
        strokeDasharray={layer.strokeDasharray ?? undefined}
        strokeLinecap={layer.strokeLinecap ?? 'round'}
        strokeLinejoin={layer.strokeLinejoin ?? 'round'}
      />
    </svg>
  )
}

/* Bool layer — a non-destructive boolean group: the paper.js pipeline runs
 * over `children` (bool-local coords, z-order bottom first) and the result
 * draws exactly like a path layer (holes evenodd, painted-geometry hit-
 * testing). Children never render individually. computeBooleanCached keys
 * on the children array identity, so static frames pay nothing — a child
 * edit swaps the array and recomputes. */
function BoolLayer({ layer, palette, layerStyle }) {
  const result = computeBooleanCached(layer)
  if (!result) return null
  return (
    <PathLayer
      layer={{ ...layer, nodes: result.nodes, holes: result.holes, closed: true }}
      palette={palette}
      layerStyle={layerStyle}
    />
  )
}

/**
 * TextLayer — wraps <TypeBlock> in a positioned container with
 * `data-layer-id` for the canvas pointer router. The contentEditable + edit
 * commit lives inside TypeBlock; we forward the layer's typography prop bag
 * via the `value` prop and the `text` field gets patched back through
 * `updateLayer` when the user commits.
 *
 * `display: flex` + `alignItems: center` lets short text stay vertically
 * centered inside `layer.h`. The TypeBlock fills the wrapper width so
 * `textAlign` resolves over `layer.w`.
 */
function TextLayer({ layer, palette, layerStyle }) {
  const { selectedId, updateLayer } = useComposeState()
  const color       = resolveColor(layer.color, palette) ?? '#FFFFFF'
  const strokeColor = resolveColor(layer.stroke, palette)
  const sw          = layer.strokeWidth ?? 0
  return (
    <div
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y,
        width: layer.w, height: layer.h,
        cursor: 'move',
        display: 'flex', alignItems: 'center',
        ...layerStyle,
      }}
    >
      <TypeBlock
        value={{ ...layer, color, strokeColor: sw > 0 ? strokeColor : null, strokeWidth: sw }}
        selected={selectedId === layer.id}
        onChange={(patch) => updateLayer(layer.id, patch)}
        className="w-full"
      />
    </div>
  )
}

export { COVER_TYPES }
