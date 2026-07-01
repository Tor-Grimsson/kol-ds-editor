import { curveBlend, clamp } from './curveMath'

/**
 * Visualizes the morph curve as a dashed UI-yellow polyline laid over a
 * frame. y-axis: blend (0 at the bottom, 1 at the top — rising curve =
 * morphing toward Cut B). x-axis: position along the text length.
 *
 * For curve='custom' renders the cubic-bezier path via SVG `<path>` and
 * draws two draggable control-point handles (Figma/After-Effects style)
 * with tangent lines back to the endpoints. The handles carry data-role
 * so the parent TypeCanvas drag system can pick them up.
 */

const SAMPLES = 48
const STROKE  = 'var(--ui-warning, #F2C94C)'

function sampleCurve(width, height, curve, blend, cp1, cp2) {
  const pts = []
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1)
    const v = clamp(curveBlend(t, curve, blend, cp1, cp2))
    pts.push({ x: t * width, y: (1 - v) * height })
  }
  return pts
}

function Handle({ cx, cy, role }) {
  return (
    <circle
      data-role={role}
      cx={cx}
      cy={cy}
      r="6"
      fill={STROKE}
      stroke="white"
      strokeWidth="1.5"
      style={{ cursor: 'grab', pointerEvents: 'auto' }}
    />
  )
}

export default function CurveOverlay({ width, height, curve, blend, cp1, cp2 }) {
  const isCustom = curve === 'custom'

  /* Endpoints stay anchored at (0, blend=0) and (1, blend=1) for custom. The
   * two control points slide inside [0..1] in normalized space. */
  const cp1Px = isCustom ? { x: cp1.x * width, y: (1 - cp1.y) * height } : null
  const cp2Px = isCustom ? { x: cp2.x * width, y: (1 - cp2.y) * height } : null

  const pts = sampleCurve(width, height, curve, blend, cp1, cp2)
  const polylinePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  /* Custom curve: build a smooth cubic path instead of a polyline. */
  const cubicPath = isCustom
    ? `M0 ${height.toFixed(1)} C ${(cp1.x * width).toFixed(1)} ${((1 - cp1.y) * height).toFixed(1)}, ${(cp2.x * width).toFixed(1)} ${((1 - cp2.y) * height).toFixed(1)}, ${width.toFixed(1)} 0`
    : null

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute"
      style={{
        left:    0,
        top:     0,
        zIndex:  3,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {isCustom ? (
        <>
          <path
            d={cubicPath}
            fill="none"
            stroke={STROKE}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.85"
          />
          {/* Tangent lines from endpoints to control points. */}
          <line
            x1="0"   y1={height}
            x2={cp1Px.x} y2={cp1Px.y}
            stroke={STROKE} strokeWidth="1" opacity="0.45"
          />
          <line
            x1={width} y1="0"
            x2={cp2Px.x} y2={cp2Px.y}
            stroke={STROKE} strokeWidth="1" opacity="0.45"
          />
          <circle cx="0"     cy={height} r="3" fill={STROKE} opacity="0.85" />
          <circle cx={width} cy="0"      r="3" fill={STROKE} opacity="0.85" />
          <Handle cx={cp1Px.x} cy={cp1Px.y} role="curve-cp1" />
          <Handle cx={cp2Px.x} cy={cp2Px.y} role="curve-cp2" />
        </>
      ) : (
        <>
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={STROKE}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.85"
          />
          <circle cx={pts[0].x}                cy={pts[0].y}                r="3" fill={STROKE} opacity="0.85" />
          <circle cx={pts[pts.length - 1].x}   cy={pts[pts.length - 1].y}   r="3" fill={STROKE} opacity="0.85" />
        </>
      )}
    </svg>
  )
}
