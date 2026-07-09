import { useRef } from 'react'

/**
 * XYPad — 2D control pad: drag a single puck to vary two values at once.
 * Ported from kol-labs-single para-type lab/controls/XYPad.jsx (itself
 * inspired by Font Playground). Presentation-only — axis meaning, ranges
 * and the write path belong to the caller (ParatypeTools wires it to two
 * loop params via the coalesced layer-edit patch).
 *
 * Rail-adapted: fills its container width (square via aspect-ratio) and the
 * puck is positioned in %, so no fixed `size` prop is needed.
 */
export default function XYPad({
  xValue, yValue,
  xMin = 0, xMax = 1,
  yMin = 0, yMax = 1,
  onChange,
  xLabel,
  yLabel,
  className = '',
}) {
  const ref = useRef(null)

  const handlePos = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    const x = xMin + px * (xMax - xMin)
    const y = yMax - py * (yMax - yMin) /* invert: top = high */
    onChange?.(x, y)
  }

  /* No useCallback here on purpose — the labs original memoized these with
   * [] deps, freezing the first render's axis ranges into the drag math. */
  const onPointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId)
    handlePos(e)
  }
  const onPointerMove = (e) => {
    if (e.buttons === 0) return
    handlePos(e)
  }

  const span = (max, min) => (max - min) || 1
  const puckX = ((xValue - xMin) / span(xMax, xMin)) * 100
  const puckY = (1 - (yValue - yMin) / span(yMax, yMin)) * 100

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex justify-between kol-helper-10 tracking-widest text-meta">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        className="relative w-full aspect-square border border-fg-16 bg-fg-04 rounded cursor-crosshair touch-none"
      >
        {/* crosshair guides */}
        <div className="absolute inset-x-0 top-1/2 border-t border-fg-08" />
        <div className="absolute inset-y-0 left-1/2 border-l border-fg-08" />
        {/* puck */}
        <div
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-fg-96 border border-fg-04 pointer-events-none"
          style={{ left: `${puckX}%`, top: `${puckY}%` }}
        />
      </div>
    </div>
  )
}
