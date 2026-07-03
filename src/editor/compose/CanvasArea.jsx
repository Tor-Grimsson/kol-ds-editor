import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Canvas, { CANVAS_VIRTUAL_W } from '../shell/Canvas'
import { useComposeState, resolveColor, COVER_TYPES, CANVAS_W } from './state'
import LayerRenderer from './LayerRenderer'
import SelectionOverlay from './SelectionOverlay'
import PathNodeOverlay from './PathNodeOverlay'
import { pathD, normalizePath, normalizePathRings, rotatePathNodes, scalePathNodes, dist } from './path-math'
import { scaleBoolChildren } from './boolean-ops'
import CropOverlay from './CropOverlay'
import { matchAny } from '../state/keymap'
import { useTool } from '../state/tools'
import { useColorTarget } from '../color/useColorTarget'
import { useLayerEdit } from './useLayerEdit'
import { computeSnapTargets, findSnap } from './snap'
import { transport } from '../params/transport'

/* Per-tool cursor on the canvas stage. Using system cursors directly —
 * `crosshair` for shape-creation tools (Photoshop/Figma convention),
 * `cell` for pattern (suggests grid drag-fill), `text` for the text
 * insertion I-beam. Custom SVG cursors were attempted but Vite's `?url`
 * + browser SVG-cursor support is fragile across environments; the
 * system cursors are universally reliable and read instantly. */
const CURSOR_FOR_TOOL = {
  rect:    'crosshair',
  ellipse: 'crosshair',
  pattern: 'cell',
  text:    'text',
  pen:     'crosshair',
  zoom:    'zoom-in',
}

/**
 * CanvasArea — rendered composition + Figma-style pointer router.
 *
 * Mouse routing (mousedown):
 *   • [data-handle] inside the selected overlay  → start a resize drag.
 *   • [data-layer-id] non-cover layer            → select + start a move drag.
 *   • [data-layer-id] cover layer                → select only.
 *   • empty stage                                → deselect.
 *
 * Drag state lives in a ref-backed scratch object so listeners attached to
 * window don't have to rebind on every render. Pixel deltas are divided by
 * the live scale (screen-px / virtual-px) to keep movement 1:1 with the
 * cursor regardless of viewport zoom.
 *
 * Keyboard (when a positioned layer is selected):
 *   • Arrow keys   — nudge ±1 virtual px (±10 with Shift)
 *   • Backspace/Del— remove layer
 *   • Escape       — deselect
 */
const SOCIAL_ASPECTS = ['1:1', '4:5', '9:16']

/* hex (#RRGGBB) + alpha (0..1) → rgba() string. Used to apply canvas fill
 * opacity at render time without storing alpha in the color value. */
function hexWithAlpha(hex, alpha) {
  if (!hex || typeof hex !== 'string') return hex
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function CanvasArea() {
  const {
    aspect, view, layers, palette,
    canvasRatio, showGrid,
    canvasFill, canvasFillOpacity, infiniteFill,
    selectedId, selectedIds, select, toggleSelection, selectMany,
    addLayer,
    updateLayer, removeLayer, deleteSelected, duplicateLayer, toggleLayer, toggleLayerLock,
    flipSelected,
    groupLayers, ungroupLayer,
    insertFromLibrary,
    activePaint, setActivePaint,
    snapEnabled,
    showRulers, toggleRulers,
    guides, setGuides,
    undo, redo, canUndo, canRedo,
    beginTransaction, commitTransaction,
  } = useComposeState()
  const { tool, setTool } = useTool()
  /* Paint shortcuts (D / X / Shift+X / N) write through useColorTarget so
   * the inspector, the picker, and the keymap share one writer. */
  const colorTarget = useColorTarget()
  /* Arrow-key nudges write through the shared coalescing editor (same
   * mechanism as the inspector's slider drags) so a burst of keypresses
   * collapses into ONE undo entry. 600ms of quiet commits; a selection
   * change flushes immediately via useLayerEdit's id-change flush, so
   * nudges on different layers never merge. */
  const nudgeEdit = useLayerEdit(selectedId, { history: 'coalesce', coalesceMs: 600 })
  /* Double-0 opacity chord — timestamp of the last bare 0 press. */
  const zeroTapRef = useRef(null)

  const selectedLayer  = layers.find((l) => l.id === selectedId) ?? null
  const isPositionedSel = selectedLayer && !COVER_TYPES.includes(selectedLayer.type)

  /* All selected positioned layers — drives multi-wireframe rendering. */
  const selectedPositionedLayers = selectedIds
    .map((id) => layers.find((l) => l.id === id))
    .filter((l) => l && !COVER_TYPES.includes(l.type))
  const isMultiSel = selectedPositionedLayers.length > 1

  /* Canvas fill is now a frame-level property (was: background-typed layer).
   * Falls back to a legacy background layer's color if present, for in-flight
   * drafts that haven't been migrated. */
  const legacyBg     = layers.find((l) => l.type === 'background' && l.visible)
  const legacyBgHex  = legacyBg ? resolveColor(legacyBg.color, palette) : null
  const fillHex      = resolveColor(canvasFill, palette) ?? legacyBgHex
  const bgColor      = fillHex
    ? (canvasFillOpacity < 1 ? hexWithAlpha(fillHex, canvasFillOpacity) : fillHex)
    : null

  /* Infinite backdrop (area around the frame). `null` = None → transparent,
   * letting the themed `.kol-editor-canvas` surface show through; a var/hex
   * paints it directly. Rendered on the outer wrapper below so it fills the
   * whole stage behind the grid + frame. */
  const infiniteColor = infiniteFill == null ? 'transparent' : (resolveColor(infiniteFill, palette) ?? 'transparent')

  const visibleLayers = layers

  /* ─── stage ref + on-demand scale ───────────────────────────────────
   * Scale (screen-px / virtual-px) is computed fresh from the stage rect
   * on every coord conversion. Caching it via ResizeObserver was unsafe
   * because RO does NOT fire on CSS-transform changes (CanvasFrame applies
   * `transform: scale()` to a parent), so the cached value went stale on
   * window resize and silently broke drag-create position. */
  const stageRef = useRef(null)

  const getScale = useCallback(() => {
    const node = stageRef.current
    if (!node) return 1
    const w = node.getBoundingClientRect().width
    return w > 0 ? w / CANVAS_VIRTUAL_W : 1
  }, [])

  /* Stage pointer → transport (virtual px) — feeds the 'Pointer over layer'
   * modulation sources. Listener lives on the stage node so rail/panel
   * mouse traffic never notifies bound layers. */
  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const onMove = (e) => {
      const r = node.getBoundingClientRect()
      if (r.width === 0) return
      const k = CANVAS_VIRTUAL_W / r.width
      transport.setStagePointer((e.clientX - r.left) * k, (e.clientY - r.top) * k)
    }
    const onLeave = () => transport.setStagePointer(null)
    node.addEventListener('mousemove', onMove)
    node.addEventListener('mouseleave', onLeave)
    return () => {
      node.removeEventListener('mousemove', onMove)
      node.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  /* ─── drag state ─── */
  const [drag, setDrag] = useState(null)
  /* drag = { mode: 'move' | 'resize-NW|N|NE|E|SE|S|SW|W',
              layerId, startX, startY, startBox: {x,y,w,h} }
   *  | { mode: 'create', tool, startVX, startVY, vx, vy, vw, vh }
   *  | { mode: 'marquee', additive, startVX, startVY, vx, vy, vw, vh } */

  /* Snap guides — {h, v} positions in virtual px while a move-drag is
   * actively snapping to a target. Cleared on pointerup. */
  const [snapGuides, setSnapGuides] = useState(null)

  /* Line tool — pen-style placement. First click sets P1; second click
   * commits a line layer between P1 and P2. linePreview tracks the cursor
   * for the preview line that follows between clicks. Esc cancels.
   * Switching tools also cancels (effect below). */
  const [linePlacement, setLinePlacement] = useState(null) /* { x1, y1 } | null */
  const [linePreview, setLinePreview]     = useState(null) /* { vx, vy } | null */

  /* Pen tool — multi-click bezier authoring. `pen` holds the in-progress
   * node list (virtual coords) + the live cursor for the rubber-band
   * preview; a click places an anchor, click-drag pulls symmetric handles.
   * penDrag tracks the anchor whose handles the current drag is shaping. */
  const [pen, setPen] = useState(null) /* { nodes:[{x,y,in,out}], cursor:{x,y}|null } | null */
  const penDrag       = useRef(null)   /* { index, ax, ay } | null */
  const penRef        = useRef(pen)
  penRef.current      = pen
  const penActive     = pen != null

  /* Node-edit mode — id of the path layer whose nodes/handles are editable.
   * Entered by double-clicking a path; exited on Escape or deselect. */
  const [nodeEditId, setNodeEditId] = useState(null)

  /* Crop mode — id of the photo layer being cropped. Entered by
   * double-clicking a photo; exited on Escape / Enter / deselect. */
  const [cropId, setCropId] = useState(null)

  /* Enter crop on a photo. First entry initializes the crop window
   * {imgX,imgY,imgW,imgH} (frame-local px) from the layer's current fit —
   * visually a no-op, it just makes the implicit object-fit rect explicit
   * so pan/crop edits have something to write to. Needs the image's
   * natural size, so the init is async on first crop of a given layer. */
  const enterCrop = useCallback((layer) => {
    select(layer.id)
    if (layer.imgW != null) { setCropId(layer.id); return }
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const fitK = layer.fit === 'contain' ? Math.min : Math.max
      const k  = fitK(layer.w / img.naturalWidth, layer.h / img.naturalHeight)
      const iw = img.naturalWidth * k
      const ih = img.naturalHeight * k
      updateLayer(layer.id, {
        imgX: (layer.w - iw) / 2, imgY: (layer.h - ih) / 2,
        imgW: iw, imgH: ih,
      })
      setCropId(layer.id)
    }
    img.src = layer.src
  }, [select, updateLayer])

  /* Virtual canvas height for the active canvas ratio — sizes the pen/node
   * SVG overlays' viewBox so their coords match the layer coord space (no Y
   * distortion on non-square canvases). Ratio comes from the real pixel
   * dimensions (canvasW/canvasH), so custom sizes work too. */
  const viewH = CANVAS_VIRTUAL_W / (canvasRatio || 1)

  /* Commit the pen draft to a `path` layer. <2 nodes = nothing drawable →
   * just drop back to Select. Nodes are re-origined so the layer's {x,y,w,h}
   * bound the anchors and node coords stay layer-local. Outline by default
   * (no fill, 2px stroke) — the usual expectation for a freshly-penned path. */
  const finishPath = useCallback((nodes, closed) => {
    setPen(null)
    penDrag.current = null
    if (!nodes || nodes.length < 2) { setTool('select'); return }
    const norm = normalizePath(nodes)
    addLayer('path', {
      nodes: norm.nodes, closed,
      x: norm.dx, y: norm.dy, w: norm.w, h: norm.h,
      color: null, stroke: 'palette:dark', strokeWidth: 2,
    })
    setTool('select')
  }, [addLayer, setTool])

  /* Convert a clientX/Y point to virtual canvas coords. Scale read fresh
   * each call so the math is self-consistent with the rect we just took. */
  const clientToVirtual = useCallback((clientX, clientY) => {
    const node = stageRef.current
    if (!node) return { vx: 0, vy: 0 }
    const rect = node.getBoundingClientRect()
    const s = (rect.width / CANVAS_VIRTUAL_W) || 1
    return {
      vx: (clientX - rect.left) / s,
      vy: (clientY - rect.top)  / s,
    }
  }, [])

  const onStageMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    /* Zoom tool is handled on the OUTER wrapper (covers the backdrop too) —
     * never create/select from the stage while it's armed. */
    if (tool === 'zoom') return
    /* Prevent the document-level click-away listener from clobbering this
     * canvas selection. */
    e.nativeEvent.stopPropagation()

    /* Pen — click places an anchor; click-drag pulls symmetric handles.
     * Clicking the first anchor (within ~10 screen px) with ≥2 nodes closes
     * the path. The handle pull + rubber-band live in the penActive effect. */
    if (tool === 'pen') {
      e.preventDefault()
      const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
      const nodes = penRef.current?.nodes ?? []
      if (nodes.length >= 2) {
        const first = nodes[0]
        if (dist(vx, vy, first.x, first.y) * getScale() < 10) {
          finishPath(nodes, true)
          return
        }
      }
      const idx = nodes.length
      setPen({ nodes: [...nodes, { x: vx, y: vy, in: null, out: null }], cursor: { x: vx, y: vy } })
      penDrag.current = { index: idx, ax: vx, ay: vy }
      return
    }

    /* Line is a pen tool — click-click instead of drag. First click sets
     * P1; second click commits the layer between the two endpoints. */
    if (tool === 'line') {
      e.preventDefault()
      const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
      if (!linePlacement) {
        setLinePlacement({ x1: vx, y1: vy })
        setLinePreview({ vx, vy })
        return
      }
      const x1 = linePlacement.x1
      const y1 = linePlacement.y1
      const x2 = vx
      const y2 = vy
      const x  = Math.min(x1, x2)
      const y  = Math.min(y1, y2)
      const w  = Math.max(1, Math.abs(x2 - x1))
      const h  = Math.max(1, Math.abs(y2 - y1))
      /* Slope picks which bbox diagonal renders. '\' → ↘ from top-left,
       * '/' → ↙ from bottom-left. Derived from the sign of (P2 - P1). */
      const slope = ((x2 >= x1) === (y2 >= y1)) ? '\\' : '/'
      addLayer('shape', {
        x, y, w, h,
        kind: 'line',
        slope,
        color: null,
        stroke: 'palette:dark',
        strokeWidth: 2,
      })
      setLinePlacement(null)
      setLinePreview(null)
      setTool('select')
      return
    }

    /* Non-Select tools enter create mode — ignore handles/layers underneath
     * and start drawing transient bounds. */
    if (tool !== 'select') {
      e.preventDefault()
      const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
      setDrag({ mode: 'create', tool, startVX: vx, startVY: vy, vx, vy, vw: 0, vh: 0 })
      return
    }

    const handleEl = e.target.closest('[data-handle]')
    /* Walk up to the OUTERMOST [data-layer-id] so clicking inside a group
     * selects the group itself, not the inner child. */
    let layerEl = e.target.closest('[data-layer-id]')
    while (layerEl?.parentElement) {
      const outer = layerEl.parentElement.closest?.('[data-layer-id]')
      if (!outer) break
      layerEl = outer
    }

    /* Resize / rotate handle wins. Locked layers ignore both. */
    if (handleEl && selectedLayer && !COVER_TYPES.includes(selectedLayer.type) && !selectedLayer.locked) {
      const dir = handleEl.getAttribute('data-handle')
      e.preventDefault()
      beginTransaction()
      if (dir === 'ROT') {
        /* Rotate about the layer center: remember where the pointer angle
         * started so the layer follows the drag as a relative twist. */
        const cx = selectedLayer.x + selectedLayer.w / 2
        const cy = selectedLayer.y + selectedLayer.h / 2
        const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
        setDrag({
          mode: 'rotate',
          layerId: selectedLayer.id,
          cx, cy,
          startAngle: Math.atan2(vy - cy, vx - cx),
          startRot: typeof selectedLayer.rotation === 'number' ? selectedLayer.rotation : 0,
        })
        return
      }
      setDrag({
        mode: `resize-${dir}`,
        layerId: selectedLayer.id,
        startX: e.clientX, startY: e.clientY,
        startBox: {
          x: selectedLayer.x, y: selectedLayer.y, w: selectedLayer.w, h: selectedLayer.h,
          /* Aspect lock snapshot — read once at drag start so the user can
           * toggle it via the inspector mid-drag without breaking the
           * in-flight resize. null/undefined = unlocked. */
          aspectLocked: selectedLayer.aspectLocked,
          rotation: typeof selectedLayer.rotation === 'number' ? selectedLayer.rotation : 0,
          /* Crop rect snapshot (photo layers) — scales with the frame so a
           * cropped photo resizes like an uncropped one. */
          imgX: selectedLayer.imgX, imgY: selectedLayer.imgY,
          imgW: selectedLayer.imgW, imgH: selectedLayer.imgH,
          /* Node snapshot (path layers) — bbox-resize scales the geometry
           * with the box. Nodes are normalized (origin 0,0, bbox = w,h), so
           * plain ratio-scaling keeps them in sync. */
          nodes: selectedLayer.type === 'path' ? selectedLayer.nodes : undefined,
          holes: selectedLayer.type === 'path' ? selectedLayer.holes : undefined,
          /* Children snapshot (bool layers) — resize scales the operands so
           * the computed result tracks the box, path-node style. */
          children: selectedLayer.type === 'bool' ? selectedLayer.children : undefined,
        },
      })
      return
    }

    if (layerEl) {
      const id = layerEl.getAttribute('data-layer-id')
      const layer = layers.find((l) => l.id === id)
      if (!layer) return
      /* Locked layers are canvas-inert: not selectable, not draggable —
       * the click falls through to the stage (marquee / deselect). They
       * remain selectable from the layer panel. */
      if (!layer.locked) {
        if (e.shiftKey) {
          toggleSelection(id)
          return
        }
        select(id)
        if (!COVER_TYPES.includes(layer.type)) {
          e.preventDefault()
          beginTransaction()
          setDrag({
            mode: 'move',
            layerId: id,
            startX: e.clientX, startY: e.clientY,
            startBox: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
          })
        }
        return
      }
    }

    /* Empty stage with the Select tool — start a marquee. Tiny drags
     * (≤ 4 vpx) commit as a click-deselect on pointerup. Shift-marquee
     * adds to the existing selection. */
    e.preventDefault()
    const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
    setDrag({
      mode: 'marquee',
      additive: e.shiftKey,
      startVX: vx, startVY: vy,
      vx, vy, vw: 0, vh: 0,
    })
  }, [tool, layers, selectedLayer, select, toggleSelection, beginTransaction, clientToVirtual, getScale, finishPath, linePlacement, addLayer, setTool])

  /* Window listeners while dragging. */
  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      const s = getScale()

      if (drag.mode === 'create' || drag.mode === 'marquee') {
        const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
        const x = Math.min(drag.startVX, vx)
        const y = Math.min(drag.startVY, vy)
        const w = Math.abs(vx - drag.startVX)
        const h = Math.abs(vy - drag.startVY)
        setDrag((d) => d && (d.mode === 'create' || d.mode === 'marquee') ? { ...d, vx: x, vy: y, vw: w, vh: h } : d)
        return
      }

      if (drag.mode === 'rotate') {
        const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
        const ang = Math.atan2(vy - drag.cy, vx - drag.cx)
        let deg = drag.startRot + ((ang - drag.startAngle) * 180) / Math.PI
        if (e.shiftKey) deg = Math.round(deg / 15) * 15
        deg = ((deg % 360) + 360) % 360
        updateLayer(drag.layerId, { rotation: Math.round(deg * 10) / 10 })
        return
      }

      const dx = (e.clientX - drag.startX) / s
      const dy = (e.clientY - drag.startY) / s
      const { startBox, mode, layerId } = drag

      if (mode === 'move') {
        const cand = { x: startBox.x + dx, y: startBox.y + dy, w: startBox.w, h: startBox.h }
        if (!snapEnabled) {
          updateLayer(layerId, { x: cand.x, y: cand.y })
          return
        }
        const targets = computeSnapTargets(layers, layerId, CANVAS_W, viewH, guides)
        const snap = findSnap(cand, targets)
        updateLayer(layerId, { x: cand.x + snap.dx, y: cand.y + snap.dy })
        setSnapGuides(snap.hGuide != null || snap.vGuide != null ? { h: snap.hGuide, v: snap.vGuide } : null)
        return
      }

      let { x, y, w, h } = startBox
      const dir = mode.slice('resize-'.length)
      /* On a rotated layer the pointer delta must act in the layer's LOCAL
       * frame — rotate the world delta by -rotation before the edge math. */
      const rotRad = ((startBox.rotation ?? 0) * Math.PI) / 180
      const rcos = Math.cos(rotRad)
      const rsin = Math.sin(rotRad)
      const ldx = rotRad ? dx * rcos + dy * rsin : dx
      const ldy = rotRad ? -dx * rsin + dy * rcos : dy
      if (dir.includes('E')) w = Math.max(8, startBox.w + ldx)
      if (dir.includes('S')) h = Math.max(8, startBox.h + ldy)
      if (dir.includes('W')) {
        const nw = Math.max(8, startBox.w - ldx)
        x = startBox.x + (startBox.w - nw)
        w = nw
      }
      if (dir.includes('N')) {
        const nh = Math.max(8, startBox.h - ldy)
        y = startBox.y + (startBox.h - nh)
        h = nh
      }
      /* Aspect lock — constrain w/h to the snapshot ratio. Corners pick
       * the driving axis by larger absolute change; edges drive on their
       * own axis. When N/W edges are involved, x/y get re-anchored so the
       * far corner stays put. */
      const ar = startBox.aspectLocked
      if (Number.isFinite(ar) && ar > 0) {
        const isCorner = dir.length === 2
        const driveW = isCorner
          ? Math.abs(w - startBox.w) >= Math.abs(h - startBox.h)
          : (dir === 'E' || dir === 'W')
        if (driveW) {
          h = Math.max(8, Math.round(w / ar))
          if (dir.includes('N')) y = startBox.y + startBox.h - h
        } else {
          w = Math.max(8, Math.round(h * ar))
          if (dir.includes('W')) x = startBox.x + startBox.w - w
        }
      }
      /* Rotated resize: the unrotated x/y math above drifts because the
       * center moves. Re-derive x/y so the point OPPOSITE the dragged
       * handle stays fixed in world space (Figma behavior). */
      if (rotRad) {
        const ax = dir.includes('E') ? -1 : dir.includes('W') ? 1 : 0
        const ay = dir.includes('S') ? -1 : dir.includes('N') ? 1 : 0
        const cx0 = startBox.x + startBox.w / 2
        const cy0 = startBox.y + startBox.h / 2
        const anchorX = cx0 + ((ax * startBox.w) / 2) * rcos - ((ay * startBox.h) / 2) * rsin
        const anchorY = cy0 + ((ax * startBox.w) / 2) * rsin + ((ay * startBox.h) / 2) * rcos
        const cx1 = anchorX - (((ax * w) / 2) * rcos - ((ay * h) / 2) * rsin)
        const cy1 = anchorY - (((ax * w) / 2) * rsin + ((ay * h) / 2) * rcos)
        x = cx1 - w / 2
        y = cy1 - h / 2
      }
      const patch = { x, y, w, h }
      /* Cropped photo: the crop window scales with the frame so resize
       * behaves like an uncropped photo (image scales, framing kept). */
      if (startBox.imgW != null) {
        const kx = w / startBox.w
        const ky = h / startBox.h
        patch.imgX = startBox.imgX * kx
        patch.imgY = startBox.imgY * ky
        patch.imgW = startBox.imgW * kx
        patch.imgH = startBox.imgH * ky
      }
      /* Path: scale nodes (anchors + handles) with the box, holes included. */
      if (startBox.nodes) {
        const kx = w / startBox.w
        const ky = h / startBox.h
        patch.nodes = scalePathNodes(startBox.nodes, kx, ky)
        if (startBox.holes) patch.holes = startBox.holes.map((r) => scalePathNodes(r, kx, ky))
      }
      /* Bool: scale the children (boxes + path geometry) with the box so
       * the recomputed result tracks the resize. */
      if (startBox.children) {
        patch.children = scaleBoolChildren(startBox.children, w / startBox.w, h / startBox.h)
      }
      updateLayer(layerId, patch)
    }
    const onUp = () => {
      if (drag.mode === 'create') {
        commitCreateDrag(drag)
        setDrag(null)
        return
      }
      if (drag.mode === 'marquee') {
        commitMarqueeDrag(drag)
        setDrag(null)
        return
      }
      commitTransaction()
      setDrag(null)
      setSnapGuides(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // commitCreateDrag is closed over below; re-include via deps would force
    // the listener to rebind every render. Stable enough for v1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, updateLayer, commitTransaction, clientToVirtual, getScale])

  /* Pen-tool live preview — tracks the cursor between the two clicks so
   * the user sees a dashed preview line snapping with their pointer. */
  useEffect(() => {
    if (!linePlacement) return
    const onMove = (e) => {
      const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
      setLinePreview({ vx, vy })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [linePlacement, clientToVirtual])

  /* Esc cancels an in-progress line placement. Capture phase so we beat
   * the editor-level deselect handler. */
  useEffect(() => {
    if (!linePlacement) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setLinePlacement(null)
        setLinePreview(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [linePlacement])

  /* Switching to a different tool while line placement is in flight
   * cancels the placement. */
  useEffect(() => {
    if (tool !== 'line' && linePlacement) {
      setLinePlacement(null)
      setLinePreview(null)
    }
  }, [tool, linePlacement])

  /* Pen — while a draft is open, track the cursor for the rubber-band and,
   * during a handle pull (penDrag), shape the just-placed anchor's handles
   * symmetrically. Gated on penActive (a boolean) so the listeners bind once
   * per draft, not on every cursor move. */
  useEffect(() => {
    if (!penActive) return
    const onMove = (e) => {
      const { vx, vy } = clientToVirtual(e.clientX, e.clientY)
      const pd = penDrag.current
      setPen((p) => {
        if (!p) return p
        if (pd) {
          /* ~3 screen px dead zone — a micro-twitch between down and up must
           * leave the anchor a true corner (null handles), not a fake-smooth
           * node with zero-length handles. Inside the zone the handles snap
           * back to null, so a retreating drag also restores the corner. */
          const pulled = dist(vx, vy, pd.ax, pd.ay) * getScale() >= 3
          const nodes = p.nodes.map((n, i) => i === pd.index
            ? (pulled
              ? { ...n, out: { x: vx, y: vy }, in: { x: 2 * pd.ax - vx, y: 2 * pd.ay - vy } }
              : { ...n, in: null, out: null })
            : n)
          return { nodes, cursor: { x: vx, y: vy } }
        }
        return { ...p, cursor: { x: vx, y: vy } }
      })
    }
    const onUp = () => { penDrag.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [penActive, clientToVirtual, getScale])

  /* Pen — Enter commits the open path, Escape cancels the draft. Capture
   * phase so we beat the compose-level deselect handler. */
  useEffect(() => {
    if (!penActive) return
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        finishPath(penRef.current?.nodes, false)
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        setPen(null); penDrag.current = null; setTool('select')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [penActive, finishPath, setTool])

  /* Switching away from the pen mid-draft commits whatever's drawn. */
  useEffect(() => {
    if (tool !== 'pen' && penRef.current) finishPath(penRef.current.nodes, false)
  }, [tool, finishPath])

  /* Exit node-edit / crop when their layer is no longer selected (deselect /
   * marquee / selecting another layer all route through selectedIds). */
  useEffect(() => {
    if (nodeEditId && !selectedIds.includes(nodeEditId)) setNodeEditId(null)
  }, [nodeEditId, selectedIds])
  useEffect(() => {
    if (cropId && !selectedIds.includes(cropId)) setCropId(null)
  }, [cropId, selectedIds])

  /* Inspector's crop button routes here (same CustomEvent idiom as
   * kol:show-shortcuts) — CanvasArea owns crop-mode state. */
  useEffect(() => {
    const onCropEvent = (e) => {
      /* Video sources excluded — crop math assumes a still. */
      const layer = layers.find((l) => l.id === e.detail && l.type === 'photo' && l.srcType !== 'video' && !l.locked)
      if (layer) enterCrop(layer)
    }
    window.addEventListener('kol:enter-crop', onCropEvent)
    return () => window.removeEventListener('kol:enter-crop', onCropEvent)
  }, [layers, enterCrop])

  /* Enter node-edit on a path. Live `rotation` is BAKED into the node
   * geometry first (rotate about the box center, renormalize, zero the
   * prop) — node editing always operates on rotation-free geometry, same
   * philosophy as flip-baking. One discrete history entry for the bake. */
  const enterNodeEdit = useCallback((layer) => {
    const rot = typeof layer.rotation === 'number' ? layer.rotation : 0
    if (rot && Array.isArray(layer.nodes)) {
      const cx = (layer.w ?? 0) / 2
      const cy = (layer.h ?? 0) / 2
      const norm = normalizePathRings(
        rotatePathNodes(layer.nodes, rot, cx, cy),
        layer.holes?.map((r) => rotatePathNodes(r, rot, cx, cy)),
      )
      updateLayer(layer.id, {
        nodes: norm.nodes, holes: norm.holes,
        x: layer.x + norm.dx, y: layer.y + norm.dy,
        w: norm.w, h: norm.h,
        rotation: 0,
      })
    }
    select(layer.id)
    setNodeEditId(layer.id)
  }, [select, updateLayer])

  /* Double-click with the Select tool → node-edit (paths) or crop (photos). */
  const onStageDoubleClick = useCallback((e) => {
    if (tool !== 'select') return
    const layerEl = e.target.closest('[data-layer-id]')
    if (!layerEl) return
    const id = layerEl.getAttribute('data-layer-id')
    const layer = layers.find((l) => l.id === id)
    if (layer?.type === 'path') {
      e.preventDefault()
      enterNodeEdit(layer)
    } else if (layer?.type === 'photo' && layer.srcType !== 'video' && !layer.locked) {
      e.preventDefault()
      enterCrop(layer)
    }
  }, [tool, layers, enterNodeEdit, enterCrop])

  /* Live pen-preview path: the committed segments plus a rubber-band cubic
   * from the last anchor (honoring its out-handle) to the cursor. */
  const penPreviewD = useMemo(() => {
    if (!pen || pen.nodes.length === 0) return ''
    let d = pathD(pen.nodes, false)
    if (pen.cursor) {
      const last = pen.nodes[pen.nodes.length - 1]
      const c1 = last.out ?? last
      d += ` C ${c1.x} ${c1.y} ${pen.cursor.x} ${pen.cursor.y} ${pen.cursor.x} ${pen.cursor.y}`
    }
    return d
  }, [pen])

  const nodeEditLayer = nodeEditId
    ? (layers.find((l) => l.id === nodeEditId && l.type === 'path') ?? null)
    : null

  const cropLayer = cropId
    ? (layers.find((l) => l.id === cropId && l.type === 'photo' && l.imgW != null) ?? null)
    : null

  /* Commit a marquee-drag — find every layer whose AABB intersects the
   * marquee rect and select them. Tiny drags (≤ 4 vpx in either axis) fall
   * through as a plain click-deselect (or no-op when shift-additive). */
  const commitMarqueeDrag = useCallback((d) => {
    if (d.mode !== 'marquee') return
    if (d.vw < 4 && d.vh < 4) {
      if (!d.additive) select(null)
      return
    }
    const matched = layers
      .filter((l) => typeof l.x === 'number' && typeof l.y === 'number')
      /* Hidden / locked layers can't be marquee-selected — matching what a
       * direct click can reach (invisible layers render nothing; locked
       * layers shouldn't join a bulk move/delete by accident). */
      .filter((l) => l.visible !== false && l.locked !== true)
      .filter((l) => {
        const lw = l.w ?? 0
        const lh = l.h ?? 0
        return l.x < d.vx + d.vw && l.x + lw > d.vx && l.y < d.vy + d.vh && l.y + lh > d.vy
      })
      .map((l) => l.id)
    selectMany(matched, { additive: d.additive })
  }, [layers, select, selectMany])

  /* Commit a create-drag — instantiate the matching layer at the dragged
   * bounds and revert to the Select tool. Tiny drags (likely a mis-click)
   * fall through to a default-sized insert at the click point. */
  const commitCreateDrag = useCallback((d) => {
    if (d.mode !== 'create') return
    const tooSmall = d.vw < 8 || d.vh < 8
    let x = Math.max(0, Math.min(CANVAS_W - 8, d.vx))
    let y = Math.max(0, Math.min(viewH - 8, d.vy))
    let w = d.vw
    let h = d.vh
    if (tooSmall) {
      /* Default sizes per tool when the user just clicks. */
      const defaults = {
        text:     { w: 600, h: 120 },
        rect:     { w: 240, h: 240 },
        ellipse:  { w: 240, h: 240 },
        triangle: { w: 240, h: 240 },
        polygon:  { w: 240, h: 240 },
        star:     { w: 240, h: 240 },
        pattern:  { w: CANVAS_W, h: viewH },
      }
      const def = defaults[d.tool] ?? { w: 200, h: 200 }
      w = def.w; h = def.h
      x = Math.max(0, Math.min(CANVAS_W - w, d.startVX - w / 2))
      y = Math.max(0, Math.min(viewH - h, d.startVY - h / 2))
    }

    const extras = { x, y, w, h }
    switch (d.tool) {
      case 'text':     addLayer('text',    extras); break
      case 'rect':     addLayer('shape',   { ...extras, kind: 'rect',     color: 'palette:dark' }); break
      case 'ellipse':  addLayer('shape',   { ...extras, kind: 'ellipse',  color: 'palette:dark' }); break
      case 'triangle': addLayer('shape',   { ...extras, kind: 'triangle', color: 'palette:dark' }); break
      /* line is pen-tool only — never reaches commitCreateDrag (the
       * tool === 'line' branch in onStageMouseDown short-circuits). */
      case 'polygon':  addLayer('shape',   { ...extras, kind: 'polygon',  sides: 5, color: 'palette:dark' }); break
      case 'star':     addLayer('shape',   { ...extras, kind: 'star',     points: 5, innerRatio: 0.5, color: 'palette:dark' }); break
      case 'pattern':  addLayer('pattern', extras); break
      default: return
    }
    setTool('select')
  }, [addLayer, setTool, viewH])

  /* Click-away to deselect.
   *
   *  - When 'canvas' is selected and the click is INSIDE the Layers panel
   *    (`[data-layer-stack]`) but NOT on the Canvas row, deselect. Lets the
   *    user click empty space in the layer stack to drop canvas selection.
   *    Inspector / color wheel / opacity slider / rails outside the stack
   *    keep the selection so canvas properties can be edited.
   *  - Otherwise (regular layer selected), clicks inside any layer row, the
   *    canvas surface, or either rail are kept. Clicks elsewhere deselect. */
  useEffect(() => {
    const onDocDown = (e) => {
      if (e.button !== 0) return

      if (selectedIds.includes('canvas')) {
        const insideStack = e.target.closest?.('[data-layer-stack]')
        if (insideStack) {
          const onCanvasRow  = e.target.closest?.('[data-layer-id="canvas"]')
          const onAnyRow     = e.target.closest?.('.kol-compose-layer-row')
          const onButton     = e.target.closest?.('button')
          /* Buttons inside the stack (Add layer [+], Trash, Group, lock/eye)
           * never deselect canvas on click — they perform actions on the
           * current selection or open menus. The [+] dropdown then commits
           * a new layer via addLayer which replaces selection naturally. */
          if (!onCanvasRow && !onAnyRow && !onButton) select(null)
          return
        }
        /* outside the stack: fall through to default rules — keep selection
         * for inspector / wheel / canvas / rails */
      }

      /* Single attr check — anything inside the editor shell keeps
       * selection. New rails / panels are covered automatically by being
       * mounted inside `<EditorShell data-editor-keep-selection>`. */
      if (e.target.closest?.('[data-editor-keep-selection]')) return
      select(null)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [select, selectedIds])

  /* Keyboard handler — dispatches matched shortcuts from `state/keymap.js`.
   * Skips when typing into an input. */
  useEffect(() => {
    const layerOnlyIds = () => selectedIds.filter((id) => id !== 'canvas')

    const onKey = (e) => {
      const t = e.target
      const editable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (editable) return

      /* Layer opacity digits (Photoshop convention): 1-9 = 10-90%, 0 = 100%,
       * 0 twice within 500ms = 0%. Handled before keymap matching — combos
       * can't express ranges or the double-tap chord. */
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && /^[0-9]$/.test(e.key) && selectedLayer) {
        e.preventDefault()
        const digit = Number(e.key)
        const now = performance.now()
        let v
        if (digit === 0) {
          v = zeroTapRef.current != null && now - zeroTapRef.current < 500 ? 0 : 1
          zeroTapRef.current = now
        } else {
          v = digit / 10
          zeroTapRef.current = null
        }
        updateLayer(selectedLayer.id, { opacity: v })
        return
      }

      const shortcut = matchAny(e)
      if (!shortcut) return

      const layer = selectedLayer

      switch (shortcut.id) {
        /* undo / redo / deselect are handled by useGlobalShortcuts at the
         * Editor.jsx level so they work in every mode. Don't double-handle
         * here. */
        case 'undo':
        case 'redo':
        case 'redo-alt':
        case 'deselect':
          return

        case 'duplicate':   if (layer) { e.preventDefault(); duplicateLayer(layer.id) }; return

        case 'delete-back':
        case 'delete-fwd': {
          if (layerOnlyIds().length === 0) return
          e.preventDefault()
          deleteSelected()
          return
        }

        case 'group': {
          const ids = layerOnlyIds()
          if (ids.length >= 2) { e.preventDefault(); groupLayers(ids) }
          return
        }
        case 'ungroup': {
          if (layer && layer.type === 'group') { e.preventDefault(); ungroupLayer(layer.id) }
          return
        }

        case 'toggle-rulers':     e.preventDefault(); toggleRulers(); return
        case 'toggle-lock':       if (layer) { e.preventDefault(); toggleLayerLock(layer.id) }; return
        case 'toggle-visibility': if (layer) { e.preventDefault(); toggleLayer(layer.id) }; return

        case 'flip-h':
        case 'flip-v': {
          if (layerOnlyIds().length === 0) return
          e.preventDefault()
          flipSelected(shortcut.id === 'flip-h' ? 'h' : 'v')
          return
        }

        case 'nudge-left':
        case 'nudge-right':
        case 'nudge-up':
        case 'nudge-down':
        case 'nudge-left-10':
        case 'nudge-right-10':
        case 'nudge-up-10':
        case 'nudge-down-10': {
          if (!layer || !isPositionedSel) return
          e.preventDefault()
          const step = shortcut.id.endsWith('-10') ? 10 : 1
          const axis = shortcut.id.includes('left') ? [-1, 0]
                     : shortcut.id.includes('right') ? [1, 0]
                     : shortcut.id.includes('up') ? [0, -1]
                     : [0, 1]
          nudgeEdit.patch({ x: layer.x + axis[0] * step, y: layer.y + axis[1] * step })
          return
        }

        case 'show-shortcuts':
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('kol:show-shortcuts'))
          return

        case 'tool-select':  e.preventDefault(); setNodeEditId(null); setTool('select'); return
        /* A = direct-select: drop into node-edit on the selected path. */
        case 'node-edit': {
          e.preventDefault()
          if (selectedLayer?.type === 'path') { setTool('select'); enterNodeEdit(selectedLayer) }
          return
        }
        case 'tool-text':    e.preventDefault(); setTool('text');    return
        case 'tool-pen':     e.preventDefault(); setTool('pen');     return
        case 'tool-rect':    e.preventDefault(); setTool('rect');    return
        case 'tool-ellipse': e.preventDefault(); setTool('ellipse'); return
        case 'tool-pattern': e.preventDefault(); setTool('pattern'); return
        case 'tool-zoom':    e.preventDefault(); setTool('zoom');    return

        /* Color shortcuts always fire — no selection-dependent gates.
         * SwatchStack is canonical app-level state; writes propagate to
         * selection when applicable but never depend on it. */
        case 'paint-default': {
          e.preventDefault()
          beginTransaction()
          colorTarget.setFill('#FFFFFF')
          colorTarget.setStroke('#000000')
          commitTransaction()
          return
        }
        case 'paint-toggle': {
          e.preventDefault()
          colorTarget.swap()
          return
        }
        case 'paint-swap': {
          e.preventDefault()
          const f = colorTarget.fillRaw
          const s = colorTarget.strokeRaw
          beginTransaction()
          colorTarget.setFill(s)
          colorTarget.setStroke(f)
          commitTransaction()
          return
        }
        case 'paint-clear': {
          e.preventDefault()
          colorTarget.onChange(null)
          return
        }

        default: return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    selectedLayer, selectedIds, isPositionedSel,
    select, removeLayer, deleteSelected, updateLayer, nudgeEdit, duplicateLayer, toggleLayer, toggleLayerLock,
    flipSelected, enterNodeEdit,
    groupLayers, ungroupLayer,
    colorTarget, beginTransaction, commitTransaction,
    undo, redo, canUndo, canRedo, setTool,
  ])

  if (view === 'social') {
    /* Multi-aspect preview — same composition rendered at 1:1 / 4:5 / 9:16
     * side by side. Read-only: drag/resize/select live in single view.
     * Each frame has its own letterbox; they share width by flex-1. */
    return (
      <div className="w-full h-full p-4 flex items-center justify-center gap-3 overflow-auto">
        {SOCIAL_ASPECTS.map((a) => (
          <div key={a} className="flex-1 min-w-0 h-full">
            <Canvas aspect={a} bgColor={bgColor ?? undefined}>
              <div className="relative w-full h-full">
                {visibleLayers.map((layer) => (
                  <LayerRenderer key={layer.id} layer={layer} palette={palette} />
                ))}
              </div>
            </Canvas>
          </div>
        ))}
      </div>
    )
  }

  /* Tool cursor lives on the OUTER wrapper so it covers the dark backdrop
   * around the canvas frame too — not just the bright frame area. Layers
   * inherit via the kol-editor.css rule
   * `[data-tool]:not([data-tool="select"]) [data-layer-id]`, which
   * overrides their inline `cursor: 'move'`. Cursor is an inherited CSS
   * property, so the stage and its descendants pick up the wrapper's
   * declaration without a redundant inline style. */
  const wrapperCursor =
    drag?.mode === 'move' ? 'grabbing'
      : tool !== 'select'  ? (CURSOR_FOR_TOOL[tool] ?? 'crosshair')
      : 'default'
  return (
    <div
      className="relative w-full h-full"
      style={{ cursor: wrapperCursor, background: infiniteColor }}
      /* Zoom tool — click zooms in at the pointer, Alt+click zooms out.
       * Lives on the wrapper so the dark backdrop zooms too; the viewport
       * (PanZoomViewport) applies it via the kol:zoom-at event. */
      onMouseDown={tool === 'zoom' ? (e) => {
        if (e.button !== 0 || e.target.closest('button')) return
        window.dispatchEvent(new CustomEvent('kol:zoom-at', {
          detail: { clientX: e.clientX, clientY: e.clientY, factor: e.altKey ? 0.5 : 2 },
        }))
      } : undefined}
    >
      <Canvas
        aspect={aspect}
        customRatio={canvasRatio}
        bgColor={bgColor ?? undefined}
        showGrid={showGrid}
        showRulers={showRulers}
        /* Ruler guides render at the viewport level (full-viewport span,
         * Figma behavior) — state stays here in compose; the shell viewport
         * gets it as props, same threading as showGrid/showRulers. */
        guides={guides}
        setGuides={setGuides}
        guidesInteractive={tool === 'select' && !drag}
        panEnabled
      >
        <div
          ref={stageRef}
          data-tool={tool}
          className="relative w-full h-full"
          onMouseDown={onStageMouseDown}
          onDoubleClick={onStageDoubleClick}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-kol-library')) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData('application/x-kol-library')
            if (!raw) return
            e.preventDefault()
            try {
              const { slot, item } = JSON.parse(raw)
              const at = clientToVirtual(e.clientX, e.clientY)
              insertFromLibrary(slot, item, at)
            } catch { /* malformed payload: ignore */ }
          }}
        >
          {visibleLayers.map((layer) => (
            <LayerRenderer key={layer.id} layer={layer} palette={palette} />
          ))}
          {selectedPositionedLayers.map((l) => (
            /* The path being node-edited / photo being cropped swaps its box
             * chrome for the mode overlay; paths never get resize handles
             * (edit via nodes). */
            nodeEditId === l.id || cropId === l.id ? null : (
              <SelectionOverlay
                key={l.id}
                layer={l}
                showHandles={!isMultiSel}
                showRotate={!isMultiSel}
                showLabel={!isMultiSel}
              />
            )
          ))}
          {cropLayer && (
            <CropOverlay
              layer={cropLayer}
              toVirtual={clientToVirtual}
              updateLayer={updateLayer}
              beginTransaction={beginTransaction}
              commitTransaction={commitTransaction}
              onExit={() => setCropId(null)}
            />
          )}
          {nodeEditLayer && (
            <PathNodeOverlay
              layer={nodeEditLayer}
              viewW={CANVAS_VIRTUAL_W}
              viewH={viewH}
              toVirtual={clientToVirtual}
              updateLayer={updateLayer}
              beginTransaction={beginTransaction}
              commitTransaction={commitTransaction}
              onExit={() => setNodeEditId(null)}
            />
          )}
          {pen && (
            <svg
              width="100%" height="100%"
              viewBox={`0 0 ${CANVAS_VIRTUAL_W} ${viewH}`}
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 130 }}
            >
              <path
                d={penPreviewD}
                fill="none"
                stroke="var(--kol-accent-primary)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pen.nodes.map((n, i) => (
                <rect
                  key={i}
                  x={n.x - 4} y={n.y - 4} width={8} height={8}
                  fill={i === 0 ? 'var(--kol-accent-primary)' : 'white'}
                  stroke="var(--kol-accent-primary)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
          {drag?.mode === 'create' && drag.vw > 0 && drag.vh > 0 && (
            <div
              style={{
                position: 'absolute',
                left: drag.vx, top: drag.vy,
                width: drag.vw, height: drag.vh,
                outline: '1px dashed var(--kol-accent-primary)',
                pointerEvents: 'none',
                background: 'color-mix(in srgb, var(--kol-accent-primary) 12%, transparent)',
              }}
            />
          )}
          {drag?.mode === 'marquee' && drag.vw > 0 && drag.vh > 0 && (
            <div
              style={{
                position: 'absolute',
                left: drag.vx, top: drag.vy,
                width: drag.vw, height: drag.vh,
                outline: '1px solid var(--kol-accent-primary)',
                pointerEvents: 'none',
                background: 'color-mix(in srgb, var(--kol-accent-primary) 8%, transparent)',
              }}
            />
          )}
          {linePlacement && linePreview && (
            <svg
              width="100%" height="100%"
              viewBox={`0 0 ${CANVAS_VIRTUAL_W} ${viewH}`}
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <line
                x1={linePlacement.x1} y1={linePlacement.y1}
                x2={linePreview.vx}   y2={linePreview.vy}
                stroke="var(--kol-accent-primary)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={linePlacement.x1} cy={linePlacement.y1} r="4" fill="var(--kol-accent-primary)" />
            </svg>
          )}
          {snapGuides?.h != null && (
            <div
              style={{
                position: 'absolute',
                left: snapGuides.h, top: 0,
                width: 1, height: '100%',
                background: '#FF00C8',
                pointerEvents: 'none',
              }}
            />
          )}
          {snapGuides?.v != null && (
            <div
              style={{
                position: 'absolute',
                left: 0, top: snapGuides.v,
                width: '100%', height: 1,
                background: '#FF00C8',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </Canvas>
    </div>
  )
}
