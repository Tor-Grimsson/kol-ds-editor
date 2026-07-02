import { useEffect, useMemo, useRef } from 'react'
import KolLogo from '../../brand/logos/KolLogo'
import TypeBlock from '../../components/styleguide/TypeBlock'
import { buildPatternSvg } from '../modes/pattern/render'
import { getShapeSvg } from '../modes/pattern/shapes'
import { resolveColor, COVER_TYPES, useComposeState } from './state'
import { regularPolygonPoints, starPoints, trianglePoints } from './shape-math'
import { pathD } from './path-math'
import { hasBindings, resolveLayer } from '../params/resolve'
import { useTransportCtx } from '../params/transport'
import { loopById } from '../../loops/registry'

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
    case 'pattern':    return <PatternLayer    layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'photo':      return <PhotoLayer      layer={layer}                    layerStyle={layerStyle} />
    case 'shape':      return <ShapeLayer      layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'path':       return <PathLayer       layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'text':       return <TextLayer       layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'group':      return <GroupLayer      layer={layer} palette={palette} layerStyle={layerStyle} />
    case 'loop':       return <LoopLayer       layer={layer}                    layerStyle={layerStyle} />
    default:           return null
  }
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
  const tctx = useTransportCtx(true)
  useEffect(() => {
    const cv = canvasRef.current
    const loop = loopById(layer.loopId)
    if (!cv || !loop) return
    const w = Math.max(1, layer.w ?? 1)
    const h = Math.max(1, layer.h ?? 1)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = Math.round(w * dpr)
    const bh = Math.round(h * dpr)
    if (cv.width !== bw) cv.width = bw
    if (cv.height !== bh) cv.height = bh
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    loop.draw(g, tctx.t, w, h, layer)
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
