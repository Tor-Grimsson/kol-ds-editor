import { useEffect, useMemo, useRef, useState } from 'react'
import KolLogo from '../../brand/logos/KolLogo'
import TypeBlock from '../../components/styleguide/TypeBlock'
import { buildPatternSvg } from '../modes/pattern/render'
import { getShapeSvg } from '../modes/pattern/shapes'
import { resolveColor, COVER_TYPES, useComposeState } from './state'
import { useTool } from '../state/tools'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'
import { pathD } from './path-math'
import { computeBooleanCached } from './boolean-ops'
import { hasBindings, resolveLayer } from '../params/resolve'
import { useTransportCtx, useTransportPlaying, useTransportEpoch, transport } from '../params/transport'
import { loopById, loopDrawParams, resolveCameraKeys } from '../../loops/registry'
import { drawLoopFrame } from '../../loops/lib/viewport'
import { runChain, invalidateSource } from '../../filters/fxCore'
import { enabledCanvasStages, enabledEngineStage, pixiStages } from './filterChain'
import { rasterizeLayer, sourceKey } from './rasterizeLayer'
import KineticType from '../../kinetic/KineticType'
import { loadFonts as loadKineticFonts, warmFontCss as warmKineticFontCss } from '../../kinetic/fonts'
import { ensureWebcam, getWebcamStream, stopWebcam } from '../lib/webcam'

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

  /* Webcam lifecycle owner — a live camera stream is keyed to the LAYER (id +
   * webcam source), not any one render component, so requesting/stopping it
   * here (above the render-path switch) survives plain↔filtered↔GL swaps that
   * remount the child. Cleanup stops the tracks on delete (layer leaves the
   * tree → unmount), source change (srcType dep), and route unmount. Requested
   * once here; the source button primed the registry already, so ensureWebcam
   * returns that same stream rather than prompting twice. */
  const webcamId = layer.srcType === 'webcam' ? layer.id : null
  useEffect(() => {
    if (!webcamId) return undefined
    ensureWebcam(webcamId).catch(() => { /* denied / unavailable — renders empty */ })
    return () => stopWebcam(webcamId)
  }, [webcamId])

  if (layer.visible === false) return null  /* undefined ⇒ visible, like marquee/snap */

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
      const stages = chainFor(layer)
      const px = pixiFor(layer)
      return (stages.length || px.length)
        ? <EffectedLayer layer={layer} stages={stages} pxStages={px} palette={palette} layerStyle={layerStyle} />
        : <PatternLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
    }
    case 'photo': {
      /* Filtered photo → live filter-chain canvas. Cropped photos (imgW set)
       * ignore filters in v1 — the crop branch's frame-local image math
       * doesn't compose with the fitted-source pipeline; plain photo wins.
       * An enabled engine (GL) stage terminates the chain: canvas stages run
       * first, their output feeds the engine (EngineFilterLayer). */
      const filterable = (layer.src || layer.srcType === 'webcam') && layer.imgW == null && layer.w != null
      const engine = filterable ? enabledEngineStage(layer) : null
      const stages = filterable ? enabledCanvasStages(layer) : []
      const px = filterable ? pixiStages(layer) : []
      if (engine) return <EngineFilterLayer layer={layer} engine={engine} preStages={stages} pxStages={px} layerStyle={layerStyle} />
      return (stages.length || px.length)
        ? <FilteredPhotoLayer layer={layer} stages={stages} pxStages={px} layerStyle={layerStyle} />
        : <PhotoLayer         layer={layer}                 layerStyle={layerStyle} />
    }
    case 'shape':
    case 'path':
    case 'bool':
    case 'text': {
      /* Universal effects (Phase 7): any positioned vector layer with a
       * canvas filter chain renders through EffectedLayer (its own SVG
       * raster is the chain source). Engine (GL) stages stay photo/loop-only. */
      const stages = chainFor(layer)
      const px = pixiFor(layer)
      if (stages.length || px.length) return <EffectedLayer layer={layer} stages={stages} pxStages={px} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'shape') return <ShapeLayer layer={layer} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'path')  return <PathLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
      if (layer.type === 'bool')  return <BoolLayer  layer={layer} palette={palette} layerStyle={layerStyle} />
      return <TextLayer layer={layer} palette={palette} layerStyle={layerStyle} />
    }
    case 'group':      return <GroupLayer      layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'misc':   /* misc rides the loop render vehicle */
    case 'loop': {
      const def = loopById(layer.loopId)
      if (def?.kind === 'engine') return <EngineLoopLayer layer={layer} def={def} layerStyle={layerStyle} />
      /* Engine filter on a 2d loop (labs relief-over-generated-pattern,
       * HalftonePage): the loop's live canvas feeds the GL engine, canvas
       * stages run in between. */
      const engine = layer.w != null ? enabledEngineStage(layer) : null
      const stages = chainFor(layer)
      const px = pixiFor(layer)
      if (engine) return <EngineLoopFilterLayer layer={layer} loop={def} engine={engine} preStages={stages} pxStages={px} layerStyle={layerStyle} />
      if (stages.length || px.length) return <EffectedLayer layer={layer} stages={stages} pxStages={px} palette={palette} layerStyle={layerStyle} />
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

  /* morphBlend bridge — the kinetic layer's one FLAT bindable prop. When
   * present (a knob write, or a binding already resolved to a number by
   * resolveLayer above), it overrides `morph.blend` on every morph-on
   * instance before the comp reaches the engine — so BindDot sources drive
   * the morph without touching the stored comp. Absent prop = stored comp
   * untouched (identity passthrough). */
  const comp = useMemo(() => {
    const c = layer.comp
    const blend = layer.morphBlend
    if (typeof blend !== 'number' || !c?.instances?.some((x) => x?.morph?.on)) return c
    const b = Math.max(0, Math.min(1, blend))
    return { ...c, instances: c.instances.map((x) => (x.morph?.on ? { ...x, morph: { ...x.morph, blend: b } } : x)) }
  }, [layer.comp, layer.morphBlend])

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
    if (r.comp !== comp) { r.engine.setComposition(comp); r.comp = comp }
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

/* The layer's enabled CANVAS filter stages ([{ def, params, key }] in chain
 * order), or []. Engine (GL) stages route separately (they need a GL host). */
function chainFor(layer) {
  if (layer.w == null) return []
  return enabledCanvasStages(layer)
}

/* The layer's enabled PIXI stages ([{ def, params, key }] in chain order), or
 * []. The GPU batch (applyPixiStack) that runs after the canvas chain. */
function pixiFor(layer) {
  if (layer.w == null) return []
  return pixiStages(layer)
}

/* Signature that re-runs the pixi batch only on change (not every frame): the
 * upstream source token + the enabled canvas + pixi stages' id/params + dims.
 * Deliberately excludes x/y (dragging a pixi'd layer must NOT re-run the GPU
 * pass) — the layer canvas is repainted, the cached pixi result re-blitted. */
function pixiSig(srcToken, canvasStages, pxStages, w, h, dpr) {
  return [
    srcToken,
    JSON.stringify(canvasStages.map((s) => [s.id, s.params])),
    JSON.stringify(pxStages.map((s) => [s.id, s.params])),
    `${w}x${h}@${dpr}`,
  ].join('|')
}

/* Pixi GPU batch (labs pixiPipeline) — the async tier between the synchronous
 * canvas chain and any terminal GL engine, run on ONE persistent Pixi
 * Application. pipeline.js is DYNAMIC-imported so pixi.js/pixi-filters
 * code-split into their own chunk.
 *
 * Mirrors the rasterizeLayer supersede pattern: `ref` holds { key, canvas }
 * (result) or { pending }. On a cache HIT the result is blitted onto the layer
 * canvas synchronously; on a MISS the pre-pixi canvas is snapshotted as the
 * pixi source and the async run kicked — a `pending` token drops superseded
 * results, and forceDraw repaints when it lands (the caller keys its redraw
 * signature on the result canvas identity so the land actually re-runs). While
 * pending, the pre-pixi canvas (or the stale prior result) stays visible. */
function runPixiPass(cv, g, w, h, pxStages, key, ref, forceDraw) {
  const cur = ref.current
  const blit = (c) => { g.clearRect(0, 0, w, h); g.drawImage(c, 0, 0, w, h) }
  if (cur && cur.key === key && cur.canvas) { blit(cur.canvas); return }   /* fresh cache hit */
  /* Cache miss (or a different key already in flight). Snapshot the PRE-PIXI
   * canvas output NOW — before any stale blit below overwrites cv — as the
   * stable pixi source; feeding a stale result back in would double-apply. */
  if (cur?.pending !== key) {
    const snap = document.createElement('canvas')
    snap.width = cv.width
    snap.height = cv.height
    snap.getContext('2d').drawImage(cv, 0, 0)
    ref.current = { key: cur?.key ?? null, canvas: cur?.canvas ?? null, pending: key }
    import('../../filters/pixi/pipeline.js')
      .then(({ applyPixiStack }) => applyPixiStack(snap, pxStages.map((s) => ({ id: s.id, params: s.params }))))
      .then((out) => {
        if (ref.current?.pending !== key || !out) return   /* superseded / no-op */
        ref.current = { key, canvas: out }
        forceDraw((n) => n + 1)
      })
      .catch(() => { if (ref.current?.pending === key) ref.current = { key: ref.current.key, canvas: ref.current.canvas } })
  }
  /* Keep the last good result on screen while the new one computes (no pre-FX
   * flash during a param drag); falls back to the pre-pixi output if none. */
  if (cur?.canvas) blit(cur.canvas)
}

/* Per-frame runChain input: each stage's params bag with a stable identity
 * injected (`id` = layer + stage key) — sim-pooled filters (reaction-
 * diffusion dither) key their engine state on p.id, so two stages of the
 * same filter, or the same filter on two layers, never share a sim. */
function chainArgs(layer, stages) {
  return stages.map((s) => ({ def: s.def, params: { ...s.params, id: `${layer.id}:${s.key}` } }))
}

/* True when any stage subscribes to the transport clock. */
const chainAnimated = (stages) => stages.some((s) => s.def.animated !== false)

/* Effected layer — ANY positioned layer run through the canvas filter CHAIN
 * (Phase 7 + labs post-FX chain: enabled stages run in order, the output of
 * one is the input of the next — fxCore.runChain). The layer's own render is
 * the chain source:
 *   - 2d loops: `loop.draw` is synchronous → drawn into a reused source
 *     canvas every frame (live animation flows through the chain). The
 *     reused canvas is invalidated after each draw so identity-keyed pixel
 *     caches re-read the fresh frame.
 *   - SVG types (shape/path/text/pattern): rasterized async via
 *     rasterizeLayer, cached by sourceKey — content edits re-raster, filter
 *     param edits do NOT.
 * Host mirrors FilteredPhotoLayer: transport-subscribed when any stage is
 * animated (always for loops), dpr backing, data-layer-id. */
function EffectedLayer({ layer, stages, pxStages = [], palette, layerStyle }) {
  const canvasRef = useRef(null)
  const srcRef = useRef(null)       /* { key, canvas } (svg) | { canvas } (loop) */
  const lastDraw = useRef(null)
  const pixiRef = useRef(null)      /* { key, canvas } pixi result | { pending } */
  const [, forceDraw] = useState(0)
  const isLoop = layer.type === 'loop' || layer.type === 'misc'
  const loopDef = isLoop ? loopById(layer.loopId) : null
  const tctx = useTransportCtx(isLoop || chainAnimated(stages))
  const camKeys = useCameraKeysDrag(loopDef, layer, canvasRef)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    /* Pixi result identity rides in the skip signatures so an async pixi land
     * (forceDraw, everything else unchanged) still re-runs this effect and
     * blits the fresh result over the pre-pixi canvas output. */
    const pixiResult = pxStages.length ? (pixiRef.current?.canvas ?? null) : null

    /* — source — */
    let src = null
    if (isLoop) {
      const loop = loopDef
      if (!loop) return
      /* Skip identical redraws (see LoopLayer) — same layer, same t, same
       * loop means loop.draw + filter.apply would repaint the same pixels.
       * Epoch is in the signature so stop/rewind at t=0 still repaints the
       * freshly-reset sims. */
      const sig = [cv, loop, layer, tctx.t, dpr, tctx.epoch, pixiResult]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
      /* Source backed at dpr (like the unfiltered LoopLayer) so the filter
       * chain keeps full retina resolution — filters size their work off
       * src's own pixel dims, ctx stays in CSS px. */
      let sc = srcRef.current?.canvas
      const sbw = Math.round(w * dpr)
      const sbh = Math.round(h * dpr)
      if (!sc || sc.width !== sbw || sc.height !== sbh) {
        sc = document.createElement('canvas')
        sc.width = sbw
        sc.height = sbh
        srcRef.current = { canvas: sc }
      }
      const sg = sc.getContext('2d')
      sg.setTransform(dpr, 0, 0, dpr, 0, 0)
      const params = loopDrawParams(loop, layer)
      sg.clearRect(0, 0, w, h)
      drawLoopFrame(sg, loop, tctx.t, w, h, params)
      /* Redrawn IN PLACE — identity-keyed pixel caches must re-read. */
      invalidateSource(sc)
      src = sc
    } else {
      const key = `${sourceKey(layer, palette)}|${w}x${h}@${dpr}`
      if (srcRef.current?.key === key) {
        src = srcRef.current.canvas
      } else if (srcRef.current?.pending !== key) {
        srcRef.current = { ...(srcRef.current ?? {}), pending: key }
        rasterizeLayer(layer, palette, w, h, dpr).then((c) => {
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
    /* Svg branch: skip identical chain passes — src identity is part of the
     * signature so the async raster landing (forceDraw) still paints. The
     * whole chain rides on `layer` identity (any stage patch swaps the
     * layer's filters array → new layer object). */
    if (!isLoop) {
      const sig = [cv, layer, palette, tctx.t, dpr, src, pixiResult]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
    }

    /* — chain into the layer canvas (stage i's output feeds stage i+1) — */
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    runChain(g, src, w, h, chainArgs(layer, stages), tctx.t)
    /* — pixi GPU batch on the canvas-chain output (async, cache-gated) — */
    if (pxStages.length) {
      const token = isLoop ? `loop:${tctx.t}:${tctx.epoch}` : (srcRef.current?.key ?? '')
      runPixiPass(cv, g, w, h, pxStages, pixiSig(token, stages, pxStages, w, h, dpr), pixiRef, forceDraw)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camKeys ? 'grab' : 'move',
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
  const orbitMode = useTool().tool === 'orbit'
  /* Param-camera engines (def.cameraKeys, no OrbitControls) — pointer orbit
   * writes the camera params; the def.orbit path below stays engine-owned. */
  const camKeys = useCameraKeysDrag(def.orbit ? null : def, layer, canvasRef)

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
    r.host.setCameraDrag?.(def, r.engine, def.orbit && orbitMode)
    const now = performance.now()
    const dt = transport.isPlaying() && lastTs.current != null ? (now - lastTs.current) / 1000 : 0
    lastTs.current = now
    r.host.driveEngine(def, r.engine, { u: tctx.t, dt })
  })

  /* Orbit mode on: the engine's OrbitControls own the pointer — swallow
   * events so CanvasArea's move-drag router never sees them. */
  const camDrag = def.orbit && orbitMode
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      onPointerDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      onMouseDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camDrag || camKeys ? 'grab' : 'move',
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
  const def = loopById(layer.loopId)
  const camKeys = useCameraKeysDrag(def, layer, canvasRef)
  useEffect(() => {
    const cv = canvasRef.current
    const loop = def
    if (!cv || !loop) return
    const w = Math.max(1, layer.w ?? 1)
    const h = Math.max(1, layer.h ?? 1)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    /* Skip identical redraws. Renders reach here with everything unchanged —
     * paused transport notifies on every mousemove, and dragging ANY layer
     * re-renders the whole stack — and a field loop repaint is 10-100ms.
     * Unbound layers keep object identity across unrelated re-renders, so
     * this signature only misses when a redraw would actually differ. Epoch
     * is in it so stop/rewind at t=0 still repaints freshly-reset sims. */
    const sig = [cv, loop, layer, tctx.t, dpr, tctx.epoch]
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
    drawLoopFrame(g, loop, tctx.t, w, h, params)
  })
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camKeys ? 'grab' : 'move',
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
  /* Live camera — its own always-live <video> (no transport governance, no
   * src). Wins before the src null-guard: a webcam layer has no src. */
  if (layer.srcType === 'webcam') return <WebcamPhotoLayer layer={layer} layerStyle={layerStyle} />
  if (!layer.src) return null
  const hasBounds = layer.w != null && layer.h != null
  /* Video source — transport-governed <video> (own component: it needs the
   * play-state/epoch hooks, stills don't). It applies its own crop rect
   * (imgW/imgX/imgY/imgH) the same way photos do, so it must win before the
   * cropped-<img> branch below. */
  if (layer.srcType === 'video') return <VideoPhotoLayer layer={layer} layerStyle={layerStyle} />
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

/* Plain (unfiltered) video layer — a positioned <video> element governed by
 * the transport: play/pause follows the clock's play state, stop/rewind (a
 * reset-epoch bump) snaps currentTime to trimIn, and the schema knobs map onto
 * the element (playbackRate / loop / muted). The trim window [trimIn,trimOut]
 * loops within itself: native `loop` handles the untrimmed full-clip case, and
 * a trimmed clip disables it and wraps via a `timeupdate` listener (no per-tick
 * React subscription — the browser keeps decoding with near-zero JS, exactly
 * like the old autoplay element). Loop off → pause held at trimOut. The ref
 * re-asserts `muted` — React drops the attribute and Chrome refuses
 * programmatic play without it.
 *
 * Cropped video (imgW set — a crop rect from CropOverlay, same as photos) draws
 * the <video> at its frame-local rect inside an overflow-hidden frame; the
 * transport wiring is identical. */
function VideoPhotoLayer({ layer, layerStyle }) {
  const ref = useRef(null)
  const playing = useTransportPlaying()
  const epoch = useTransportEpoch()
  const lastEpoch = useRef(epoch)
  const muted = layer.videoMuted !== false

  /* Transport + knobs → element. Runs after every render (play() on an
   * already-playing element is a no-op) — renders here are rare by design.
   * A clip blocked at trimOut (loop off) is NOT auto-resumed on incidental
   * re-renders (selection etc.), matching syncVideoTransport. */
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.playbackRate = layer.playbackRate ?? 1
    const win = trimWindow(v, layer)
    if (lastEpoch.current !== epoch) {
      lastEpoch.current = epoch
      try { v.currentTime = win ? win.inSec : 0 } catch { /* metadata not ready — loads at 0 anyway */ }
    }
    if (playing) {
      const blockAtOut = !!win && win.trimmed && layer.videoLoop === false && v.currentTime >= win.outSec - 0.02
      if (win && win.trimmed && !blockAtOut && (v.currentTime < win.inSec || v.currentTime >= win.outSec)) {
        try { v.currentTime = win.inSec } catch { /* pending */ }
      }
      if (blockAtOut) v.pause()
      else { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}) }
    } else v.pause()
  })

  /* Trim wrap while playing — `timeupdate` fires ~4×/s natively (no rAF, no
   * re-render). Only attached for a trimmed clip; native loop / end-pause
   * covers the untrimmed case. Re-attaches when the window or loop flag
   * changes. */
  const trimmed = (layer.trimIn ?? 0) > 0 || (layer.trimOut ?? 1) < 1
  useEffect(() => {
    const v = ref.current
    if (!v || !trimmed) return undefined
    const onTime = () => applyTrimWrap(v, layer, trimWindow(v, layer))
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, layer.trimIn, layer.trimOut, layer.videoLoop])

  const hasBounds = layer.w != null && layer.h != null
  const nativeLoop = layer.videoLoop !== false && !trimmed
  const refCb = (el) => { ref.current = el; if (el) el.muted = muted }

  /* Cropped video — explicit crop window {imgX,imgY,imgW,imgH} (frame-local
   * px), clipped to the {w,h} frame. Mirrors PhotoLayer's cropped branch. The
   * inner <video> also carries data-layer-id so build.js's video-export query
   * (`video[data-layer-id=…]`) finds the live element to snapshot its frame. */
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
        <video
          src={layer.src}
          data-layer-id={layer.id}
          loop={nativeLoop}
          muted={muted}
          playsInline
          ref={refCb}
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
    <video
      src={layer.src}
      data-layer-id={layer.id}
      loop={nativeLoop}
      muted={muted}
      playsInline
      ref={refCb}
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

/* Plain (unfiltered) live-camera layer — a positioned <video> bound to the
 * webcam MediaStream (from webcam.js's registry, keyed by layer id). Unlike
 * VideoPhotoLayer it's NOT transport-governed: a live camera always runs, so
 * there's no play/pause/trim wiring — just attach the stream and let the
 * browser paint it. `mirror` flips the feed horizontally (selfie view),
 * composed onto the layer's own rotate/flip transform. The stream's lifecycle
 * (request + track-stop) is owned by LayerRenderer's top-level effect; here we
 * only attach the srcObject once the stream resolves. */
function WebcamPhotoLayer({ layer, layerStyle }) {
  const ref = useRef(null)
  useEffect(() => {
    let dead = false
    const attach = (stream) => { if (!dead && ref.current && stream) { ref.current.srcObject = stream; const pr = ref.current.play(); if (pr && pr.catch) pr.catch(() => {}) } }
    const live = getWebcamStream(layer.id)
    if (live) attach(live)
    else ensureWebcam(layer.id).then(attach).catch(() => {})
    return () => { dead = true }
  }, [layer.id])

  const hasBounds = layer.w != null && layer.h != null
  const positionStyle = hasBounds
    ? { left: layer.x, top: layer.y, width: layer.w, height: layer.h }
    : { inset: 0, width: '100%', height: '100%' }
  /* Mirror is an extra scaleX(-1) composed onto any rotate/flip already in
   * layerStyle.transform (single element, one transform string). */
  const transform = [layerStyle.transform, layer.mirror ? 'scaleX(-1)' : '']
    .filter(Boolean).join(' ') || undefined
  return (
    <video
      data-layer-id={layer.id}
      muted
      playsInline
      autoPlay
      style={{
        position: 'absolute',
        ...positionStyle,
        objectFit: layer.fit ?? 'cover',
        cursor: 'move',
        ...layerStyle,
        transform,
      }}
    />
  )
}

/* Draw a media element (image or the video's current frame) into canvas `c`,
 * honoring `fit` (cover / contain / fill). Shared by the one-shot fitted
 * build (stills) and the per-frame GL redraw (video frames advance, the
 * fitted pixels must follow). `mirror` (webcam only) flips horizontally
 * pre-filter — the source pixels are mirrored so an asymmetric filter sees the
 * selfie-view frame, not a post-hoc CSS flip. */
function drawFitted(media, c, fit, mirror = false) {
  const g = c.getContext('2d')
  const sw = media.naturalWidth || media.videoWidth || media.width
  const sh = media.naturalHeight || media.videoHeight || media.height
  g.clearRect(0, 0, c.width, c.height)
  g.save()
  if (mirror) { g.translate(c.width, 0); g.scale(-1, 1) }
  if (fit === 'fill' || !sw || !sh) {
    g.drawImage(media, 0, 0, c.width, c.height)
    g.restore()
    return
  }
  const k = fit === 'contain' ? Math.min(c.width / sw, c.height / sh) : Math.max(c.width / sw, c.height / sh)
  const dw = sw * k
  const dh = sh * k
  g.drawImage(media, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh)
  g.restore()
}

/* Fitted-source build for filters: the layer's media drawn into a canvas at
 * the layer's CSS-px size. Always a FRESH canvas — filters key their
 * per-source pixel/luma caches on canvas identity, so a rebuild must change
 * identity. (GL video is the one exception: it redraws IN place via
 * drawFitted + touchSource to keep the CanvasTexture binding.) */
function fitSource(media, w, h, fit, scale = 1, mirror = false) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale))
  c.height = Math.max(1, Math.round(h * scale))
  drawFitted(media, c, fit, mirror)
  return c
}

/* Decode a photo layer's source into a drawable element (the labs
 * ImageContext idiom): image → HTMLImageElement; video → muted looping
 * HTMLVideoElement with .width/.height mirrored from the intrinsic size so
 * it drops in anywhere an image works (drawImage, GL textures). Returns
 * null until decoded. crossOrigin only on absolute http(s) URLs — the
 * /media proxy path is same-origin and object/data URLs never taint. */
function useSourceMedia(src, srcType, layerId) {
  const [media, setMedia] = useState(null)
  useEffect(() => {
    /* Webcam source — a live <video> bound to the registry stream (keyed by
     * layer id). Frames advance on their own; the filter/GL draw paths force
     * per-frame redraws via their own rAF. Track-stopping is owned by
     * LayerRenderer's top-level effect — here we only detach on teardown so a
     * render-path swap doesn't kill the shared stream. */
    if (srcType === 'webcam') {
      let dead = false
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      ensureWebcam(layerId).then((stream) => {
        if (dead) return
        v.srcObject = stream
        v.onloadedmetadata = () => {
          v.width = v.videoWidth
          v.height = v.videoHeight
          setMedia(v)
        }
        const pr = v.play()
        if (pr && pr.catch) pr.catch(() => {})
      }).catch(() => {})
      return () => {
        dead = true
        v.onloadedmetadata = null
        try { v.pause() } catch { /* */ }
        v.srcObject = null
        setMedia(null)
      }
    }
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
        /* Transport governs playback — only start if the clock is running
         * (syncVideoTransport keeps it honest from then on). */
        if (transport.isPlaying()) {
          const pr = v.play()
          if (pr && pr.catch) pr.catch(() => {})
        }
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
  }, [src, srcType, layerId])
  return media
}

const clamp01 = (n) => Math.max(0, Math.min(1, n))

/* Trim window in SECONDS from the layer's normalized trimIn/trimOut and the
 * element's own duration. Returns null until duration is known (metadata not
 * loaded). `trimmed` is false for the default full-clip [0,1] window — the
 * signal to keep native looping / end-pause instead of wrapping by hand. */
function trimWindow(v, layer) {
  const dur = v.duration
  if (!dur || !Number.isFinite(dur)) return null
  const inSec = clamp01(layer.trimIn ?? 0) * dur
  const outSec = Math.max(inSec + 0.05, clamp01(layer.trimOut ?? 1) * dur)
  const trimmed = (layer.trimIn ?? 0) > 0 || (layer.trimOut ?? 1) < 1
  return { inSec, outSec, trimmed }
}

/* Enforce the trim window for the current tick on a governed <video>. At
 * trimOut: wrap to trimIn when looping, else pause held at trimOut. Below
 * trimIn: snap up. No-op on an untrimmed / metadata-pending clip. Returns
 * true when the clip is BLOCKED (reached trimOut with loop off) so callers
 * don't auto-resume it. */
function applyTrimWrap(v, layer, win) {
  if (!win || !win.trimmed) return false
  if (v.currentTime >= win.outSec - 0.02) {
    if (layer.videoLoop !== false) { try { v.currentTime = win.inSec } catch { /* pending */ } return false }
    if (!v.paused) v.pause()
    try { v.currentTime = win.outSec } catch { /* pending */ }
    return true
  }
  if (v.currentTime < win.inSec - 0.02) { try { v.currentTime = win.inSec } catch { /* pending */ } }
  return false
}

/* Transport → a filter path's source <video> (the useSourceMedia element):
 * schema knobs re-assert (rate/mute), a reset-epoch change (stop/rewind) snaps
 * currentTime to trimIn, the trim window wraps/pauses per tick, and play/pause
 * follows the clock. Native `loop` stays on ONLY for the untrimmed full-clip
 * case (seamless); a trimmed clip disables it and wraps by hand. Called inside
 * the per-frame draw effects — they re-render on every transport notify (play,
 * pause, stop and rewind each notify once even while held), so the element
 * re-syncs whenever its governed state could have changed. */
function syncVideoTransport(v, layer, epoch, epochRef) {
  v.playbackRate = layer.playbackRate ?? 1
  const win = trimWindow(v, layer)
  v.loop = layer.videoLoop !== false && !win?.trimmed
  v.muted = layer.videoMuted !== false
  let blocked = false
  if (epochRef.current !== epoch) {
    epochRef.current = epoch
    try { v.currentTime = win ? win.inSec : 0 } catch { /* metadata not ready — loads at 0 anyway */ }
  } else {
    blocked = applyTrimWrap(v, layer, win)
  }
  if (transport.isPlaying()) {
    if (v.paused && !blocked) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}) }
  } else if (!v.paused) {
    v.pause()
  }
}

/* Filtered photo layer — the photo run through the canvas filter CHAIN
 * (src/filters, enabled stages in order) on a positioned <canvas>, mirroring
 * LoopLayer's host: transport-subscribed when any stage is animated, draw
 * runs after every render, backing = layer px × dpr. The decoded media +
 * fitted source canvas are cached and only rebuilt when src / fit / size
 * change — except video, whose frames advance: the fitted source rebuilds
 * FRESH per tick (2d filters key their per-source pixel caches on canvas
 * identity, so an in-place redraw would serve stale base pixels), and the
 * transport subscription is forced on. */
function FilteredPhotoLayer({ layer, stages, pxStages = [], layerStyle }) {
  const canvasRef = useRef(null)
  const fittedRef = useRef(null)   /* { key, media, canvas } */
  const lastDraw = useRef(null)
  const pixiRef = useRef(null)     /* { key, canvas } pixi result | { pending } */
  const epochRef = useRef(transport.getEpoch())
  const [, forceDraw] = useState(0)
  const isVideo = layer.srcType === 'video'
  const isWebcam = layer.srcType === 'webcam'
  const isLive = isVideo || isWebcam   /* frames advance outside the clock */
  const media = useSourceMedia(layer.src, layer.srcType, layer.id)
  const tctx = useTransportCtx(isLive || chainAnimated(stages))

  /* Webcam is always live but NOT transport-governed — drive the chain with a
   * self-owned rAF so the feed flows through the filters even while the
   * transport is stopped (video leans on transport ticks instead). tickV feeds
   * the pixi cache token so the GPU batch re-runs on each webcam frame. */
  const [tickV, tick] = useState(0)
  useEffect(() => {
    if (!isWebcam) return undefined
    let raf
    const loop = () => { tick((n) => n + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isWebcam])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !media) return
    if (isVideo) syncVideoTransport(media, layer, tctx.epoch, epochRef)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    /* Pixi result identity in the skip signature so an async pixi land
     * (forceDraw) re-runs this effect and blits the result (see EffectedLayer). */
    const pixiResult = pxStages.length ? (pixiRef.current?.canvas ?? null) : null
    /* Skip identical redraws (see LoopLayer) — stills only: live frames
     * (video/webcam) advance outside the transport clock, so they never skip.
     * The chain rides on `layer` identity (stage patches swap the filters
     * array). */
    if (!isLive) {
      const sig = [cv, layer, media, tctx.t, dpr, pixiResult]
      if (lastDraw.current && sig.every((v, i) => v === lastDraw.current[i])) return
      lastDraw.current = sig
    }
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const fit = layer.fit ?? 'cover'
    const mirror = isWebcam && !!layer.mirror
    /* Fitted source backed at dpr so the chain output keeps full retina
     * resolution (filters size their work off src's own pixel dims). */
    const key = `${w}x${h}|${fit}@${dpr}`
    if (isLive || !fittedRef.current || fittedRef.current.key !== key || fittedRef.current.media !== media) {
      fittedRef.current = { key, media, canvas: fitSource(media, w, h, fit, dpr, mirror) }
    }
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    runChain(g, fittedRef.current.canvas, w, h, chainArgs(layer, stages), tctx.t)
    /* — pixi GPU batch on the canvas-chain output (async, cache-gated) — */
    if (pxStages.length) {
      const token = isWebcam ? `cam:${tickV}`
        : isVideo ? `vid:${tctx.t}:${tctx.epoch}`
        : `${layer.src ?? ''}|${key}`
      runPixiPass(cv, g, w, h, pxStages, pixiSig(token, stages, pxStages, w, h, dpr), pixiRef, forceDraw)
    }
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

/* Run the pre-engine tiers into a STABLE feed canvas (the engine's
 * CanvasTexture binds to one canvas — redraw in place + touchSource, the
 * video idiom). Tier order holds: canvas stages → pixi batch → the engine
 * source. No stages/pixi → the source canvas passes through untouched.
 * Returns the canvas the engine should read. `pixi` (or null) = { stages, ref,
 * forceDraw, token } — the async GPU batch composited in place (cache-gated);
 * while it's pending the feed carries the canvas-chain output only. */
function chainIntoFeed(feedRef, srcCanvas, layer, stages, w, h, t, pixi) {
  const hasPixi = pixi && pixi.stages.length
  if (!stages.length && !hasPixi) return srcCanvas
  let feed = feedRef.current
  if (!feed) { feed = document.createElement('canvas'); feedRef.current = feed }
  if (feed.width !== srcCanvas.width) feed.width = srcCanvas.width
  if (feed.height !== srcCanvas.height) feed.height = srcCanvas.height
  const g = feed.getContext('2d')
  g.setTransform(feed.width / w, 0, 0, feed.height / h, 0, 0)
  g.clearRect(0, 0, w, h)
  if (stages.length) runChain(g, srcCanvas, w, h, chainArgs(layer, stages), t)
  else g.drawImage(srcCanvas, 0, 0, w, h)
  if (hasPixi) {
    runPixiPass(feed, g, w, h, pixi.stages, pixiSig(pixi.token, stages, pixi.stages, feed.width, feed.height, 1), pixi.ref, pixi.forceDraw)
  }
  invalidateSource(feed)
  return feed
}

/* Engine filter layer — a GL image filter (three.js engine, src/filters/gl)
 * on the same host shape as EngineLoopLayer: lazy host import (three stays
 * out of the base bundle), engine lifecycle keyed to the engine stage,
 * source pushed on feed-canvas identity change, params re-applied + one
 * drive per render. The engine is always the TERMINAL chain stage: enabled
 * canvas stages run first and their output is the engine's source (redrawn
 * in place + touchSource per tick, the video idiom). Synth-style engines
 * are feedback-based → free-running dt drive (advance only while the
 * transport plays; dt=0 repaints the held frame). */
function EngineFilterLayer({ layer, engine, preStages, pxStages = [], layerStyle }) {
  const filter = engine.def
  const canvasRef = useRef(null)
  const rig = useRef(null)          /* { host, engine, w, h, srcCanvas } */
  const fittedRef = useRef(null)    /* { key, media, canvas } */
  const feedRef = useRef(null)      /* chain output canvas (stable identity) */
  const pixiRef = useRef(null)      /* { key, canvas } pixi feed result | { pending } */
  const lastTs = useRef(null)
  const epochRef = useRef(transport.getEpoch())
  const [, forceDraw] = useState(0)
  const isVideo = layer.srcType === 'video'
  const isWebcam = layer.srcType === 'webcam'
  const isLive = isVideo || isWebcam
  const media = useSourceMedia(layer.src, layer.srcType, layer.id)
  const tctx = useTransportCtx(true)
  const orbitMode = useTool().tool === 'orbit'

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
  }, [engine.id])

  /* Webcam liveness — the transport (drive:'dt') already re-renders while
   * playing, but a stopped transport would freeze the live feed; a self-owned
   * rAF keeps pulling camera frames regardless. Video leans on transport. */
  useEffect(() => {
    if (!isWebcam) return undefined
    let raf
    const loop = () => { forceDraw((n) => n + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isWebcam])

  useEffect(() => {
    const r = rig.current
    if (!r || !media) return
    if (isVideo) syncVideoTransport(media, layer, tctx.epoch, epochRef)
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    const fit = layer.fit ?? 'cover'
    const mirror = isWebcam && !!layer.mirror
    const key = `${w}x${h}|${fit}`
    if (!fittedRef.current || fittedRef.current.key !== key || fittedRef.current.media !== media) {
      fittedRef.current = { key, media, canvas: fitSource(media, w, h, fit, 1, mirror) }
    } else if (isLive) {
      /* Live frames (video/webcam) advance — redraw INTO the same canvas so the
       * engine's CanvasTexture binding survives; touchSource below re-uploads. */
      drawFitted(media, fittedRef.current.canvas, fit, mirror)
      invalidateSource(fittedRef.current.canvas)   /* chain caches re-read */
    }
    const pixi = pxStages.length
      ? { stages: pxStages, ref: pixiRef, forceDraw, token: isLive ? `live:${tctx.t}:${tctx.epoch}` : (layer.src ?? '') }
      : null
    const feed = chainIntoFeed(feedRef, fittedRef.current.canvas, layer, preStages, w, h, tctx.t, pixi)
    if (w !== r.w || h !== r.h) { r.engine.resize(w, h); r.w = w; r.h = h }
    if (r.srcCanvas !== feed) {
      r.host.setSource(filter, r.engine, feed)
      r.srcCanvas = feed
    } else if (isLive || preStages.length || pxStages.length) {
      /* In-place feed rewrites (live frames / chain repaints / pixi land) → re-upload. */
      r.host.touchSource?.(filter, r.engine)
    }
    r.host.applyParams(filter, r.engine, { ...engine.params, id: `${layer.id}:${engine.key}` })
    r.host.setCameraDrag?.(filter, r.engine, filter.orbit && orbitMode)
    const now = performance.now()
    const dt = transport.isPlaying() && lastTs.current != null ? (now - lastTs.current) / 1000 : 0
    lastTs.current = now
    r.host.driveEngine(filter, r.engine, { u: tctx.t, dt })
  })

  /* Camera drag on: the engine's OrbitControls own the pointer (Rutt-Etra). */
  const camDrag = filter.orbit && orbitMode
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

/* Engine filter on a 2d LOOP layer (labs relief-over-generated-pattern,
 * HalftonePage's orbit relief: the just-rendered 2D canvas is the engine's
 * texture). The loop draws into a reused source canvas per tick; enabled
 * canvas stages chain on top; the result feeds the GL engine with per-tick
 * touchSource — mirroring how the video path drives CanvasTexture updates.
 * Host shape mirrors EngineLoopLayer (loop layers always subscribe). */
function EngineLoopFilterLayer({ layer, loop, engine, preStages, pxStages = [], layerStyle }) {
  const filter = engine.def
  const canvasRef = useRef(null)
  const rig = useRef(null)          /* { host, engine, w, h, srcCanvas } */
  const srcRef = useRef(null)       /* loop-drawn source canvas (stable identity) */
  const feedRef = useRef(null)      /* chain output canvas (stable identity) */
  const pixiRef = useRef(null)      /* { key, canvas } pixi feed result | { pending } */
  const lastTs = useRef(null)
  const [, forceDraw] = useState(0)
  const tctx = useTransportCtx(true)
  const orbitMode = useTool().tool === 'orbit'
  /* Param-camera 2d loops (surface/curves) keep their pointer orbit under a
   * GL filter — unless the FILTER owns the pointer (Rutt-Etra orbit). */
  const camKeys = useCameraKeysDrag(filter.orbit ? null : loop, layer, canvasRef)

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
  }, [engine.id])

  useEffect(() => {
    const r = rig.current
    if (!r || !loop) return
    const w = Math.max(1, Math.round(layer.w ?? 1))
    const h = Math.max(1, Math.round(layer.h ?? 1))
    /* — loop frame into the (stable) source canvas — engine sources live at
     * CSS px like the photo path's fitSource(scale 1). */
    let sc = srcRef.current
    if (!sc) { sc = document.createElement('canvas'); srcRef.current = sc }
    if (sc.width !== w) sc.width = w
    if (sc.height !== h) sc.height = h
    const sg = sc.getContext('2d')
    sg.setTransform(1, 0, 0, 1, 0, 0)
    sg.clearRect(0, 0, w, h)
    drawLoopFrame(sg, loop, tctx.t, w, h, loopDrawParams(loop, layer))
    invalidateSource(sc)   /* redrawn in place — pixel caches re-read */
    const pixi = pxStages.length
      ? { stages: pxStages, ref: pixiRef, forceDraw, token: `loop:${tctx.t}:${tctx.epoch}` }
      : null
    const feed = chainIntoFeed(feedRef, sc, layer, preStages, w, h, tctx.t, pixi)
    if (w !== r.w || h !== r.h) { r.engine.resize(w, h); r.w = w; r.h = h }
    if (r.srcCanvas !== feed) {
      r.host.setSource(filter, r.engine, feed)
      r.srcCanvas = feed
    } else {
      /* every tick rewrites the feed in place — re-upload the texture */
      r.host.touchSource?.(filter, r.engine)
    }
    r.host.applyParams(filter, r.engine, { ...engine.params, id: `${layer.id}:${engine.key}` })
    r.host.setCameraDrag?.(filter, r.engine, filter.orbit && orbitMode)
    const now = performance.now()
    const dt = transport.isPlaying() && lastTs.current != null ? (now - lastTs.current) / 1000 : 0
    lastTs.current = now
    r.host.driveEngine(filter, r.engine, { u: tctx.t, dt })
  })

  const camDrag = filter.orbit && orbitMode
  return (
    <canvas
      ref={canvasRef}
      data-layer-id={layer.id}
      onPointerDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      onMouseDownCapture={camDrag ? (e) => e.stopPropagation() : undefined}
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: layer.w, height: layer.h,
        cursor: camDrag || camKeys ? 'grab' : 'move',
        ...layerStyle,
      }}
    />
  )
}

/* Drag-to-orbit for param-camera defs. A def that exposes its camera as plain
 * layer params declares `cameraKeys: { yaw, pitch, dist }` naming those param
 * keys (the catalog contract — math surface/curves' yaw/pitch/dist, the GL
 * softforms3d camTheta/camPhi/camDist). With the layer's cameraDrag on,
 * pointer-drag writes yaw/pitch and wheel writes dist through updateLayer —
 * no engine controls involved, so it works for canvas2d projectors and
 * param-driven GL cameras alike. Defs with `orbit: true` (real OrbitControls)
 * never come through here — callers pass null.
 *
 * Sensitivity scales off each key's schema range (full range ≈ a 600px drag /
 * ~12 wheel notches), so degree- and radian-unit cameras both feel right; yaw
 * wraps when its range is a full turn (360 or 2π), everything else clamps.
 * OrbitControls feel: drag right → yaw decreases, drag down → pitch rises.
 * Native listeners on the canvas: wheel must be non-passive to preventDefault
 * the stage zoom, and pointerdown stopPropagation keeps CanvasArea's
 * move-drag router off the layer (the def.orbit swallow idiom). A drag is one
 * history transaction; wheel commits on a short idle. Returns whether the
 * rig is live (drives the grab cursor). */
function useCameraKeysDrag(def, layer, canvasRef) {
  const { updateLayer, beginTransaction, commitTransaction } = useComposeState()
  const { tool } = useTool()
  const live = useRef(null)
  live.current = layer                 /* handlers read the latest resolve */
  /* 3D → explicit cameraKeys; 2D loops (field/pattern) → synthesized
   * {yaw:camAngle, dist:camZoom}. Memo on def so the effect below doesn't
   * rebind its listeners every render (resolveCameraKeys mints a fresh obj). */
  const keys = useMemo(() => resolveCameraKeys(def), [def])
  /* Orbit MODE (the C tool) drives the camera — not a per-layer toggle, so
   * it can't fight layer-move (the stage does nothing in orbit mode). */
  const enabled = !!(keys && tool === 'orbit')
  const layerId = layer.id

  useEffect(() => {
    if (!enabled) return undefined
    const cv = canvasRef.current
    if (!cv) return undefined
    /* Field loops keep camera params in `.camera`, pattern in `.params` —
     * check both so span/clamp/wrap use the real min/max. */
    const schemaOf = (key) => (def.params ?? []).find((q) => q.key === key)
      || (def.camera ?? []).find((q) => q.key === key)
    const read = (key) => {
      const v = live.current?.[key]
      return typeof v === 'number' ? v : (schemaOf(key)?.default ?? 0)
    }
    const span = (key, fallback) => {
      const s = schemaOf(key)
      return s && s.min != null && s.max != null ? s.max - s.min : fallback
    }
    const round4 = (v) => Math.round(v * 1e4) / 1e4
    const clamp = (key, v) => {
      const s = schemaOf(key)
      return round4(Math.min(s?.max ?? Infinity, Math.max(s?.min ?? -Infinity, v)))
    }
    const wrapYaw = (v) => {
      const s = schemaOf(keys.yaw)
      const sp = s && s.min != null && s.max != null ? s.max - s.min : null
      if (sp != null && (sp === 360 || Math.abs(sp - Math.PI * 2) < 1e-6)) {
        return round4((((v - s.min) % sp) + sp) % sp + s.min)
      }
      return clamp(keys.yaw, v)
    }

    /* The gesture owns its accumulator (yaw/pitch/dist snapshot at gesture
     * start) — pointer/wheel events outrun React renders, so reading the
     * layer per event would drop deltas between renders. */
    let drag = null
    let wheelAcc = null
    let wheelTx = null
    const down = (e) => {
      e.stopPropagation()
      drag = { x: e.clientX, y: e.clientY, yaw: read(keys.yaw), pitch: read(keys.pitch) }
      cv.setPointerCapture?.(e.pointerId)
      beginTransaction()               /* whole orbit gesture = one undo step */
    }
    const move = (e) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      drag.x = e.clientX
      drag.y = e.clientY
      /* Write only the axes this loop declares — 3D has yaw+pitch, a 2D loop
       * has only yaw (its rotate/angle param); horizontal drag rotates it. */
      const patch = {}
      if (keys.yaw)   { drag.yaw   = wrapYaw(drag.yaw - dx * (span(keys.yaw, 360) / 600));            patch[keys.yaw]   = drag.yaw }
      if (keys.pitch) { drag.pitch = clamp(keys.pitch, drag.pitch + dy * (span(keys.pitch, 160) / 600)); patch[keys.pitch] = drag.pitch }
      if (keys.yaw || keys.pitch) updateLayer(layerId, patch)
    }
    const up = () => {
      if (!drag) return
      drag = null
      commitTransaction()
    }
    const wheel = (e) => {
      if (!keys.dist) return   /* loop declares no zoom axis → wheel is a no-op */
      e.preventDefault()
      e.stopPropagation()
      if (wheelTx == null) { beginTransaction(); wheelAcc = read(keys.dist) }
      clearTimeout(wheelTx)
      wheelTx = setTimeout(() => { wheelTx = null; wheelAcc = null; commitTransaction() }, 400)
      wheelAcc = clamp(keys.dist, wheelAcc + e.deltaY * (span(keys.dist, 4.5) / 1200))
      updateLayer(layerId, { [keys.dist]: wheelAcc })
    }
    cv.addEventListener('pointerdown', down)
    cv.addEventListener('pointermove', move)
    cv.addEventListener('pointerup', up)
    cv.addEventListener('pointercancel', up)
    cv.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cv.removeEventListener('pointerdown', down)
      cv.removeEventListener('pointermove', move)
      cv.removeEventListener('pointerup', up)
      cv.removeEventListener('pointercancel', up)
      cv.removeEventListener('wheel', wheel)
      if (drag || wheelTx != null) { clearTimeout(wheelTx); commitTransaction() }
    }
  }, [enabled, def, layerId, keys, canvasRef, updateLayer, beginTransaction, commitTransaction])

  return enabled
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
