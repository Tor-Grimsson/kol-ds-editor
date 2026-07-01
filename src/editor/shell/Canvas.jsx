import { createContext, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ASPECTS } from './aspects'

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
  return <PanZoomViewport>{letterbox}</PanZoomViewport>
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
function PanZoomViewport({ children }) {
  const containerRef              = useRef(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [view, setView]           = useState({ zoom: 1, x: 0, y: 0 })
  const [smooth, setSmooth]       = useState(true)
  const dragStart                 = useRef(null)
  const settle                    = useRef(null)

  /* Space toggles pan mode; Cmd+0 / Cmd+= / Cmd+- drive zoom from the
   * keyboard (centered on the viewport). Skipped while typing in a field. */
  useEffect(() => {
    const isInputTarget = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onKeyDown = (e) => {
      if (isInputTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
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
      setSmooth(false)
      clearTimeout(settle.current)
      settle.current = setTimeout(() => setSmooth(true), 140)
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
   * from CanvasArea — anchored zoom at the pointer, animated by the
   * default smooth transition. */
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

  const onMouseDown = (e) => {
    if (!spaceHeld) return
    e.preventDefault()
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
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: '0 0',
          transition: dragging || !smooth ? 'none' : 'transform 120ms ease-out',
          pointerEvents: spaceHeld ? 'none' : 'auto',
        }}
      >
        {/* Oversized grid behind the letterbox — extends 2 viewport sizes
            in each direction so practical panning never reveals an edge. */}
        <div
          className="kol-grid-bg absolute"
          style={{ left: '-200%', top: '-200%', width: '500%', height: '500%' }}
        />
        <div className="relative w-full h-full">{children}</div>
      </div>

      <CanvasRuler containerRef={containerRef} view={view} />

      {/* Zoom readout — click to reset to 100% / centered. */}
      <button
        type="button"
        onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
        className="absolute bottom-3 right-3 z-[3] px-2 py-1 rounded text-[11px] tabular-nums"
        style={{
          fontFamily: 'var(--kol-font-family-mono)',
          background: 'color-mix(in srgb, var(--kol-bg-0, #0E0E11) 70%, transparent)',
          color: 'var(--kol-fg-1, #F5F3EF)',
          border: '1px solid color-mix(in srgb, #F5F3EF 18%, transparent)',
          opacity: atRest ? 0.55 : 1,
        }}
        title="Reset zoom (⌘0)"
      >
        {Math.round(view.zoom * 100)}%
      </button>
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

/**
 * CanvasRuler — top + left rulers in virtual-canvas px.
 *
 * Locates the tagged `[data-canvas-frame]` inside the viewport and reads its
 * on-screen rect — which already folds in the letterbox, fit-scale, and the
 * pan/zoom transform — so virtual-0 and the px-per-virtual scale come out
 * correct at any zoom with no separate math. Re-measures on every `view`
 * change and on container resize. Non-interactive (pointer-events: none).
 */
function CanvasRuler({ containerRef, view }) {
  const [geom, setGeom] = useState(null)

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const frame = el.querySelector('[data-canvas-frame]')
    const crect = el.getBoundingClientRect()
    if (!frame || crect.width === 0) { setGeom(null); return }
    const frect = frame.getBoundingClientRect()
    setGeom({
      left:  frect.left - crect.left,
      top:   frect.top  - crect.top,
      pxPer: frect.width / CANVAS_VIRTUAL_W,
      cw:    crect.width,
      ch:    crect.height,
    })
  }, [containerRef])

  useLayoutEffect(() => { measure() }, [measure, view])
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, containerRef])

  if (!geom || geom.pxPer <= 0) return null
  const step   = niceStep(geom.pxPer)
  const hTicks = ticksFor(geom.left, geom.pxPer, geom.cw, step)
  const vTicks = ticksFor(geom.top,  geom.pxPer, geom.ch, step)

  const tickColor   = 'color-mix(in srgb, #F5F3EF 45%, transparent)'
  const textColor   = 'color-mix(in srgb, #F5F3EF 60%, transparent)'
  const barBg       = 'color-mix(in srgb, #0E0E11 82%, transparent)'
  const borderColor = 'color-mix(in srgb, #F5F3EF 24%, transparent)'
  const labelStyle  = { fontFamily: 'var(--kol-font-family-mono)', fontSize: 9 }

  return (
    <>
      <svg width="100%" height={RULER}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, pointerEvents: 'none' }}>
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
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 4, pointerEvents: 'none' }}>
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
