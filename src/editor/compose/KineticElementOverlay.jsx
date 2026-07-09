import { useContext, useEffect, useRef, useState } from 'react'
import { CanvasZoomContext } from '../shell/Canvas'

/**
 * KineticElementOverlay — element-edit chrome for a kinetic layer (the labs
 * InstancePositioner + SelectionFrame suite, folded into one CropOverlay-style
 * mode component). Entered from KineticPanel's "Edit on canvas"
 * (kol:kinetic-edit); CanvasArea owns the mode state like crop/node-edit.
 *
 *   • click            → hit-test select an element (engine hitTest — topmost
 *                        glyph bbox under the pointer); empty frame deselects
 *   • drag an element  → move it (writes the instance's normalized `offset`;
 *                        grouped elements move as one)
 *   • corner handles   → proportional font-size scale (labs corner-scale
 *                        semantics; grouped elements scale by one factor)
 *   • Escape / Enter   → exit element-edit mode
 *
 * The engine is reached through its host element (`__kolKineticEngine`,
 * registered by KineticType) — no refs threaded through LayerRenderer. The
 * selection frame is rAF-driven straight to the DOM (the glyph bbox animates
 * every transport tick — React re-render would fight the loop; labs
 * SelectionFrame precedent). Element selection syncs with KineticPanel both
 * ways via kol:kinetic-element.
 */

const HANDLE = 10 /* virtual px */
const PAD = 6    /* frame padding around the glyph bbox, virtual px */

const CORNERS = [
  { key: 'nw', hx: 0, hy: 0, cursor: 'nwse-resize' },
  { key: 'ne', hx: 1, hy: 0, cursor: 'nesw-resize' },
  { key: 'sw', hx: 0, hy: 1, cursor: 'nesw-resize' },
  { key: 'se', hx: 1, hy: 1, cursor: 'nwse-resize' },
]

/* Indices of the group the element at `i` belongs to (itself when ungrouped). */
const memberIndicesOf = (insts, i) => {
  const g = insts[i]?.group
  if (!g) return [i]
  return insts.reduce((acc, x, j) => (x.group === g ? [...acc, j] : acc), [])
}

export default function KineticElementOverlay({
  layer, initialIndex = 0, toVirtual, updateLayer, beginTransaction, commitTransaction, onExit,
}) {
  const zoom = useContext(CanvasZoomContext)
  const frameRef = useRef(null)
  const [drag, setDrag] = useState(null) /* { kind:'move'|'scale', ..., start:{ comp, members, sizes? } } */
  const [selIdx, setSelIdx] = useState(initialIndex)

  const insts = layer.comp?.instances ?? []
  const clamped = selIdx == null ? null : Math.max(0, Math.min(selIdx, insts.length - 1))
  const memberIds = clamped == null || !insts.length
    ? []
    : memberIndicesOf(insts, clamped).map((j) => insts[j]?.id).filter(Boolean)

  /* Latest values for the rAF loop without rebinding it. */
  const memberIdsRef = useRef(memberIds)
  memberIdsRef.current = memberIds

  /* The engine registers itself on the kinetic host element (KineticType
   * constructor) — look it up fresh so remounts are transparent. */
  const getEngine = () =>
    document.querySelector(`[data-layer-id="${layer.id}"][data-kinetic-host]`)?.__kolKineticEngine ?? null

  /* Panel → canvas selection sync. */
  useEffect(() => {
    const onEl = (e) => {
      if (e.detail?.id === layer.id && e.detail.from === 'panel') setSelIdx(e.detail.index)
    }
    window.addEventListener('kol:kinetic-element', onEl)
    return () => window.removeEventListener('kol:kinetic-element', onEl)
  }, [layer.id])

  /* Selection frame — union bbox over the selected element's group, written
   * straight to the DOM each frame (the bbox animates with the transport). */
  useEffect(() => {
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const frame = frameRef.current
      if (!frame) return
      const eng = getEngine()
      const ids = memberIdsRef.current
      if (!eng || !ids.length) { frame.style.display = 'none'; return }
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
      for (const id of ids) {
        const r = eng.getInstanceRect?.(id)
        if (!r) continue
        x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y)
        x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h)
      }
      if (x1 === Infinity) { frame.style.display = 'none'; return }
      frame.style.display = 'block'
      frame.style.left = `${x1 - PAD}px`
      frame.style.top = `${y1 - PAD}px`
      frame.style.width = `${x2 - x1 + PAD * 2}px`
      frame.style.height = `${y2 - y1 + PAD * 2}px`
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // getEngine closes over layer.id only — the query re-runs each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id])

  /* Escape / Enter exit element-edit mode (crop-mode precedent). Capture
   * phase beats the compose-level deselect / delete handlers. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        onExit()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onExit])

  /* Drag loop — window listeners while a move/scale is in flight
   * (CropOverlay pattern; comp snapshots live in drag.start). */
  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const st = drag.start
      const startInsts = st.comp?.instances ?? []
      if (drag.kind === 'move') {
        const { vx, vy } = toVirtual(e.clientX, e.clientY)
        const dnx = (vx - drag.startVX) / Math.max(1, layer.w)
        const dny = (vy - drag.startVY) / Math.max(1, layer.h)
        updateLayer(layer.id, {
          comp: {
            ...st.comp,
            instances: startInsts.map((x, j) => (st.members.includes(j)
              ? { ...x, offset: { x: (x.offset?.x || 0) + dnx, y: (x.offset?.y || 0) + dny } }
              : x)),
          },
        })
        return
      }
      /* scale — distance from the frame centre vs the grab distance drives a
       * proportional font-size factor across the group (labs corner scale). */
      const dist = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy)
      const factor = dist / drag.startDist
      updateLayer(layer.id, {
        comp: {
          ...st.comp,
          instances: startInsts.map((x, j) => {
            const mi = st.members.indexOf(j)
            if (mi < 0) return x
            return { ...x, fontSize: Math.max(8, Math.min(1200, Math.round(st.sizes[mi] * factor))) }
          }),
        },
      })
    }
    const onUp = () => {
      /* commit's reference-diff makes a click-without-move a history no-op */
      commitTransaction()
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, layer.id, layer.w, layer.h, toVirtual, updateLayer, commitTransaction])

  /* Click / drag on the frame surface — hit-test select, then arm a move. */
  const onSurfaceDown = (e) => {
    if (e.button !== 0) return
    /* Stop the stage router from reading this as a layer move / marquee. */
    e.preventDefault(); e.stopPropagation()
    const eng = getEngine()
    const hitId = eng?.hitTest?.(e.clientX, e.clientY) ?? null
    if (!hitId) { setSelIdx(null); return }
    const index = insts.findIndex((x) => x.id === hitId)
    if (index < 0) return
    setSelIdx(index)
    window.dispatchEvent(new CustomEvent('kol:kinetic-element', { detail: { id: layer.id, index, from: 'canvas' } }))
    const { vx, vy } = toVirtual(e.clientX, e.clientY)
    beginTransaction()
    setDrag({
      kind: 'move', startVX: vx, startVY: vy,
      start: { comp: layer.comp, members: memberIndicesOf(insts, index) },
    })
  }

  const onCornerDown = (e) => {
    if (e.button !== 0 || clamped == null) return
    e.preventDefault(); e.stopPropagation()
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const members = memberIndicesOf(insts, clamped)
    beginTransaction()
    setDrag({
      kind: 'scale', cx, cy,
      startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      start: {
        comp: layer.comp,
        members,
        sizes: members.map((j) => (typeof insts[j]?.fontSize === 'number' ? insts[j].fontSize : 100)),
      },
    })
  }

  const rot    = layer.rotation ?? 0
  const accent = 'var(--kol-accent-primary)'
  const hs     = HANDLE / zoom

  return (
    <div
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y,
        width: layer.w, height: layer.h,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        pointerEvents: 'none',
        zIndex: 120,
      }}
    >
      {/* mode outline + hit-test/move surface */}
      <div
        onMouseDown={onSurfaceDown}
        style={{
          position: 'absolute', inset: 0,
          outline: `${1 / zoom}px dashed ${accent}`,
          cursor: drag?.kind === 'move' ? 'grabbing' : 'default',
          pointerEvents: 'auto',
        }}
      />
      {/* selection frame (rAF-positioned) + corner scale handles */}
      <div
        ref={frameRef}
        style={{
          position: 'absolute',
          display: 'none',
          border: `${1 / zoom}px solid ${accent}`,
          pointerEvents: 'none',
        }}
      >
        {CORNERS.map(({ key, hx, hy, cursor }) => (
          <div
            key={key}
            onMouseDown={onCornerDown}
            style={{
              position: 'absolute',
              left: `calc(${hx * 100}% - ${hs / 2}px)`,
              top:  `calc(${hy * 100}% - ${hs / 2}px)`,
              width: hs, height: hs,
              background: 'white',
              border: `${1 / zoom}px solid ${accent}`,
              cursor,
              pointerEvents: 'auto',
            }}
          />
        ))}
      </div>
    </div>
  )
}
