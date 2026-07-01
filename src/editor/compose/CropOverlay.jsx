import { useContext, useEffect, useState } from 'react'
import { CanvasZoomContext } from '../shell/Canvas'

/**
 * CropOverlay — crop-mode chrome for a photo layer with an explicit crop
 * window ({imgX,imgY,imgW,imgH} — the image's draw rect in frame-local px).
 *
 *   • drag inside the frame  → pan the image within the frame (clamped)
 *   • drag a frame handle    → crop: the frame moves/resizes while the
 *                              image stays FIXED in world space
 *   • Escape / Enter         → exit crop mode
 *
 * The ghost <img> shows the image's full extent at low opacity so the user
 * can see what they're cropping away. Chrome divides by zoom to stay
 * screen-constant.
 */

const HANDLE = 10  /* virtual px */

const DIRS = [
  { dir: 'NW', cursor: 'nwse-resize', hx: 0,   hy: 0   },
  { dir: 'N',  cursor: 'ns-resize',   hx: 0.5, hy: 0   },
  { dir: 'NE', cursor: 'nesw-resize', hx: 1,   hy: 0   },
  { dir: 'E',  cursor: 'ew-resize',   hx: 1,   hy: 0.5 },
  { dir: 'SE', cursor: 'nwse-resize', hx: 1,   hy: 1   },
  { dir: 'S',  cursor: 'ns-resize',   hx: 0.5, hy: 1   },
  { dir: 'SW', cursor: 'nesw-resize', hx: 0,   hy: 1   },
  { dir: 'W',  cursor: 'ew-resize',   hx: 0,   hy: 0.5 },
]

/* Clamp an image offset so the image covers the frame span where it can
 * (imgSpan ≥ span) or stays inside it where it can't (contain-fit init). */
function clampOffset(v, span, imgSpan) {
  const lo = Math.min(0, span - imgSpan)
  const hi = Math.max(0, span - imgSpan)
  return Math.min(hi, Math.max(lo, v))
}

export default function CropOverlay({
  layer, toVirtual, updateLayer, beginTransaction, commitTransaction, onExit,
}) {
  const zoom = useContext(CanvasZoomContext)
  const hs   = HANDLE / zoom
  const [drag, setDrag] = useState(null) /* { kind: 'pan'|dir, startVX, startVY, start } */

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const { vx, vy } = toVirtual(e.clientX, e.clientY)
      let dvx = vx - drag.startVX
      let dvy = vy - drag.startVY
      const st = drag.start

      if (drag.kind === 'pan') {
        /* Pointer delta into the layer's local frame when rotated. */
        const rot = (st.rotation * Math.PI) / 180
        if (rot) {
          const c = Math.cos(rot)
          const s = Math.sin(rot)
          const lx = dvx * c + dvy * s
          const ly = -dvx * s + dvy * c
          dvx = lx; dvy = ly
        }
        updateLayer(layer.id, {
          imgX: clampOffset(st.imgX + dvx, st.w, st.imgW),
          imgY: clampOffset(st.imgY + dvy, st.h, st.imgH),
        })
        return
      }

      /* Crop handle — frame changes, image world-position fixed. Only
       * offered on unrotated photos (handles hidden otherwise). */
      const IL = st.x + st.imgX  /* image world left/top */
      const IT = st.y + st.imgY
      let x = st.x, y = st.y, w = st.w, h = st.h
      if (drag.kind.includes('W')) {
        x = Math.min(Math.max(st.x + dvx, IL), st.x + st.w - 8)
        w = st.x + st.w - x
      }
      if (drag.kind.includes('E')) {
        const r = Math.max(Math.min(st.x + st.w + dvx, IL + st.imgW), st.x + 8)
        w = r - st.x
      }
      if (drag.kind.includes('N')) {
        y = Math.min(Math.max(st.y + dvy, IT), st.y + st.h - 8)
        h = st.y + st.h - y
      }
      if (drag.kind.includes('S')) {
        const b = Math.max(Math.min(st.y + st.h + dvy, IT + st.imgH), st.y + 8)
        h = b - st.y
      }
      updateLayer(layer.id, { x, y, w, h, imgX: IL - x, imgY: IT - y })
    }
    const onUp = () => {
      /* No unconditional write here — commit's reference-diff makes a
       * click-without-move a history no-op. */
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

  /* Escape / Enter exit crop mode. Capture phase beats the compose-level
   * deselect / delete handlers. */
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

  const startDrag = (kind) => (e) => {
    if (e.button !== 0) return
    /* Stop the stage router from reading this as an empty-stage marquee
     * (which would deselect and pop crop mode). */
    e.preventDefault(); e.stopPropagation()
    const { vx, vy } = toVirtual(e.clientX, e.clientY)
    beginTransaction()
    setDrag({
      kind, startVX: vx, startVY: vy,
      start: {
        x: layer.x, y: layer.y, w: layer.w, h: layer.h,
        imgX: layer.imgX, imgY: layer.imgY, imgW: layer.imgW, imgH: layer.imgH,
        rotation: layer.rotation ?? 0,
      },
    })
  }

  const rot    = layer.rotation ?? 0
  const accent = 'var(--kol-accent-primary)'

  return (
    <div
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y,
        width: layer.w, height: layer.h,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        pointerEvents: 'none',
        zIndex: 110,
      }}
    >
      {/* full-extent ghost — what lies outside the crop */}
      <img
        src={layer.src} alt="" draggable={false}
        style={{
          position: 'absolute',
          left: layer.imgX, top: layer.imgY,
          width: layer.imgW, height: layer.imgH,
          maxWidth: 'none',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
      {/* frame outline + pan surface */}
      <div
        onMouseDown={startDrag('pan')}
        style={{
          position: 'absolute', inset: 0,
          outline: `${1 / zoom}px solid ${accent}`,
          cursor: drag?.kind === 'pan' ? 'grabbing' : 'grab',
          pointerEvents: 'auto',
        }}
      />
      {/* crop handles — hidden on rotated photos.
        * ponytail: pan-only when rotated; add rotation-aware crop resize
        * (world-anchor math like CanvasArea's rotated resize) if needed. */}
      {rot === 0 && DIRS.map(({ dir, cursor, hx, hy }) => (
        <div
          key={dir}
          onMouseDown={startDrag(dir)}
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
  )
}
