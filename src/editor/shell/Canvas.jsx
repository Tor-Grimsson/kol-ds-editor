import { createContext, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ASPECTS } from './aspects'
import { transport } from '../params/transport'

/* Current viewport zoom factor — consumed by editing chrome (selection
 * handles, path nodes) to render at a screen-constant size by dividing
 * their virtual-px dimensions by the zoom. Defaults to 1 for canvases
 * without a PanZoomViewport. */
export const CanvasZoomContext = createContext(1)

export const CANVAS_DEFAULTS = {
  bgColor:    '#0E0E11',
  guideColor: '#F5F3EF',
}

/* Fixed virtual canvas width — children render in this pixel space and the
 * outer rect scales to fit the viewport via CSS transform. Means a 168px
 * element is always 168/1080 of the canvas width regardless of zoom or
 * viewport size. Height is derived from the active aspect ratio. */
export const CANVAS_VIRTUAL_W = 1080

function resolveAspect(aspect, customRatio) {
  const found = ASPECTS.find((x) => x.id === aspect) ?? ASPECTS[0]
  const ratio = aspect === 'custom' && customRatio ? customRatio : found.ratio
  const label = aspect === 'custom' && customRatio
    ? `Custom · ${Number(customRatio).toFixed(2)}`
    : found.label
  return { ratio, label }
}

/**
 * Bare aspect frame — dashed guide border + label + virtual-pixel scale layer.
 * No outer letterbox. Sizes to its parent (`width: 100%; aspect-ratio: ratio`)
 * so the parent decides the frame's width/height.
 */
export function CanvasFrame({
  aspect,
  customRatio,
  bgColor,
  guideColor = CANVAS_DEFAULTS.guideColor,
  children,
}) {
  const { ratio, label } = resolveAspect(aspect, customRatio)
  const virtualH = CANVAS_VIRTUAL_W / ratio

  const rectRef = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const node = rectRef.current
    if (!node) return
    const compute = () => {
      /* offsetWidth, NOT getBoundingClientRect — gbcr folds in the pan/zoom
       * transform, so a window resize while zoomed would bake the zoom into
       * the fit scale and double-apply it. offsetWidth is layout-only. */
      const w = node.offsetWidth
      if (w > 0) setScale(w / CANVAS_VIRTUAL_W)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(node)
    return () => ro.disconnect()
  }, [ratio])

  return (
    <div
      ref={rectRef}
      data-canvas-frame
      className="relative w-full"
      style={{
        aspectRatio: ratio,
        background:  bgColor ?? 'transparent',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          border:      '1px solid',
          borderColor: `color-mix(in srgb, ${guideColor} 24%, transparent)`,
        }}
      />
      <span
        className="z-[2]"
        style={{
          position:      'absolute',
          top:           6,
          left:          8,
          fontSize:      10,
          fontFamily:    'var(--kol-font-family-mono)',
          letterSpacing: '0.1em',
          color:         `color-mix(in srgb, ${guideColor} 70%, transparent)`,
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
      {scale > 0 && (
        <div
          className="absolute top-0 left-0 z-[1]"
          style={{
            width:           `${CANVAS_VIRTUAL_W}px`,
            height:          `${virtualH}px`,
            transformOrigin: 'top left',
            transform:       `scale(${scale})`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Shared canvas region for generator tools.
 *
 * The OUTER wrapper letterboxes the inner `<CanvasFrame>` (rect carries the
 * optional `bgColor`, dashed border, label, and virtual-pixel scale layer).
 *
 * `panEnabled` opts into Space-key + drag panning. When held, the cursor
 * flips to grab/grabbing and the canvas frame translates with the cursor;
 * pointer events on the frame are suppressed while Space is held so layer
 * handlers don't fire mid-pan. Decorative chrome (grid bg / dark bg / inset
 * borders) is the consumer's responsibility — Canvas only provides the
 * letterbox + pan viewport.
 */
export default function Canvas({
  aspect,
  customRatio,
  bgColor,
  guideColor = CANVAS_DEFAULTS.guideColor,
  align = 'center',
  panEnabled = false,
  showGrid = true,
  showRulers = true,
  guides,
  setGuides,
  guidesInteractive = true,
  children,
}) {
  const { ratio } = resolveAspect(aspect, customRatio)

  const letterbox = (
    <div
      className={`flex ${align === 'start' ? 'items-start' : 'items-center'} justify-center w-full h-full`}
      style={{ containerType: 'size' }}
    >
      <div
        style={{
          width:       `min(calc(100cqw - 48px), calc((100cqh - 48px) * ${ratio}))`,
        }}
      >
        <CanvasFrame
          aspect={aspect}
          customRatio={customRatio}
          bgColor={bgColor}
          guideColor={guideColor}
        >
          {children}
        </CanvasFrame>
      </div>
    </div>
  )

  if (!panEnabled) return letterbox
  return (
    <PanZoomViewport
      showGrid={showGrid}
      showRulers={showRulers}
      guides={guides}
      setGuides={setGuides}
      guidesInteractive={guidesInteractive}
    >
      {letterbox}
    </PanZoomViewport>
  )
}

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8

/* Anchor a zoom change at a screen point (sx, sy relative to the viewport
 * top-left) so the content under the cursor stays put. Transform is
 * `translate(x,y) scale(zoom)` with origin 0,0, so screen = p*zoom + pan;
 * inverting for a fixed p gives the new pan below. */
function zoomAt(v, factor, sx, sy) {
  const z2 = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor))
  return {
    zoom: z2,
    x: sx - (sx - v.x) * (z2 / v.zoom),
    y: sy - (sy - v.y) * (z2 / v.zoom),
  }
}

/* Live framerate for the fps chip, measured only while shown (RAF idles
 * when off). Toggled by `f` alongside the zoom readout below. */
function useFps(enabled) {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let raf, frames = 0, last = performance.now()
    const loop = (now) => {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return fps
}

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * PanZoomViewport — infinite-canvas viewport (pan + zoom).
 *
 * Pan: hold Space + drag (cursor grab/grabbing), or two-finger trackpad
 * scroll. Zoom: Cmd/Ctrl + wheel or trackpad pinch, anchored at the pointer;
 * Cmd+0 resets, Cmd+= / Cmd+- step-zoom at the viewport center. A single
 * `translate() scale()` on the transform layer carries both; the stage's
 * measured rect already reflects it, so CanvasArea's screen→virtual math
 * needs no zoom awareness. Pointer events on the transform layer disable
 * while Space is held so layer mousedowns don't fire mid-pan.
 */
function PanZoomViewport({
  children,
  showGrid = true,
  showRulers = true,
  guides,
  setGuides,
  guidesInteractive = true,
}) {
  const containerRef              = useRef(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  /* Space tap = play/pause; Space+drag = pan. The ref records whether a
   * pan drag consumed this Space press (set on pan mousedown). */
  const spacePannedRef = useRef(false)
  const [dragging, setDragging]   = useState(false)
  const [view, setView]           = useState({ zoom: 1, x: 0, y: 0 })
  const dragStart                 = useRef(null)
  const [showFps, setShowFps]     = useState(false)
  const fps                       = useFps(showFps)

  /* Space toggles pan mode; Cmd+0 / Cmd+= / Cmd+- drive zoom from the
   * keyboard (centered on the viewport). Skipped while typing in a field. */
  useEffect(() => {
    const isInputTarget = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onKeyDown = (e) => {
      if (isInputTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) spacePannedRef.current = false
        setSpaceHeld(true)
        return
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '0') {
          e.preventDefault()
          setView({ zoom: 1, x: 0, y: 0 })
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          const r = containerRef.current?.getBoundingClientRect()
          setView((v) => zoomAt(v, 1.2, (r?.width ?? 0) / 2, (r?.height ?? 0) / 2))
        } else if (e.key === '-') {
          e.preventDefault()
          const r = containerRef.current?.getBoundingClientRect()
          setView((v) => zoomAt(v, 1 / 1.2, (r?.width ?? 0) / 2, (r?.height ?? 0) / 2))
        }
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
        setDragging(false)
        dragStart.current = null
        /* No pan happened → this was a tap: play/pause (the "ultimate ruler"
         * transport binding; labs parity). */
        if (!spacePannedRef.current) transport.toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      if (!dragStart.current) return
      const { x: sx, y: sy } = dragStart.current
      setView((v) => ({ ...v, x: e.clientX - sx, y: e.clientY - sy }))
    }
    const onUp = () => {
      setDragging(false)
      dragStart.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  /* Wheel: Cmd/Ctrl+wheel or trackpad pinch (ctrlKey) → zoom at pointer;
   * plain two-finger scroll → pan. Native non-passive listener so we can
   * preventDefault the browser's page-zoom / scroll. */
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = node.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (e.ctrlKey || e.metaKey) {
        setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.0015), sx, sy))
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  /* Zoom tool clicks arrive as kol:zoom-at events (client coords + factor)
   * from CanvasArea — anchored zoom at the pointer. */
  useEffect(() => {
    const onZoomEvt = (e) => {
      const node = containerRef.current
      if (!node) return
      const { clientX, clientY, factor } = e.detail
      const rect = node.getBoundingClientRect()
      setView((v) => zoomAt(v, factor, clientX - rect.left, clientY - rect.top))
    }
    window.addEventListener('kol:zoom-at', onZoomEvt)
    return () => window.removeEventListener('kol:zoom-at', onZoomEvt)
  }, [])

  /* `f` toggles the fps chip (measured only while shown). Guarded against
   * typing targets so text fields don't flip it. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      setShowFps((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onMouseDown = (e) => {
    if (!spaceHeld) return
    e.preventDefault()
    spacePannedRef.current = true
    dragStart.current = { x: e.clientX - view.x, y: e.clientY - view.y }
    setDragging(true)
  }

  /* Only override the cursor while actively panning (Space-held / dragging).
   * At rest, leave it unset so consumers above can apply their own cursor
   * (e.g. CanvasArea's tool-driven cursor) and have it visible across the
   * dark backdrop AND the canvas frame, not just the frame area. */
  const cursor = dragging ? 'grabbing' : spaceHeld ? 'grab' : undefined
  const atRest = view.zoom === 1 && view.x === 0 && view.y === 0

  return (
    <CanvasZoomContext.Provider value={view.zoom}>
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={cursor ? { cursor } : undefined}
      onMouseDown={onMouseDown}
    >
      {/* No transition on the transform: editing chrome (selection wireframe,
          path nodes) sizes itself by 1/zoom from React state, which updates
          instantly — an eased CSS transform lags behind and makes the chrome
          visibly pop ("selection-wireframe zoom jolt"). Instant zoom keeps
          chrome, rulers, and stage in the same frame. */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: '0 0',
          pointerEvents: spaceHeld ? 'none' : 'auto',
        }}
      >
        {/* Oversized grid behind the letterbox — extends 2 viewport sizes
            in each direction so practical panning never reveals an edge. */}
        {showGrid && (
          <div
            className="kol-grid-bg absolute"
            style={{ left: '-200%', top: '-200%', width: '500%', height: '500%' }}
          />
        )}
        <div className="relative w-full h-full">{children}</div>
      </div>

      {/* Ruler guides — viewport-level so each line spans the whole visible
          canvas area (readable against the rulers), under the rulers, above
          the canvas content. */}
      {guides && setGuides && (
        <CanvasGuides
          containerRef={containerRef}
          view={view}
          guides={guides}
          setGuides={setGuides}
          interactive={guidesInteractive && !spaceHeld}
        />
      )}

      {showRulers && <CanvasRuler containerRef={containerRef} view={view} disabled={spaceHeld} />}

      {/* Zoom % + fps — matching chips. Zoom (click resets to 100% /
          centered) first, fps to its right, shown while `f` toggles it. */}
      <div className="absolute bottom-3 right-3 z-[3] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
          className="px-2 py-1 rounded border border-fg-08 bg-surface-secondary kol-mono-12 text-emphasis tabular-nums"
          style={{ opacity: atRest && !showFps ? 0.55 : 1 }}
          title="Reset zoom (⌘0)"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        {showFps && (
          <span
            className="px-2 py-1 rounded border border-fg-08 bg-surface-secondary kol-mono-12 text-emphasis tabular-nums"
            title="Framerate — press F to hide"
          >
            {fps} fps
          </span>
        )}
      </div>
    </div>
    </CanvasZoomContext.Provider>
  )
}

const RULER = 18  /* px thickness of each ruler bar */
const RULER_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

/* Smallest 1-2-5 virtual step whose on-screen spacing clears `target` px, so
 * labels never crowd regardless of zoom. */
function niceStep(pxPer, target = 80) {
  for (const s of RULER_STEPS) if (s * pxPer >= target) return s
  return RULER_STEPS[RULER_STEPS.length - 1]
}

/* Virtual ticks visible across [0, spanScreen], given where virtual-0 sits
 * on screen (originScreen) and the screen-px-per-virtual-px scale. */
function ticksFor(originScreen, pxPer, spanScreen, step) {
  const vMin = (0 - originScreen) / pxPer
  const vMax = (spanScreen - originScreen) / pxPer
  const first = Math.ceil(vMin / step) * step
  const out = []
  for (let v = first; v <= vMax; v += step) out.push({ v: Math.round(v), s: originScreen + v * pxPer })
  return out
}

/* Frame geometry inside the viewport — locates the tagged
 * `[data-canvas-frame]` and reads its on-screen rect (which already folds in
 * the letterbox, fit-scale, and the pan/zoom transform) relative to the
 * container, so `screen = left/top + virtual * pxPer` holds at any zoom with
 * no separate math. `vh` is the frame's height in virtual px (for clamping
 * horizontal guides). Re-measures on every `view` change and on container
 * resize. Shared by CanvasRuler and CanvasGuides so ruler labels and guide
 * lines can never disagree. */
function useFrameGeom(containerRef, view) {
  const [geom, setGeom] = useState(null)

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const frame = el.querySelector('[data-canvas-frame]')
    const crect = el.getBoundingClientRect()
    if (!frame || crect.width === 0) { setGeom(null); return }
    const frect = frame.getBoundingClientRect()
    const pxPer = frect.width / CANVAS_VIRTUAL_W
    setGeom({
      left:  frect.left - crect.left,
      top:   frect.top  - crect.top,
      pxPer,
      vh:    pxPer > 0 ? frect.height / pxPer : 0,
      cw:    crect.width,
      ch:    crect.height,
    })
  }, [containerRef])

  /* Smooth zoom (⌘±/⌘0/zoom-tool) animates the transform layer via a CSS
   * transition, so a single measure at view-change time reads the PRE-
   * animation rect and the labels lag the whole tween. Re-measure per
   * animation frame until the frame rect stops moving (2 stable frames);
   * wheel/pinch zooms (transition: none) settle immediately, costing only
   * a couple of no-op frames. */
  useLayoutEffect(() => {
    measure()
    let raf
    let prevKey
    let stable = 0
    const tick = () => {
      const frame = containerRef.current?.querySelector('[data-canvas-frame]')
      if (!frame) return
      const r = frame.getBoundingClientRect()
      const key = `${r.left}|${r.top}|${r.width}`
      if (key !== prevKey) {
        prevKey = key
        stable = 0
        measure()
      } else if (++stable >= 2) {
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [measure, view, containerRef])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, containerRef])

  return geom
}

/**
 * CanvasRuler — top + left rulers in virtual-canvas px, mapped through the
 * measured frame geometry (see useFrameGeom).
 *
 * Dragging off a ruler starts a new guide: the ruler only ANNOUNCES the
 * gesture via a `kol:guide-drag-start` CustomEvent (same idiom as
 * kol:zoom-at) — CanvasGuides owns the guide drag; the positions live in
 * compose state. Canvases without a guides layer no-op. `disabled`
 * (Space-held pan) lets the pointerdown bubble to the pan handler instead.
 */
function CanvasRuler({ containerRef, view, disabled = false }) {
  const geom = useFrameGeom(containerRef, view)

  const startGuideDrag = (axis) => (e) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('kol:guide-drag-start', {
      detail: { axis, clientX: e.clientX, clientY: e.clientY },
    }))
  }

  if (!geom || geom.pxPer <= 0) return null
  const step   = niceStep(geom.pxPer)
  const hTicks = ticksFor(geom.left, geom.pxPer, geom.cw, step)
  const vTicks = ticksFor(geom.top,  geom.pxPer, geom.ch, step)

  /* Light ruler variant — light bar, dark ticks/labels. */
  /* Mid-grey bar trial (review) — dark ink at higher mixes so ticks and
   * labels stay legible on #666. */
  const tickColor   = 'color-mix(in srgb, var(--kol-bg-0, #0E0E11) 70%, transparent)'
  const textColor   = 'color-mix(in srgb, var(--kol-bg-0, #0E0E11) 88%, transparent)'
  const barBg       = '#666666'
  const borderColor = 'color-mix(in srgb, var(--kol-bg-0, #0E0E11) 35%, transparent)'
  const labelStyle  = { fontFamily: 'var(--kol-font-family-mono)', fontSize: 9 }

  return (
    <>
      <svg width="100%" height={RULER}
        onPointerDown={startGuideDrag('h')}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, cursor: 'row-resize' }}>
        <rect x={0} y={0} width="100%" height={RULER} fill={barBg} />
        {hTicks.map(({ v, s }) => (
          <g key={v}>
            <line x1={s} y1={RULER - 5} x2={s} y2={RULER} stroke={tickColor} strokeWidth={1} />
            <text x={s + 2} y={9} fill={textColor} style={labelStyle}>{v}</text>
          </g>
        ))}
        <line x1={0} y1={RULER - 0.5} x2="100%" y2={RULER - 0.5} stroke={borderColor} strokeWidth={1} />
      </svg>
      <svg width={RULER} height="100%"
        onPointerDown={startGuideDrag('v')}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, cursor: 'col-resize' }}>
        <rect x={0} y={0} width={RULER} height="100%" fill={barBg} />
        {vTicks.map(({ v, s }) => (
          <g key={v}>
            <line x1={RULER - 5} y1={s} x2={RULER} y2={s} stroke={tickColor} strokeWidth={1} />
            <text x={9} y={s - 2} fill={textColor} style={labelStyle}
              transform={`rotate(-90 9 ${s - 2})`}>{v}</text>
          </g>
        ))}
        <line x1={RULER - 0.5} y1={0} x2={RULER - 0.5} y2="100%" stroke={borderColor} strokeWidth={1} />
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, width: RULER, height: RULER, background: barBg, borderRight: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, zIndex: 4, pointerEvents: 'none' }} />
    </>
  )
}

/* A ruler guide — 1px accent line spanning the full viewport (Figma
 * behavior: guides read against the rulers, not just the frame). Pointer
 * events live on a slop wrapper around the line so the grab zone stays
 * ~5 px; everything is screen px at the viewport level, so no zoom
 * compensation is needed. */
function GuideLine({ axis, screenPos, interactive, onGrab }) {
  const slop = 5
  const h = axis === 'h'
  return (
    <div
      onPointerDown={interactive ? onGrab : undefined}
      /* Stop the compat mousedown from reaching handlers underneath (pan /
       * click-away) in browsers that fire it despite the canceled
       * pointerdown. */
      onMouseDown={interactive ? (e) => e.stopPropagation() : undefined}
      style={{
        position: 'absolute',
        ...(h
          ? { left: 0, top: screenPos - slop, width: '100%', height: slop * 2 + 1, cursor: 'row-resize' }
          : { left: screenPos - slop, top: 0, width: slop * 2 + 1, height: '100%', cursor: 'col-resize' }),
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          ...(h
            ? { left: 0, top: slop, width: '100%', height: 1 }
            : { left: slop, top: 0, width: 1, height: '100%' }),
          background: 'var(--kol-accent-primary)',
        }}
      />
    </div>
  )
}

/**
 * CanvasGuides — ruler guides rendered at the viewport level so each line
 * spans the entire visible canvas area instead of clipping to the letterbox
 * frame. Positions are stored in virtual canvas px (compose state, threaded
 * down as props — the viewport is shell code and owns no guide state); the
 * screen mapping is the same frame-rect geometry the rulers use:
 * screen = frameLeft/Top + virtual * pxPer.
 *
 * Interaction:
 *   • grab a line (±5px slop) to move it — row/col-resize cursors
 *   • drag off a ruler to create (CanvasRuler announces the gesture via
 *     the kol:guide-drag-start CustomEvent; this layer owns the drag)
 *   • release at virtual pos < 0 (back over the source ruler, or past the
 *     frame edge toward it) deletes instead of committing
 *
 * Drags use window-level POINTER events — the ruler cancels its pointerdown,
 * which suppresses the whole compatibility mouse-event stream for the
 * interaction, so mousemove/mouseup would never fire.
 */
function CanvasGuides({ containerRef, view, guides, setGuides, interactive }) {
  const geom = useFrameGeom(containerRef, view)
  /* Ref mirror so the drag listeners read fresh geometry without rebinding. */
  const geomRef = useRef(null)
  geomRef.current = geom
  const [guideDrag, setGuideDrag] = useState(null) /* { axis:'h'|'v', index:number|null, pos:number } | null */

  /* client coords → virtual canvas px, via the measured frame geometry. */
  const toVirtual = useCallback((clientX, clientY) => {
    const el = containerRef.current
    const g = geomRef.current
    if (!el || !g || g.pxPer <= 0) return { vx: 0, vy: 0 }
    const crect = el.getBoundingClientRect()
    return {
      vx: (clientX - crect.left - g.left) / g.pxPer,
      vy: (clientY - crect.top  - g.top)  / g.pxPer,
    }
  }, [containerRef])

  /* A pointerdown on a ruler dispatches kol:guide-drag-start (see
   * CanvasRuler); this opens a new-guide drag at the pointer. */
  useEffect(() => {
    const onStart = (e) => {
      const { axis, clientX, clientY } = e.detail
      const { vx, vy } = toVirtual(clientX, clientY)
      setGuideDrag({ axis, index: null, pos: Math.round(axis === 'h' ? vy : vx) })
    }
    window.addEventListener('kol:guide-drag-start', onStart)
    return () => window.removeEventListener('kol:guide-drag-start', onStart)
  }, [toVirtual])

  /* Window-level listeners while a guide drag is live. Commit on pointerup:
   * append (new) or move (existing); pos < 0 deletes / discards. Positions
   * clamp to the far canvas edge and round to whole virtual px. */
  useEffect(() => {
    if (!guideDrag) return
    const posFrom = (e) => {
      const { vx, vy } = toVirtual(e.clientX, e.clientY)
      return Math.round(guideDrag.axis === 'h' ? vy : vx)
    }
    const onMove = (e) => setGuideDrag((d) => d && { ...d, pos: posFrom(e) })
    const onUp = (e) => {
      const pos = posFrom(e)
      const { axis, index } = guideDrag
      const max = axis === 'h' ? Math.round(geomRef.current?.vh ?? 0) : CANVAS_VIRTUAL_W
      setGuides((g) => {
        const arr = [...g[axis]]
        if (pos < 0) {
          if (index != null) arr.splice(index, 1)   /* dropped on the ruler → delete */
        } else if (index == null) {
          arr.push(Math.min(pos, max))
        } else {
          arr[index] = Math.min(pos, max)
        }
        return { ...g, [axis]: arr }
      })
      setGuideDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [guideDrag, toVirtual, setGuides])

  if (!geom || geom.pxPer <= 0) return null
  const screenFor = (axis, pos) =>
    axis === 'h' ? geom.top + pos * geom.pxPer : geom.left + pos * geom.pxPer
  const canGrab = interactive && !guideDrag
  const grab = (axis, index, pos) => (e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setGuideDrag({ axis, index, pos })
  }

  return (
    /* z-[3]: under the rulers (zIndex 4), above the transform layer (canvas
       content). pointer-events-none wrapper — only the slop zones re-enable. */
    <div className="absolute inset-0 pointer-events-none z-[3]">
      {guides.h.map((y, i) => (
        guideDrag?.axis === 'h' && guideDrag.index === i ? null : (
          <GuideLine
            key={`gh-${i}`} axis="h" screenPos={screenFor('h', y)}
            interactive={canGrab} onGrab={grab('h', i, y)}
          />
        )
      ))}
      {guides.v.map((x, i) => (
        guideDrag?.axis === 'v' && guideDrag.index === i ? null : (
          <GuideLine
            key={`gv-${i}`} axis="v" screenPos={screenFor('v', x)}
            interactive={canGrab} onGrab={grab('v', i, x)}
          />
        )
      ))}
      {guideDrag && (
        <>
          <GuideLine
            axis={guideDrag.axis}
            screenPos={screenFor(guideDrag.axis, guideDrag.pos)}
            interactive={false}
          />
          {/* Full-viewport cursor shield — keeps the row/col-resize cursor
              while the pointer roams outside the dragged line's slop zone. */}
          <div
            className="absolute inset-0"
            style={{
              cursor: guideDrag.axis === 'h' ? 'row-resize' : 'col-resize',
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
    </div>
  )
}
