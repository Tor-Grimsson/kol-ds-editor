import { useContext, useEffect, useRef, useState } from 'react'
import { CanvasZoomContext } from '../shell/Canvas'

/**
 * SoftformsHandleOverlay — on-canvas form manipulation for a 2D Soft Forms
 * layer, ported from labs SoftFormsPage's SDF hit-test + SVG selection frame
 * and folded into one CropOverlay-family mode component (the KineticElement-
 * Overlay precedent).
 *
 *   • click          → SDF hit-test select the topmost form under the pointer
 *                      (labs formDist sample); empty space deselects
 *   • drag a form    → move it (writes the form's clip-space x / y)
 *   • corner handles → scale (writes sx / sy in the form's local frame)
 *   • rotate knob    → rotate (writes rot, degrees)
 *   • Escape / Enter → exit form-edit mode
 *
 * Entered from SoftformsLayers' "Edit forms on canvas" (kol:softform-edit);
 * CanvasArea owns the mode state exactly like the kinetic overlay. Selection
 * syncs with the panel both ways via kol:softform-select. Writes wrap a
 * begin/commit transaction → one undo entry per drag (reference-diff makes a
 * click-without-move a no-op).
 *
 * The frame is drawn at each form's BASE position; while `motion` animates the
 * forms drift from it (labs has the same limitation — the handles track the
 * authored transform, not the live animated offset).
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t

/* JS port of the engine's shader formDist — signed-ish distance (negative
 * inside) for a form-local point q. Mirrors SoftFormsEngine.formDist. */
function formDist(t, qx, qy) {
  if (t === 'teardrop') {
    const taper = lerp(1, 0.36, clamp(qy * 0.5 + 0.5, 0, 1))
    return Math.hypot(qx / taper, qy) - 1
  }
  if (t === 'pill') {
    const dx = Math.max(Math.abs(qx) - 0.58, 0)
    return Math.hypot(dx, qy) - 0.5
  }
  if (t === 'super') {
    return (Math.abs(qx) ** 3.4 + Math.abs(qy) ** 3.4) ** (1 / 3.4) - 1
  }
  return Math.hypot(qx, qy) - 1 // dome / orb
}

/* World clip point → form-local q (centred, unrotated, /scale). */
function localQ(f, px, py) {
  const dx = px - (f.x ?? 0), dy = py - (f.y ?? 0)
  const a = -((f.rot || 0) * Math.PI) / 180
  const c = Math.cos(a), s = Math.sin(a)
  const sx = f.sx ?? 0.6
  return [(c * dx - s * dy) / sx, (s * dx + c * dy) / (f.sy ?? sx)]
}

/* Topmost form (last painted) under a clip point, or -1. */
function hitForm(forms, px, py) {
  for (let i = forms.length - 1; i >= 0; i--) {
    const [qx, qy] = localQ(forms[i], px, py)
    if (formDist(forms[i].t, qx, qy) < 0.06) return i
  }
  return -1
}

const HANDLE = 10 /* virtual-px handle box at zoom 1 */

export default function SoftformsHandleOverlay({
  layer, toVirtual, updateLayer, beginTransaction, commitTransaction, onExit,
}) {
  const zoom = useContext(CanvasZoomContext)
  const dragRef = useRef(null)
  const [sel, setSel] = useState(-1)

  const forms = Array.isArray(layer.forms) ? layer.forms : []
  const w = Math.max(1, layer.w ?? 1)
  const h = Math.max(1, layer.h ?? 1)
  const ar = w / h
  const rot = layer.rotation ?? 0

  /* Panel → canvas selection sync. */
  useEffect(() => {
    const onSel = (e) => { if (e.detail?.id === layer.id && e.detail.from === 'panel') setSel(e.detail.index) }
    window.addEventListener('kol:softform-select', onSel)
    return () => window.removeEventListener('kol:softform-select', onSel)
  }, [layer.id])

  /* Escape / Enter exit (capture phase beats compose-level deselect/delete). */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onExit() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onExit])

  /* pointer client → layer-local px, compensating for the layer's rotation
   * (the container is rotated about its centre; default transform-origin). */
  const localPx = (clientX, clientY) => {
    const { vx, vy } = toVirtual(clientX, clientY)
    const cx = layer.x + w / 2, cy = layer.y + h / 2
    const a = -rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
    const dx = vx - cx, dy = vy - cy
    return { x: c * dx - s * dy + w / 2, y: s * dx + c * dy + h / 2 }
  }
  const pxToClip = (px, py) => ({ x: ((px / w) - 0.5) * 2 * ar, y: (0.5 - py / h) * 2 })
  const clipToPx = (fx, fy) => ({ x: (fx / ar * 0.5 + 0.5) * w, y: (0.5 - fy * 0.5) * h })

  /* Selection-frame geometry in layer-local px (labs handlesOf). */
  const handlesOf = (f) => {
    const a = ((f.rot || 0) * Math.PI) / 180
    const c = Math.cos(a), s = Math.sin(a)
    const sx = f.sx ?? 0.6, sy = f.sy ?? sx
    const world = (lx, ly) => clipToPx((f.x ?? 0) + c * lx - s * ly, (f.y ?? 0) + s * lx + c * ly)
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([ux, uy]) => world(ux * sx, uy * sy))
    return { corners, rotate: world(0, sy + 0.22) }
  }

  const writeForms = (next) => updateLayer(layer.id, { forms: next })

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const m = localPx(e.clientX, e.clientY)
    /* handle hit on the selected form first (rotate knob / scale corners) */
    if (sel >= 0 && forms[sel]) {
      const hh = handlesOf(forms[sel])
      const near = (p) => Math.hypot(p.x - m.x, p.y - m.y) < 12 / zoom
      if (near(hh.rotate)) { beginTransaction(); dragRef.current = { mode: 'rotate', i: sel }; return }
      if (hh.corners.some(near)) { beginTransaction(); dragRef.current = { mode: 'scale', i: sel, start: { ...forms[sel] } }; return }
    }
    const clip = pxToClip(m.x, m.y)
    const hit = hitForm(forms, clip.x, clip.y)
    setSel(hit)
    window.dispatchEvent(new CustomEvent('kol:softform-select', { detail: { id: layer.id, index: hit, from: 'canvas' } }))
    if (hit >= 0) { beginTransaction(); dragRef.current = { mode: 'move', i: hit, grab: clip, start: { ...forms[hit] } } }
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const m = localPx(e.clientX, e.clientY)
    const clip = pxToClip(m.x, m.y)
    if (d.mode === 'move') {
      writeForms(forms.map((f, i) => (i === d.i
        ? { ...f, x: clamp(d.start.x + (clip.x - d.grab.x), -1.2, 1.2), y: clamp(d.start.y + (clip.y - d.grab.y), -1.2, 1.2) }
        : f)))
    } else if (d.mode === 'scale') {
      const a = -((d.start.rot || 0) * Math.PI) / 180
      const c = Math.cos(a), s = Math.sin(a)
      const dx = clip.x - (d.start.x ?? 0), dy = clip.y - (d.start.y ?? 0)
      const lx = c * dx - s * dy, ly = s * dx + c * dy // pointer in the form's local frame
      writeForms(forms.map((f, i) => (i === d.i ? { ...f, sx: clamp(Math.abs(lx), 0.12, 1.6), sy: clamp(Math.abs(ly), 0.12, 1.6) } : f)))
    } else if (d.mode === 'rotate') {
      writeForms(forms.map((f, i) => (i === d.i
        ? { ...f, rot: ((Math.atan2(clip.x - (f.x ?? 0), clip.y - (f.y ?? 0)) * 180) / Math.PI + 360) % 360 }
        : f)))
    }
  }

  const onPointerUp = (e) => {
    if (dragRef.current) { commitTransaction(); dragRef.current = null }
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { /* already released */ }
  }

  const selForm = sel >= 0 && sel < forms.length ? forms[sel] : null
  const hh = selForm ? handlesOf(selForm) : null
  const accent = 'var(--kol-accent-primary)'
  const stroke = 1 / zoom
  const hs = HANDLE / zoom

  return (
    <div
      style={{
        position: 'absolute',
        left: layer.x, top: layer.y, width: w, height: h,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        pointerEvents: 'none',
        zIndex: 120,
      }}
    >
      <svg
        width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'auto',
          touchAction: 'none',
          cursor: dragRef.current ? 'grabbing' : 'crosshair',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* mode outline */}
        <rect
          x={0} y={0} width={w} height={h} fill="none"
          stroke={accent} strokeOpacity="0.5" strokeWidth={stroke}
          strokeDasharray={`${4 / zoom} ${4 / zoom}`}
        />
        {hh && (
          <g>
            <polygon
              points={hh.corners.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={accent} strokeWidth={stroke * 1.5}
            />
            <line
              x1={(hh.corners[0].x + hh.corners[1].x) / 2} y1={(hh.corners[0].y + hh.corners[1].y) / 2}
              x2={hh.rotate.x} y2={hh.rotate.y}
              stroke={accent} strokeOpacity="0.6" strokeWidth={stroke}
            />
            <circle cx={hh.rotate.x} cy={hh.rotate.y} r={hs * 0.6} fill={accent} />
            {hh.corners.map((p, i) => (
              <rect key={i} x={p.x - hs / 2} y={p.y - hs / 2} width={hs} height={hs} fill="white" stroke={accent} strokeWidth={stroke} />
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
