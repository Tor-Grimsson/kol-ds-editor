import { useCallback, useEffect, useRef } from 'react'

/**
 * HueStrip + SBSquare + WheelTriangle — custom-tuned colour-picker widgets
 * for the macOS-port colour panel. Hand-tuned visuals (specific gradients,
 * inset math, handle sizes, barycentric SV math, conic-gradient ring with
 * clip-path mask). DO NOT refactor pieces to atoms — the look and the math
 * are intentional and match the Ref design.
 *
 * Three components exported:
 *
 *   <HueStrip hue onChange />
 *     — 1D hue slider (12px tall) with a knob constrained inside the box.
 *
 *   <SBSquare hue sat val onChange />
 *     — 2D saturation/value picker. Uses available width × height of its
 *       container; gradient is white→hue horizontally with a black overlay
 *       fading to transparent upward.
 *
 *   <WheelTriangle hue sat val onChangeHue onChangeSV />
 *     — Hue ring + inscribed rotating HSV triangle. Ring snaps-on-click;
 *       triangle uses grab-with-offset (handle stays put on click, drag
 *       preserves cursor↔handle delta) so fine sat/val tuning works.
 */

/* Handle radius (px) used to inset both the handle's positioning area AND
 * the drag hit-test math so the knob always renders inside the spectrum
 * frame. Without this the handle's center maps to 0/100% of the box and
 * half the knob hangs off the edge. */
const HANDLE_R = 7

const HUE_GRADIENT =
  'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))'

export function HueStrip({ hue, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const update = useCallback((clientX) => {
    const node = ref.current
    if (!node) return
    const rect  = node.getBoundingClientRect()
    const inner = rect.width - 2 * HANDLE_R
    if (inner <= 0) return
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left - HANDLE_R) / inner))
    onChange(ratio * 360)
  }, [onChange])

  const onDown = (e) => {
    dragging.current = true
    update(e.clientX)
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) update(e.clientX) }
    const onUp   = ()  => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [update])

  const pos = (hue / 360) * 100

  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      className="relative rounded-[2px] cursor-pointer"
      style={{ height: 12, background: HUE_GRADIENT }}
    >
      {/* Handle positions inside an inset region so 0..100% maps to the
       * area where the knob can sit without spilling out. */}
      <div className="absolute inset-y-0" style={{ left: HANDLE_R, right: HANDLE_R }}>
        <Handle left={`${pos}%`} top="50%" />
      </div>
    </div>
  )
}

export function SBSquare({ hue, sat, val, onChange }) {
  const ref = useRef(null)
  const dragging = useRef(false)

  const update = useCallback((clientX, clientY) => {
    const node = ref.current
    if (!node) return
    const rect   = node.getBoundingClientRect()
    const innerW = rect.width  - 2 * HANDLE_R
    const innerH = rect.height - 2 * HANDLE_R
    if (innerW <= 0 || innerH <= 0) return
    const sx = Math.max(0, Math.min(1, (clientX - rect.left - HANDLE_R) / innerW))
    const sy = Math.max(0, Math.min(1, (clientY - rect.top  - HANDLE_R) / innerH))
    onChange(sx * 100, (1 - sy) * 100)
  }, [onChange])

  const onDown = (e) => {
    dragging.current = true
    update(e.clientX, e.clientY)
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) update(e.clientX, e.clientY) }
    const onUp   = ()  => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [update])

  const sb = `linear-gradient(to bottom, transparent 0%, #000 100%), linear-gradient(to right, #fff 0%, hsl(${hue},100%,50%) 100%)`
  /* Gradient field is rectangular — rounding is the consumer's job (apply
   * `rounded-[2px] overflow-hidden` on the wrapper). Putting border-radius
   * on the gradient itself produces tiny antialiasing artifacts at the
   * corners; clipping via overflow-hidden on the parent is cleaner. */
  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      className="relative cursor-crosshair w-full h-full"
      style={{ background: sb }}
    >
      <div className="absolute" style={{ inset: HANDLE_R }}>
        <Handle left={`${sat}%`} top={`${100 - val}%`} />
      </div>
    </div>
  )
}

/* Wheel + rotating HSV triangle.
 *
 * Layout — viewBox 100×100, all coords in viewBox space.
 *   Center (50, 50). Outer ring radius = 48. Inner hole radius = 40.
 *   Triangle inscribed in a circle of radius TRI_R = 40 (vertices touch
 *   the inner ring edge).
 *
 * Triangle vertices rotate so the hue vertex always points at the active
 * hue position on the ring. With angle = hue degrees from east (CCW negated
 * for screen y-down):
 *   V_hue   at angle θ
 *   V_white at θ - 120°  (upper-left when θ = 0)
 *   V_black at θ + 120°  (lower-left when θ = 0)
 *
 * SV mapping uses barycentric coords inside the triangle:
 *   P = a·V_hue + b·V_white + c·V_black,   a+b+c = 1
 *   value      = a + b           (1 − c, height-from-black-edge in HSV space)
 *   saturation = a / (a + b)     (0 = white side, 1 = hue side)
 *
 * Render: SVG with three stacked polygons —
 *   1. solid hue
 *   2. white-fade (linear gradient: opaque at V_white, 0 toward opposite edge)
 *   3. black-fade (linear gradient: opaque at V_black, 0 toward opposite edge)
 */

const RING_OUTER = 48
const RING_INNER = 40           /* thin ring band — triangle vertices land on this edge */
const TRI_R      = RING_INNER   /* vertices touch the inner ring edge directly */

function vertexAt(angleRad) {
  return [50 + TRI_R * Math.cos(angleRad), 50 + TRI_R * Math.sin(angleRad)]
}

export function WheelTriangle({ hue, sat, val, onChangeHue, onChangeSV }) {
  const svgRef   = useRef(null)
  const dragMode = useRef(null)   /* { type: 'ring' } | { type: 'tri', offsetX, offsetY } | null */

  /* Convert client coords to viewBox coords (0..100). */
  const toView = useCallback((clientX, clientY) => {
    const node = svgRef.current
    if (!node) return [50, 50]
    const rect = node.getBoundingClientRect()
    return [
      ((clientX - rect.left) / rect.width)  * 100,
      ((clientY - rect.top)  / rect.height) * 100,
    ]
  }, [])

  /* Compute hue vertex angle (radians). */
  const hueAngle    = hue * Math.PI / 180
  const angleHue    = hueAngle
  const angleWhite  = hueAngle - (2 * Math.PI / 3)
  const angleBlack  = hueAngle + (2 * Math.PI / 3)
  const Vh = vertexAt(angleHue)
  const Vw = vertexAt(angleWhite)
  const Vb = vertexAt(angleBlack)

  /* Barycentric weights for point P given the triangle vertices. */
  const baryFor = (px, py) => {
    const [x1, y1] = Vh
    const [x2, y2] = Vw
    const [x3, y3] = Vb
    const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    if (Math.abs(denom) < 1e-9) return [1, 0, 0]
    const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / denom
    const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / denom
    const c = 1 - a - b
    return [a, b, c]
  }

  /* Clamp a point to the triangle interior using its barycentric coords. */
  const clampToTriangle = (px, py) => {
    let [a, b, c] = baryFor(px, py)
    a = Math.max(0, a); b = Math.max(0, b); c = Math.max(0, c)
    const sum = a + b + c
    if (sum === 0) return [Vh[0], Vh[1], 1, 0, 0]
    a /= sum; b /= sum; c /= sum
    const x = a * Vh[0] + b * Vw[0] + c * Vb[0]
    const y = a * Vh[1] + b * Vw[1] + c * Vb[1]
    return [x, y, a, b, c]
  }

  /* SV handle position from current (sat, val). */
  const aH = (sat / 100) * (val / 100)
  const bH = (1 - sat / 100) * (val / 100)
  const cH = 1 - val / 100
  const handleX = aH * Vh[0] + bH * Vw[0] + cH * Vb[0]
  const handleY = aH * Vh[1] + bH * Vw[1] + cH * Vb[1]

  /* Hue handle on ring (midline between outer and inner radius). */
  const ringR  = (RING_OUTER + RING_INNER) / 2
  const ringHx = 50 + ringR * Math.cos(hueAngle)
  const ringHy = 50 + ringR * Math.sin(hueAngle)

  /* Pointer behavior:
   *  - Ring → snap-on-click; continued drag tracks cursor angle.
   *  - Tri  → grab-with-offset so fine-tuning doesn't teleport the handle. */
  const onSvgDown = (e) => {
    const [vx, vy] = toView(e.clientX, e.clientY)
    const dist = Math.hypot(vx - 50, vy - 50)
    if (dist > RING_INNER) {
      const cursorAngle = (Math.atan2(vy - 50, vx - 50) * 180 / Math.PI + 360) % 360
      onChangeHue(cursorAngle)
      dragMode.current = { type: 'ring' }
    } else {
      dragMode.current = {
        type: 'tri',
        offsetX: handleX - vx,
        offsetY: handleY - vy,
      }
    }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      const d = dragMode.current
      if (!d) return
      const [vx, vy] = toView(e.clientX, e.clientY)
      if (d.type === 'ring') {
        const cursorAngle = (Math.atan2(vy - 50, vx - 50) * 180 / Math.PI + 360) % 360
        onChangeHue(cursorAngle)
      } else {
        const tx = vx + d.offsetX
        const ty = vy + d.offsetY
        const [, , a, b] = clampToTriangle(tx, ty)
        const value = a + b
        const s     = (a + b) > 0 ? (a / (a + b)) : 0
        onChangeSV(s * 100, value * 100)
      }
    }
    const onUp = () => { dragMode.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [toView, onChangeHue, onChangeSV, Vh, Vw, Vb])

  /* Gradient endpoints: white-fade goes from V_white (opaque) toward the
   * midpoint of the V_hue—V_black edge (transparent). Same idea for black. */
  const midHB = [(Vh[0] + Vb[0]) / 2, (Vh[1] + Vb[1]) / 2]
  const midHW = [(Vh[0] + Vw[0]) / 2, (Vh[1] + Vw[1]) / 2]

  const trianglePoints = `${Vh[0]},${Vh[1]} ${Vw[0]},${Vw[1]} ${Vb[0]},${Vb[1]}`

  return (
    <div className="aspect-square max-h-full max-w-full">
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      onMouseDown={onSvgDown}
      preserveAspectRatio="xMidYMid meet"
      className="block cursor-crosshair select-none w-full h-full"
    >
      <defs>
        <clipPath id="kol-wheel-ring-clip" clipPathUnits="userSpaceOnUse">
          <path
            d={`M 50 ${50 - RING_OUTER} a ${RING_OUTER} ${RING_OUTER} 0 1 0 0.001 0 Z
                M 50 ${50 - RING_INNER} a ${RING_INNER} ${RING_INNER} 0 1 1 -0.001 0 Z`}
            fillRule="evenodd"
          />
        </clipPath>
        <linearGradient id="kol-wheel-white-fade" gradientUnits="userSpaceOnUse"
          x1={midHB[0]} y1={midHB[1]} x2={Vw[0]} y2={Vw[1]}>
          <stop offset="0"  stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1"  stopColor="#FFFFFF" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="kol-wheel-black-fade" gradientUnits="userSpaceOnUse"
          x1={midHW[0]} y1={midHW[1]} x2={Vb[0]} y2={Vb[1]}>
          <stop offset="0"  stopColor="#000000" stopOpacity="0" />
          <stop offset="1"  stopColor="#000000" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Outer ring: foreignObject + CSS conic gradient, clipped to a torus
          path so only the band is visible. */}
      <foreignObject x="0" y="0" width="100" height="100" clipPath="url(#kol-wheel-ring-clip)">
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: '100%', height: '100%',
            background: `conic-gradient(from 90deg,
              hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
              hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%),
              hsl(360,100%,50%))`,
          }}
        />
      </foreignObject>

      {/* Triangle layers — three stacked polygons mix to a true HSV triangle */}
      <polygon points={trianglePoints} fill={`hsl(${hue}, 100%, 50%)`} />
      <polygon points={trianglePoints} fill="url(#kol-wheel-white-fade)" />
      <polygon points={trianglePoints} fill="url(#kol-wheel-black-fade)" />

      {/* Handles. Ring handle is larger than the SV handle to match the Ref. */}
      <SvgHandle cx={ringHx}  cy={ringHy}  r={3.2} />
      <SvgHandle cx={handleX} cy={handleY} r={2.0} />
    </svg>
    </div>
  )
}

/* ────────── Internal helpers (not exported) ────────── */

/* DOM handle for HueStrip / SBSquare. Solid fg circle with a thin halo
 * (matching the macOS-port look) — surface-coloured gap + fg-based outline
 * so it reads on both themes. */
function Handle({ left, top }) {
  return (
    <span
      className="absolute pointer-events-none rounded-full bg-fg"
      style={{
        left, top,
        width: 14, height: 14,
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 0 0 1px var(--kol-surface-primary), 0 0 0 2px var(--kol-fg-32)',
      }}
    />
  )
}

/* SVG handle for WheelTriangle. Two concentric circles to stay sharp at any
 * zoom — outer black halo + white outline. */
function SvgHandle({ cx, cy, r = 2.4 }) {
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={r + 0.5} fill="none" stroke="#000" strokeOpacity="0.7" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r}       fill="none" stroke="#FFF" strokeWidth="1.4" />
    </g>
  )
}
