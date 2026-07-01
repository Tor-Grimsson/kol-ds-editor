import { useContext, useEffect, useRef, useState } from 'react'
import { CanvasZoomContext } from '../shell/Canvas'
import { normalizePathRings } from './path-math'

/**
 * PathNodeOverlay — node/bezier editing chrome for a selected `path` layer.
 *
 * Draws each anchor (square) and its in/out bezier handles (round knobs on a
 * thin leash) in the 1080-virtual coord space, over the stage. Interaction:
 *
 *   • drag anchor  → moves the node + both handles together
 *   • drag handle  → adjusts that handle; the opposite handle mirrors it
 *                    (smooth) unless Alt is held (independent / break tangent)
 *   • click anchor → selects it; Delete/Backspace removes it (min 2 kept)
 *   • Escape       → exit node-edit mode
 *
 * Nodes are layer-local; on drag-commit we renormalize so the anchor bbox
 * re-origins to (0,0) and the layer's {x,y,w,h} stay in sync. Live drag
 * skips renormalization to avoid origin jitter under the cursor.
 */

const ANCHOR = 10  /* virtual px */
const KNOB   = 5    /* virtual px radius */

export default function PathNodeOverlay({
  layer, viewW, viewH, toVirtual,
  updateLayer, beginTransaction, commitTransaction, onExit,
}) {
  const [selNode, setSelNode] = useState(null)
  const [drag, setDrag]       = useState(null) /* { type:'anchor'|'in'|'out', index } */
  const movedRef              = useRef(false)  /* did this drag actually move? */

  /* Chrome renders in virtual px inside the zoomed transform — divide by
   * zoom so anchors/knobs stay screen-constant instead of vanishing at 25%
   * and ballooning at 400%. */
  const zoom   = useContext(CanvasZoomContext)
  const anchor = ANCHOR / zoom
  const knob   = KNOB / zoom

  /* Latest layer geometry for the window drag listeners (which close over a
   * render snapshot otherwise). */
  const nodesRef = useRef(layer.nodes)
  const holesRef = useRef(layer.holes)
  const posRef   = useRef({ x: layer.x, y: layer.y })
  nodesRef.current = layer.nodes
  holesRef.current = layer.holes
  posRef.current   = { x: layer.x, y: layer.y }

  const nodes = layer.nodes ?? []

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      movedRef.current = true
      const { vx, vy } = toVirtual(e.clientX, e.clientY)
      const lx = vx - posRef.current.x
      const ly = vy - posRef.current.y
      const cur = nodesRef.current
      const next = cur.map((n, i) => {
        if (i !== drag.index) return n
        if (drag.type === 'anchor') {
          const dx = lx - n.x
          const dy = ly - n.y
          return {
            x: lx, y: ly,
            in:  n.in  ? { x: n.in.x  + dx, y: n.in.y  + dy } : null,
            out: n.out ? { x: n.out.x + dx, y: n.out.y + dy } : null,
          }
        }
        /* extract — pull symmetric handles out of a corner anchor (the anchor
         * itself stays put). Gives endpoints / corners bezier handles. */
        if (drag.type === 'extract') {
          return { ...n, out: { x: lx, y: ly }, in: { x: 2 * n.x - lx, y: 2 * n.y - ly } }
        }
        /* handle drag — set the dragged side; mirror the other around the
         * anchor unless Alt breaks the tangent. */
        const mirror = { x: 2 * n.x - lx, y: 2 * n.y - ly }
        if (drag.type === 'out') {
          return { ...n, out: { x: lx, y: ly }, in: e.altKey ? n.in : mirror }
        }
        return { ...n, in: { x: lx, y: ly }, out: e.altKey ? n.out : mirror }
      })
      updateLayer(layer.id, { nodes: next })
    }
    const onUp = () => {
      /* Only renormalize if the drag actually moved — a bare click (select)
       * must not write, or the commit's reference-diff sees a "change" and
       * pushes a junk undo entry. */
      if (movedRef.current) {
        const norm = normalizePathRings(nodesRef.current, holesRef.current)
        updateLayer(layer.id, {
          nodes: norm.nodes, holes: norm.holes,
          x: posRef.current.x + norm.dx,
          y: posRef.current.y + norm.dy,
          w: norm.w, h: norm.h,
        })
      }
      commitTransaction()
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, layer.id, toVirtual, updateLayer, commitTransaction])

  /* Delete removes the selected node; Escape exits. Capture phase so we beat
   * the compose-level delete-layer / deselect handlers. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onExit()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selNode != null) {
        e.preventDefault(); e.stopPropagation()
        const cur = nodesRef.current
        if (cur.length <= 2) return  /* keep a drawable minimum */
        const kept = cur.filter((_, i) => i !== selNode)
        const norm = normalizePathRings(kept, holesRef.current)
        beginTransaction()
        updateLayer(layer.id, {
          nodes: norm.nodes, holes: norm.holes,
          x: posRef.current.x + norm.dx,
          y: posRef.current.y + norm.dy,
          w: norm.w, h: norm.h,
        })
        commitTransaction()
        setSelNode(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [selNode, layer.id, updateLayer, beginTransaction, commitTransaction, onExit])

  const startDrag = (type, index) => (e) => {
    e.preventDefault(); e.stopPropagation()
    setSelNode(index)
    movedRef.current = false
    beginTransaction()
    /* Alt-drag on an anchor extracts fresh handles instead of moving it. */
    const t = type === 'anchor' && e.altKey ? 'extract' : type
    setDrag({ type: t, index })
  }

  const accent = 'var(--kol-accent-primary)'

  return (
    <svg
      width="100%" height="100%"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, zIndex: 120, pointerEvents: 'none' }}
    >
      <g transform={`translate(${layer.x} ${layer.y})`}>
        {/* handle leashes + knobs */}
        {nodes.map((n, i) => (
          <g key={`h${i}`}>
            {n.in && (
              <>
                <line x1={n.x} y1={n.y} x2={n.in.x} y2={n.in.y}
                  stroke={accent} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
                <circle cx={n.in.x} cy={n.in.y} r={knob} fill="white" stroke={accent}
                  strokeWidth={1} vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'auto', cursor: 'move' }}
                  onMouseDown={startDrag('in', i)} />
              </>
            )}
            {n.out && (
              <>
                <line x1={n.x} y1={n.y} x2={n.out.x} y2={n.out.y}
                  stroke={accent} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
                <circle cx={n.out.x} cy={n.out.y} r={knob} fill="white" stroke={accent}
                  strokeWidth={1} vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'auto', cursor: 'move' }}
                  onMouseDown={startDrag('out', i)} />
              </>
            )}
          </g>
        ))}
        {/* anchors */}
        {nodes.map((n, i) => (
          <rect key={`a${i}`}
            x={n.x - anchor / 2} y={n.y - anchor / 2}
            width={anchor} height={anchor}
            fill={i === selNode ? accent : 'white'}
            stroke={accent} strokeWidth={1} vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={startDrag('anchor', i)} />
        ))}
      </g>
    </svg>
  )
}
