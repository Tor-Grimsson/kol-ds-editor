import { useEffect, useRef } from 'react'

/**
 * Harmony schemes — hue offsets for the five palette roles
 * (Primary / Secondary / Light / Dark / Accent) relative to the base hue.
 *
 * Same math family as the seed generators in modes/palette/colorMath.js
 * (SEED_MODES), with the random jitter removed so dragging the wheel is
 * deterministic and smooth. Split complementary is new but follows the
 * same role mapping shape as complementary.
 */
export const HARMONIES = [
  { id: 'analogous',     label: 'Analogous',           roleOffsets: [0, -30, -15, 15, 30] },
  { id: 'complementary', label: 'Complementary',       roleOffsets: [0, 0, 0, 180, 180] },
  { id: 'split',         label: 'Split complementary', roleOffsets: [0, 150, 210, 0, 150] },
  { id: 'triadic',       label: 'Triadic',             roleOffsets: [0, 120, 240, 0, 120] },
  { id: 'tetradic',      label: 'Tetradic',            roleOffsets: [0, 90, 180, 270, 0] },
]

export const harmonyById = (id) => HARMONIES.find((h) => h.id === id) ?? HARMONIES[0]

const norm = (h) => ((h % 360) + 360) % 360

/**
 * HarmonyWheel — canvas hue ring with a draggable base-hue handle and
 * satellite markers at the active harmony's scheme hues.
 *
 * Controlled: `hue` (0-360) + `onHueChange(nextHue)`. Dragging anywhere on
 * the ring (or the handle) emits continuously; arrow keys nudge the hue
 * when the canvas is focused. Pure hue picker — saturation/lightness of
 * the palette slots are preserved by the caller.
 */
export default function HarmonyWheel({ size = 248, hue, harmony, onHueChange }) {
  const canvasRef   = useRef(null)
  const draggingRef = useRef(false)
  const onHueRef    = useRef(onHueChange)
  onHueRef.current  = onHueChange

  const outerR = size / 2 - 8
  const innerR = outerR - 22
  const midR   = (outerR + innerR) / 2

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const cx = size / 2
    const cy = size / 2

    /* Angle mapping: hue 0 at 12 o'clock, clockwise. */
    const angleFor = (h) => ((h - 90) * Math.PI) / 180

    /* Hue ring — 360 thin annulus wedges (1.5° overlap hides seams). */
    for (let a = 0; a < 360; a++) {
      const a0 = angleFor(a)
      const a1 = angleFor(a + 1.5)
      ctx.beginPath()
      ctx.arc(cx, cy, outerR, a0, a1)
      ctx.arc(cx, cy, innerR, a1, a0, true)
      ctx.closePath()
      ctx.fillStyle = `hsl(${a}, 100%, 50%)`
      ctx.fill()
    }

    const baseHue = norm(hue)
    const offsets = [...new Set((harmony?.roleOffsets ?? [0]).map(norm))]

    /* Spokes + satellite markers at the scheme hues. */
    for (const off of offsets) {
      const h = norm(baseHue + off)
      const a = angleFor(h)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)'
      ctx.lineWidth = 1
      ctx.stroke()
      if (off === 0) continue /* base hue gets the big handle below */
      const x = cx + Math.cos(a) * midR
      const y = cy + Math.sin(a) * midR
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = `hsl(${h}, 100%, 50%)`
      ctx.fill()
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    /* Base-hue handle. */
    const ba = angleFor(baseHue)
    const bx = cx + Math.cos(ba) * midR
    const by = cy + Math.sin(ba) * midR
    ctx.beginPath()
    ctx.arc(bx, by, 9, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${baseHue}, 100%, 50%)`
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(bx, by, 10.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [size, hue, harmony, outerR, innerR, midR])

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = e.clientX - rect.left - rect.width / 2
    const dy = e.clientY - rect.top - rect.height / 2
    return { dist: Math.hypot(dx, dy), hue: norm((Math.atan2(dy, dx) * 180) / Math.PI + 90) }
  }

  const onPointerDown = (e) => {
    const { dist, hue: h } = pointFromEvent(e)
    if (dist < innerR - 14 || dist > outerR + 10) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onHueRef.current?.(h)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    onHueRef.current?.(pointFromEvent(e).hue)
  }

  const endDrag = () => { draggingRef.current = false }

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 15 : 3
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onHueRef.current?.(norm(hue + step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onHueRef.current?.(norm(hue - step))
    }
  }

  return (
    <canvas
      ref={canvasRef}
      role="slider"
      aria-label="Base hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(norm(hue))}
      tabIndex={0}
      className="cursor-pointer touch-none"
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  )
}
