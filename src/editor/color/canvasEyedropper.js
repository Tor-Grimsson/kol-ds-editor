/* Canvas-internal eyedropper. Builds the current canvas as an SVG,
 * rasterizes it onto an offscreen <canvas> at virtual-pixel resolution,
 * then waits for one click on the stage element, samples the pixel under
 * the cursor, and resolves with the hex.
 *
 * Replaces the native EyeDropper API. Works in every browser (Firefox,
 * Safari, Chromium) because it samples from a canvas we built ourselves
 * — no dependency on the browser exposing `window.EyeDropper`.
 *
 * Limitation vs native API: only picks colors from the editor canvas
 * itself, not from elsewhere on screen. That's the actual user
 * expectation for an "eyedropper" in this editor — picking from layers
 * already on the canvas. */

import { ASPECTS } from '../shell/aspects'
import { CANVAS_VIRTUAL_W } from '../shell/Canvas'
import { buildLayersSvg } from '../compose/build'
import { rgbToHex } from './cssVar'

/* Resolve aspect string to virtual canvas dimensions. */
function aspectToWH(aspect, customRatio) {
  const found = ASPECTS.find((a) => a.id === aspect) ?? ASPECTS[0]
  const ratio = aspect === 'custom' ? (customRatio || 1) : found.ratio
  return { w: CANVAS_VIRTUAL_W, h: Math.round(CANVAS_VIRTUAL_W / ratio) }
}

/* Build + rasterize, then await one click. Resolves with hex or null
 * (cancellation / outside click). */
export async function pickFromCanvas({
  layers,
  palette,
  aspect,
  customRatio,
  canvasFillHex,
}) {
  const { w: W, h: H } = aspectToWH(aspect, customRatio)

  const svg = buildLayersSvg({ layers, palette, aspect, customRatio })
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

  const cv = document.createElement('canvas')
  cv.width  = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })

  /* Draw the canvas fill first so transparent regions of the layer SVG
   * sample the bg, matching what the user sees. */
  if (canvasFillHex) {
    ctx.fillStyle = canvasFillHex
    ctx.fillRect(0, 0, W, H)
  }

  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => { ctx.drawImage(img, 0, 0, W, H); resolve() }
    img.onerror = (err) => reject(err)
    img.src = url
  })

  return new Promise((resolve) => {
    /* Stage element carries `data-tool` (CanvasArea wraps it). Falls back
     * to canceling if it's not mounted. */
    const stageEl = document.querySelector('[data-tool]')
    if (!stageEl) { resolve(null); return }

    const prevCursor = stageEl.style.cursor
    stageEl.style.cursor = 'crosshair'

    const cleanup = () => {
      document.removeEventListener('mousedown', onClick, true)
      document.removeEventListener('keydown',   onKey,   true)
      stageEl.style.cursor = prevCursor
    }

    const onClick = (e) => {
      /* Click outside the stage cancels (don't let the user accidentally
       * sample through a different surface). */
      if (!(stageEl === e.target || stageEl.contains(e.target))) {
        cleanup()
        resolve(null)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const rect = stageEl.getBoundingClientRect()
      const s = (rect.width / W) || 1
      const vx = Math.floor((e.clientX - rect.left) / s)
      const vy = Math.floor((e.clientY - rect.top)  / s)
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) {
        cleanup()
        resolve(null)
        return
      }
      const data = ctx.getImageData(vx, vy, 1, 1).data
      cleanup()
      resolve(rgbToHex(data[0], data[1], data[2]))
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cleanup()
        resolve(null)
      }
    }

    /* Capture phase so we beat CanvasArea's onMouseDown / global handlers. */
    document.addEventListener('mousedown', onClick, true)
    document.addEventListener('keydown',   onKey,   true)
  })
}
