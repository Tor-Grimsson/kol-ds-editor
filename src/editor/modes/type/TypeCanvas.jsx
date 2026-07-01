import { useEffect, useRef, useState } from 'react'
import TypeFrame from './TypeFrame'
import { CANVAS_VIRTUAL_W } from '../../shell/Canvas'

/**
 * Interactive canvas for TypeLab.
 *
 * Frames render in 1080-virtual coords (left/top/width in px). The wrapping
 * `Canvas` element scales the whole layer to fit the viewport. Drag deltas
 * convert from screen px → virtual px via `clientX/scale` so motion feels
 * natural at any zoom.
 *
 * Selection model: at most one selected frame. Click empty canvas to deselect.
 * Drag handlers live here; per-frame chrome lives in `TypeFrame`.
 */

const MIN_FRAME_WIDTH = 50

export default function TypeCanvas({
  frames,
  selectedId,
  onSelect,
  onUpdateFrame,
  onDeleteFrame,
}) {
  const canvasRef = useRef(null)
  const [drag, setDrag] = useState(null)
  /* drag = { mode: 'move' | 'resize-E' | 'resize-W',
              frameId, startX, startY, startFrame } | null */

  const getScale = () => {
    if (!canvasRef.current) return 1
    const w = canvasRef.current.getBoundingClientRect().width
    return w > 0 ? w / CANVAS_VIRTUAL_W : 1
  }

  const onCanvasMouseDown = (e) => {
    /* Click on the bare canvas (not on a frame) deselects. */
    if (e.target === canvasRef.current) {
      onSelect(null)
    }
  }

  const onFrameMouseDown = (e, frame) => {
    e.stopPropagation()
    onSelect(frame.id)
    const role = e.target.dataset?.role
    const direction = e.target.dataset?.direction
    if (role === 'resize-handle' && (direction === 'E' || direction === 'W')) {
      setDrag({
        mode:       `resize-${direction}`,
        frameId:    frame.id,
        startX:     e.clientX,
        startY:     e.clientY,
        startFrame: { ...frame },
      })
    } else if (role === 'blend-handle') {
      setDrag({
        mode:       'blend',
        frameId:    frame.id,
        startX:     e.clientX,
        startY:     e.clientY,
        startFrame: { ...frame },
      })
    } else if (role === 'curve-cp1' || role === 'curve-cp2') {
      setDrag({
        mode:       role,
        frameId:    frame.id,
        startX:     e.clientX,
        startY:     e.clientY,
        startFrame: { ...frame, curveCp1: { ...(frame.curveCp1 ?? { x: 0.33, y: 0.33 }) }, curveCp2: { ...(frame.curveCp2 ?? { x: 0.66, y: 0.66 }) } },
      })
    } else {
      setDrag({
        mode:       'move',
        frameId:    frame.id,
        startX:     e.clientX,
        startY:     e.clientY,
        startFrame: { ...frame },
      })
    }
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const scale = getScale()
      const dx = (e.clientX - drag.startX) / scale
      const dy = (e.clientY - drag.startY) / scale
      const f = drag.startFrame
      if (drag.mode === 'move') {
        onUpdateFrame(drag.frameId, { x: f.x + dx, y: f.y + dy })
      } else if (drag.mode === 'resize-E') {
        onUpdateFrame(drag.frameId, { w: Math.max(MIN_FRAME_WIDTH, f.w + dx) })
      } else if (drag.mode === 'resize-W') {
        const newW = Math.max(MIN_FRAME_WIDTH, f.w - dx)
        const newX = f.x + (f.w - newW)
        onUpdateFrame(drag.frameId, { x: newX, w: newW })
      } else if (drag.mode === 'blend') {
        const blend = Math.max(0, Math.min(1, f.blend + dx / f.w))
        onUpdateFrame(drag.frameId, { blend })
      } else if (drag.mode === 'curve-cp1' || drag.mode === 'curve-cp2') {
        const overlayH  = f.size * 1.2
        const which     = drag.mode === 'curve-cp1' ? 'curveCp1' : 'curveCp2'
        const startCp   = f[which] ?? (drag.mode === 'curve-cp1' ? { x: 0.33, y: 0.33 } : { x: 0.66, y: 0.66 })
        const newX      = Math.max(0, Math.min(1, startCp.x + dx / f.w))
        /* Screen y down = blend down; we want blend UP, so invert. */
        const newY      = Math.max(-0.5, Math.min(1.5, startCp.y - dy / overlayH))
        onUpdateFrame(drag.frameId, { [which]: { x: newX, y: newY } })
      }
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, onUpdateFrame])

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full"
      style={{ cursor: drag?.mode === 'move' ? 'move' : 'default' }}
      onMouseDown={onCanvasMouseDown}
    >
      {frames.map((frame) => (
        <TypeFrame
          key={frame.id}
          frame={frame}
          selected={selectedId === frame.id}
          onMouseDown={onFrameMouseDown}
          onUpdate={(patch) => onUpdateFrame(frame.id, patch)}
          onDelete={() => onDeleteFrame(frame.id)}
        />
      ))}
    </div>
  )
}
