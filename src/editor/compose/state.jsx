import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from '@kolkrabbi/kol-component'
import { POOLS } from '../modes/palette/pools'
import { generatePalette } from '../modes/palette/colorMath'
import { DEFAULT_SHAPE_ID, getShapeSvg } from '../modes/pattern/shapes'
import { PRESET_SIZES } from '../shell/aspects'
import { buildPatternSvg } from '../modes/pattern/render'
import { computeFrameGlyphs } from '../modes/type/buildTypeSvg'
import { findLayerDeep } from './helpers'
import { scalePathNodes, shiftNode, rotatePathNodes, normalizePath, normalizePathRings } from './path-math'
import { shapeToPathNodes } from './shape-math'
import { booleanCombine, computeBoolean, hasBooleanGeometry, isBooleanable, refitBoolLayer } from './boolean-ops'
import { presetById, presetParams } from '../../loops/registry'
import { kineticPresetById, presetComp } from '../../kinetic/presets'

/* Layer types that own a `color` (and may own a `stroke`). Single source
 * of truth — `useColorTarget` and the inspector both consult this set
 * instead of duplicating the literal. */
export const COLOR_LAYER_TYPES = new Set(['background', 'pattern', 'shape', 'text', 'path', 'bool'])

const DRAFT_KEY = 'kol.editor.draft'

/**
 * Compose state — the live state for the unified composition view.
 *
 * Two state surfaces:
 *
 *   FRAME        — global config (aspect / palette). Not z-stacked, applies
 *                  to everything. Selectable but not "a layer."
 *
 *   LAYERS       — z-stacked render elements. Each has { id, type, visible,
 *                  opacity, blend, ...typeProps }. Layers are inserted in
 *                  render order (first = bottom).
 *
 * Layer types:
 *   - background  { color }                                            — flat color fill, cover-only
 *   - pattern     { shapeId, customSvg, cols, rows, gap, padding,      — full Pattern Lab params, positioned
 *                   stretch, overflow, bgOn, bg, color, rules, scale,
 *                   x, y, w, h }
 *   - photo       { src, fit, x, y, w, h }                             — bitmap fill, positioned
 *   - shape       { kind, variant, color, x, y, w, h }                 — vector content (kind:'logo' for now), positioned
 *   - text        { text, width, weight, italic, size, tracking,       — full Type Lab typography, positioned
 *                   lineHeight, case, textAlign, color, x, y, w, h }
 *   - group       { children: [...layers], x, y, w, h }                — container; children store group-relative coords
 *   - bool        { op, children: [...layers], x, y, w, h }            — non-destructive boolean group; children store
 *                                                                        group-relative coords and render as ONE combined path
 *
 * Selection — `selectedIds` is an array of currently-selected layer ids
 * (multi-select via shift-click in LayerStack). `selectedId` (singular) is
 * exposed as a getter returning the first id, for single-select consumers.
 */

const Ctx = createContext(null)

const FREE_FLAGS = [false, false, false, false, false, false]
const poolFor = (id) => POOLS.find((p) => p.id === id) ?? POOLS[0]
const generateFor = (poolId, modeId, currentColors, locks) => {
  const pool = poolFor(poolId)
  const base = pool.isSeed ? currentColors[0] : undefined
  return generatePalette(pool.colors, modeId, currentColors, locks, base)
}

const newId = (type) => `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`

/* Immutable deep patch: match `id` through group/bool children so layers
 * selected from the panel stay editable wherever they live. Untouched
 * branches keep their identity (render caches key on it); no match returns
 * the input list unchanged. Bool layers whose children (or op) changed are
 * refit on the way back up — deepest first, so a nested bool's new frame
 * feeds its parent's bounds — keeping the frame hugging the result. */
function patchLayerDeep(list, id, partial) {
  let changed = false
  const next = list.map((l) => {
    if (l.id === id) {
      changed = true
      const patched = { ...l, ...partial }
      return patched.type === 'bool' && ('op' in partial || 'children' in partial)
        ? refitBoolLayer(patched)
        : patched
    }
    if (Array.isArray(l.children)) {
      const kids = patchLayerDeep(l.children, id, partial)
      if (kids !== l.children) {
        changed = true
        const updated = { ...l, children: kids }
        return l.type === 'bool' ? refitBoolLayer(updated) : updated
      }
    }
    return l
  })
  return changed ? next : list
}

/* Immutable deep remove of `id`; bool ancestors refit bottom-up. Returns
 * the input list unchanged when `id` isn't found. */
function removeLayerDeep(list, id) {
  let changed = false
  const next = []
  for (const l of list) {
    if (l.id === id) { changed = true; continue }
    if (Array.isArray(l.children)) {
      const kids = removeLayerDeep(l.children, id)
      if (kids !== l.children) {
        changed = true
        const updated = { ...l, children: kids }
        next.push(l.type === 'bool' ? refitBoolLayer(updated) : updated)
        continue
      }
    }
    next.push(l)
  }
  return changed ? next : list
}

/* Immutable deep insert of `layer` into `parentId`'s children (null =
 * top level) at `index` (clamped); bool ancestors refit bottom-up. */
function insertLayerDeep(list, parentId, index, layer) {
  if (parentId == null) {
    const next = [...list]
    next.splice(Math.max(0, Math.min(next.length, index)), 0, layer)
    return next
  }
  let changed = false
  const next = list.map((l) => {
    if (l.id === parentId) {
      changed = true
      const kids = [...(l.children ?? [])]
      kids.splice(Math.max(0, Math.min(kids.length, index)), 0, layer)
      const updated = { ...l, children: kids }
      return l.type === 'bool' ? refitBoolLayer(updated) : updated
    }
    if (Array.isArray(l.children)) {
      const kids = insertLayerDeep(l.children, parentId, index, layer)
      if (kids !== l.children) {
        changed = true
        const updated = { ...l, children: kids }
        return l.type === 'bool' ? refitBoolLayer(updated) : updated
      }
    }
    return l
  })
  return changed ? next : list
}

/* Locate `id` anywhere in the layer tree. Returns { layer, parent (null =
 * top level), index, originX, originY } where origin is the ABSOLUTE canvas
 * origin of the coord space the layer's x/y live in, or null if not found. */
function locateLayer(list, id, ox = 0, oy = 0, parent = null) {
  for (let i = 0; i < list.length; i++) {
    const l = list[i]
    if (l.id === id) return { layer: l, parent, index: i, originX: ox, originY: oy }
    if (Array.isArray(l.children)) {
      const found = locateLayer(l.children, id, ox + (l.x ?? 0), oy + (l.y ?? 0), l)
      if (found) return found
    }
  }
  return null
}

/* Joint bbox of a set of positioned layers — bool-group fallback when the
 * computed result is empty (e.g. intersect of disjoint shapes). */
function jointBbox(layers) {
  const x = Math.min(...layers.map((l) => l.x ?? 0))
  const y = Math.min(...layers.map((l) => l.y ?? 0))
  return {
    x, y,
    w: Math.max(1, Math.max(...layers.map((l) => (l.x ?? 0) + (l.w ?? 0))) - x),
    h: Math.max(1, Math.max(...layers.map((l) => (l.y ?? 0) + (l.h ?? 0))) - y),
  }
}

/* Virtual canvas dimensions used for all layer positioning. The Canvas
   component scales this 1080-virtual space to fit the viewport. */
export const CANVAS_W = 1080
export const CANVAS_H = 1080  /* For non-1:1 aspects, height differs but layers
                                 keep their virtual coords (Figma-equivalent:
                                 layers stay put when the frame size changes). */

/* `cover` types fill the full canvas and aren't dragged/resized on canvas.
   Positioned types own explicit x/y/w/h in virtual coords.
   Phase 1b: pattern + photo are positioned. They default to full-canvas
   bounds at create-time so existing render expectations hold; the user
   drags/resizes from there. Only `background` remains cover-only. */
export const COVER_TYPES = ['background']
export const POSITIONED_TYPES = ['pattern', 'photo', 'shape', 'text', 'path']

/* Compute initial {x, y, w, h} for a positioned layer based on an anchor.
   Used at create-time only; once a layer exists, drag/resize mutates x/y/w/h
   directly and anchor is no longer consulted. */
const PADDING = 80
function boxFromAnchor(anchor, w, h) {
  const right  = CANVAS_W - w - PADDING
  const bottom = CANVAS_H - h - PADDING
  const cx     = (CANVAS_W - w) / 2
  const cy     = (CANVAS_H - h) / 2
  switch (anchor) {
    case 'TL': return { x: PADDING, y: PADDING }
    case 'TC': return { x: cx,      y: PADDING }
    case 'TR': return { x: right,   y: PADDING }
    case 'ML': return { x: PADDING, y: cy }
    case 'C':  return { x: cx,      y: cy }
    case 'MR': return { x: right,   y: cy }
    case 'BL': return { x: PADDING, y: bottom }
    case 'BC': return { x: cx,      y: bottom }
    case 'BR': return { x: right,   y: bottom }
    default:   return { x: cx,      y: cy }
  }
}

/* Defaults for a text layer's Type Lab typography fields. Mirrors Type Lab's
 * newFrame() defaults so picking a saved type spec or starting fresh yields
 * the same baseline shape across the two surfaces. */
const TEXT_DEFAULTS = {
  width:      'Tight',
  weight:     600,
  italic:     false,
  size:       96,
  tracking:   -0.01,
  lineHeight: 1.05,
  case:       'original',
  textAlign:  'center',
}

/* Defaults for a pattern layer's Pattern Lab fields. Mirrors PatternLab's
 * initial state so a fresh pattern layer or a layer post-"Apply saved pattern"
 * has a consistent baseline. `bgOn: false` differs from Pattern Lab's default
 * — compose has its own background layer so a transparent tile is the more
 * useful default in this context. */
const PATTERN_DEFAULTS = {
  shapeId:   DEFAULT_SHAPE_ID,
  customSvg: '',
  cols:      4,
  rows:      4,
  gap:       0,
  padding:   0,
  stretch:   false,
  overflow:  false,
  bgOn:      false,
  bg:        'palette:light',
  rules:     [],
  scale:     256,
}

/* Single source of truth for "make a pattern-fields object from a saved
 * pattern spec". Used by:
 *   - addLayer('pattern')           → factory defaults only
 *   - insertFromLibrary('pattern')  → spec from library
 *   - LayerInspector "Apply saved pattern" → spec from library, merged onto
 *                                            an existing layer (color preserved)
 * `bgOn` is derived consistently: a saved spec is considered to have bg
 * iff `spec.bg != null`. */
export function patternFromSpec(spec = {}, { color = 'palette:secondary' } = {}) {
  return {
    shapeId:   spec.shapeId   ?? PATTERN_DEFAULTS.shapeId,
    customSvg: spec.customSvg ?? PATTERN_DEFAULTS.customSvg,
    cols:      spec.cols      ?? PATTERN_DEFAULTS.cols,
    rows:      spec.rows      ?? PATTERN_DEFAULTS.rows,
    gap:       spec.gap       ?? PATTERN_DEFAULTS.gap,
    padding:   spec.padding   ?? PATTERN_DEFAULTS.padding,
    stretch:   spec.stretch   ?? PATTERN_DEFAULTS.stretch,
    overflow:  spec.overflow  ?? PATTERN_DEFAULTS.overflow,
    bgOn:      spec.bg != null,
    bg:        spec.bg        ?? PATTERN_DEFAULTS.bg,
    rules:     spec.rules     ?? PATTERN_DEFAULTS.rules,
    scale:     spec.scale     ?? PATTERN_DEFAULTS.scale,
    color:     spec.color     ?? color,
  }
}

/* Compose opens empty — no default layers. User adds layers via the
 * left-rail "+" buttons or by opening a saved preset. The canvas shows
 * the dark letterbox until something is added. */
const DEFAULT_LAYERS = []

/* Layer types the user can add. `background` was dropped — canvas owns
 * its own fill now (see canvasFill state). Existing background-typed layers
 * in legacy presets are still rendered by LayerRenderer but can't be
 * created fresh. */
export const LAYER_TYPES = [
  { id: 'pattern',    label: 'Pattern' },
  { id: 'photo',      label: 'Photo' },
  { id: 'shape',      label: 'Shape' },
  { id: 'text',       label: 'Text' },
  { id: 'loop',       label: 'Loop' },
  { id: 'kinetic',    label: 'Kinetic type' },
]

const layerDefaults = (type) => {
  const cover = (extra) => ({ ...extra })
  const placed = (w, h, extra) => ({ ...boxFromAnchor('C', w, h), w, h, ...extra })
  /* New pattern + photo layers default to full-canvas bounds — same visual
   * starting point as the old cover behavior, but draggable / resizable. */
  const fullCanvas = (extra) => ({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H, ...extra })
  switch (type) {
    case 'background': return cover({ color: 'palette:primary' })
    case 'pattern':    return fullCanvas({ ...PATTERN_DEFAULTS, color: 'palette:secondary' })
    case 'photo':      return fullCanvas({ src: null, fit: 'cover' })
    case 'shape':      return placed(200, 200, { kind: 'logo', variant: 'logomark', fit: 'fill', color: 'palette:dark' })
    /* Loop layer — an imported generative loop (src/loops). Preset params
     * spread FLAT onto the layer so the binding/timeline machinery works on
     * them like any other prop. */
    case 'loop': {
      const preset = presetById()   /* first preset (Circle morph) */
      return placed(480, 480, {
        loopGroup:   'shape',
        presetId:    preset.id,
        presetLabel: preset.label,
        loopId:      preset.loop,
        ...presetParams(preset),
      })
    }
    /* Kinetic-type layer — a labs TYPE composition on the KineticType engine
     * (src/kinetic). The composition rides OPAQUELY on `layer.comp` (like
     * loop `forms`) — no flat param spread, no bind dots on its internals. */
    case 'kinetic': {
      const preset = kineticPresetById()   /* first preset (Sunburst) */
      return placed(600, 600, {
        presetId:    preset.id,
        presetLabel: preset.label,
        comp:        presetComp(preset),
      })
    }
    case 'text':       return placed(600, 120, { ...TEXT_DEFAULTS, text: 'New text', color: 'palette:dark' })
    /* path geometry comes from the pen tool via `extras`; these are just
     * safe fallbacks so a bare addLayer('path') never yields undefined nodes. */
    case 'path':       return { nodes: [], closed: false, x: 0, y: 0, w: 1, h: 1, color: null, stroke: 'palette:dark', strokeWidth: 2 }
    default:           return {}
  }
}

export function ComposeStateProvider({ children }) {
  /* ─── Frame: aspect + canvas dimensions ───
   * `aspect` is the preset label (or 'custom'); `canvasW`/`canvasH` are the
   * real pixel output dimensions. The 1080-virtual coordinate space is
   * unchanged — canvasW/H only drive the frame RATIO (canvasW/canvasH) and
   * the export resolution. Presets set both in lockstep via setAspect;
   * custom sizing writes W/H directly and flips aspect to 'custom', so
   * there's one write path and no ratio drift. */
  const [aspect, setAspectState] = useState('1:1')
  const [canvasW, setCanvasW] = useState(1080)
  const [canvasH, setCanvasH] = useState(1080)
  const canvasRatio = canvasW / canvasH

  const setAspect = useCallback((id) => {
    setAspectState(id)
    const sz = PRESET_SIZES[id]
    if (sz) { setCanvasW(sz.w); setCanvasH(sz.h) }
  }, [])
  const setCanvasSize = useCallback((w, h) => {
    const cw = Math.max(16, Math.round(w) || 0)
    const ch = Math.max(16, Math.round(h) || 0)
    setCanvasW(cw); setCanvasH(ch); setAspectState('custom')
  }, [])

  /* ─── Frame: grid backdrop ─── */
  const [showGrid, setShowGrid] = useState(true)
  const toggleGrid = useCallback(() => setShowGrid((g) => !g), [])
  const [showRulers, setShowRulers] = useState(true)
  const toggleRulers = useCallback(() => setShowRulers((r) => !r), [])

  /* ─── Frame: ruler guides ───
   * Figma-style guides dragged off the rulers. `h` = horizontal guide
   * y-positions, `v` = vertical guide x-positions (virtual px). Workspace
   * chrome, not composition — deliberately NOT history-tracked (undo/redo
   * never touches guides). Persisted in the draft like showRulers. */
  const [guides, setGuides] = useState({ h: [], v: [] })

  /* ─── Frame: view ─── */
  /* 'single' renders the canvas at the active aspect.
   * 'social' renders the same composition simultaneously at 1:1 / 4:5 / 9:16
   * so cross-format previews are visible side-by-side. */
  const [view, setView] = useState('single')

  /* ─── Frame: canvas fill ───
   * The canvas itself acts as the bottom-most "layer" — selectable in the
   * stack, owns its own fill + opacity. Replaces the former `background`
   * layer type. */
  const [canvasFill,        setCanvasFill]        = useState(null)   /* hex string or null = transparent */
  const [canvasFillOpacity, setCanvasFillOpacity] = useState(1)      /* 0..1 */

  /* ─── Active paint + app-level paint pair ───
   * Photoshop / Affinity model. SwatchStack reads `paintFill` / `paintStroke`
   * directly — these are app-level "tool colors" that persist across
   * selection changes and exist even with no selection. `activePaint`
   * decides which one X focuses + which one slider/keymap writes target.
   *
   * Writes (via useColorTarget.setFill / setStroke) update the app-level
   * value AND, if a color-supporting layer is selected, also write
   * `layer.color` / `layer.stroke`. When no color layer selected, only
   * the app-level pair updates — the SwatchStack stays meaningful and
   * the next created shape can adopt these.
   *
   * Selection-sync useEffect below snaps app-level paint to the selected
   * layer's resolved fill/stroke so the SwatchStack reflects what's
   * actually selected. */
  const [activePaint, setActivePaint] = useState('fill')   /* 'fill' | 'stroke' */
  const [paintFill,   setPaintFill]   = useState('#FFFFFF') /* hex | null */
  const [paintStroke, setPaintStroke] = useState('#000000') /* hex | null */

  /* ─── Frame: palette ─── */
  const [poolId, setPoolId]   = useState('brand')
  const [modeId, setModeId]   = useState('random')
  const [colors, setColors]   = useState(() => poolFor('brand').defaults)
  const [locks, setLocks]     = useState(FREE_FLAGS)
  const [edited, setEdited]   = useState(FREE_FLAGS)
  const [bgOn, setBgOn]       = useState(false)
  const [hasRandomized, setHasRandomized] = useState(false)

  /* ─── Layers ─── */
  const [layers, setLayers]           = useState(DEFAULT_LAYERS)
  const [selectedIds, setSelectedIds] = useState([])
  const selectedId = selectedIds[0] ?? null  /* back-compat single-select getter */

  /* ─── Loaded preset tracking (phase 8) ─── */
  /* Set by `loadPreset`; reset by `clearLayers`. Save uses these to decide
   * overwrite vs create. */
  const [currentPresetId,   setCurrentPresetId]   = useState(null)
  const [currentPresetName, setCurrentPresetName] = useState(null)

  /* Drag/resize snap-to-guides — Figma-style edge/center snapping with
   * magenta guide lines. Toggle from the File menu. Session-only state
   * (not persisted). */
  const [snapEnabled, setSnapEnabled] = useState(true)
  const toggleSnap = useCallback(() => setSnapEnabled((v) => !v), [])

  /* Single-select: replaces the array. Pass null/undefined to deselect. */
  const select = useCallback((id) => {
    setSelectedIds(id == null ? [] : [id])
  }, [])

  /* Selecting Canvas selects every top-level layer along with it — Canvas
   * is the parent of all layers, so its selection means "everything". */
  const selectCanvas = useCallback(() => {
    const ids = layersRef.current.map((l) => l.id)
    setSelectedIds(['canvas', ...ids])
  }, [])

  /* Toggle a layer in/out of multi-select. Falls back to empty selection
   * if every entry is removed. */
  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }, [])

  /* Set the selection to an arbitrary set of ids in one go. Used by
   * marquee selection (canvas drag-rect) where N layers are selected at
   * the end of one gesture. `additive` merges with the current selection
   * (Shift-marquee) instead of replacing. */
  const selectMany = useCallback((ids, { additive = false } = {}) => {
    setSelectedIds((prev) => {
      if (!additive) return [...new Set(ids)]
      const merged = new Set(prev)
      for (const id of ids) merged.add(id)
      return [...merged]
    })
  }, [])

  /* ─── History (undo/redo) ───
   * Stack of `{ layers, selectedIds }` snapshots. Selection rides with
   * layers because deleting a layer that's selected clears selection — undo
   * needs to restore both to feel sane. Drag/resize wraps a transaction so
   * the 60-update flood collapses to one history entry. Discrete actions
   * push directly. */
  const [past,   setPast]   = useState([])
  const [future, setFuture] = useState([])
  const txRef          = useRef(null)         /* snapshot at transaction-begin, or null */
  const layersRef      = useRef(layers)       /* current layers — read by tx commit */
  const selectedIdsRef = useRef(selectedIds)  /* current selection — read by tx commit */
  layersRef.current      = layers
  selectedIdsRef.current = selectedIds

  const snap = () => ({ layers: layersRef.current, selectedIds: selectedIdsRef.current })

  const setLayersTracked = useCallback((updater) => {
    setLayers((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next === prev) return prev
      if (txRef.current === null) {
        /* discrete action — push pre-state (layers + selection) to past. */
        const snapshot = { layers: prev, selectedIds: selectedIdsRef.current }
        setPast((p) => [...p, snapshot].slice(-100))
        setFuture([])
      }
      return next
    })
  }, [])

  const beginTransaction  = useCallback(() => {
    if (txRef.current === null) txRef.current = snap()
  }, [])
  const commitTransaction = useCallback(() => {
    if (txRef.current === null) return
    const snapshot = txRef.current
    txRef.current = null
    if (snapshot.layers !== layersRef.current || snapshot.selectedIds !== selectedIdsRef.current) {
      setPast((p) => [...p, snapshot].slice(-100))
      setFuture([])
    }
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture((f) => [snap(), ...f].slice(0, 100))
      setLayers(prev.layers)
      setSelectedIds(prev.selectedIds)
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, snap()].slice(-100))
      setLayers(next.layers)
      setSelectedIds(next.selectedIds)
      return f.slice(1)
    })
  }, [])

  const isSeedPool    = poolFor(poolId).isSeed
  const isSeedSeeding = isSeedPool && !hasRandomized

  const palette = useMemo(() => {
    const seed = colors[0]
    return {
      primary:   colors[0] ?? seed,
      secondary: colors[1] ?? seed,
      light:     colors[2] ?? seed,
      dark:      colors[3] ?? seed,
      accent:    colors[4] ?? seed,
      bg:        colors[5] ?? seed,
    }
  }, [colors])

  /* Selection-sync: when a color-supporting layer becomes selected, snap
   * app-level paint to the layer's resolved fill/stroke so SwatchStack
   * reflects the current selection. Canvas-selection adopts canvasFill.
   * Skipped on non-color layer / empty selection — app-level stays sticky.
   *
   * Refs hold the latest layers + palette so the effect doesn't re-run on
   * every layer mutation; it only fires on selection change. */
  const layersForSyncRef  = useRef(layers)
  const paletteForSyncRef = useRef(palette)
  const canvasFillForSyncRef = useRef(canvasFill)
  layersForSyncRef.current  = layers
  paletteForSyncRef.current = palette
  canvasFillForSyncRef.current = canvasFill
  useEffect(() => {
    if (!selectedId) return
    if (selectedId === 'canvas') {
      if (canvasFillForSyncRef.current !== undefined) setPaintFill(canvasFillForSyncRef.current ?? null)
      return
    }
    const layer = findLayerDeep(layersForSyncRef.current, selectedId)
    if (!layer || !COLOR_LAYER_TYPES.has(layer.type)) return
    if (layer.color  !== undefined) setPaintFill(resolveColor(layer.color, paletteForSyncRef.current) ?? null)
    if (layer.stroke !== undefined) setPaintStroke(resolveColor(layer.stroke, paletteForSyncRef.current) ?? null)
  }, [selectedId])

  /* Layer actions — go through setLayersTracked so history captures them.
   * Optional `extras` merges over the type's defaults, e.g.
   *   addLayer('shape', { variant: 'wordmark' })
   * to spawn a logo with a specific variant. */
  /* New layers adopt the current app-level paint pair (Photoshop model).
   * Color-supporting layers get `color: paintFill`; everything except
   * background also gets `stroke: paintStroke` (background has no stroke
   * concept). Stroke renders only when `strokeWidth > 0`, so adoption is
   * harmless for layers the user never strokes. `extras` still wins so
   * callers can override (e.g. saved presets, library inserts). */
  const paintFillRef   = useRef(paintFill)
  const paintStrokeRef = useRef(paintStroke)
  paintFillRef.current   = paintFill
  paintStrokeRef.current = paintStroke

  const addLayer = useCallback((type, extras = {}) => {
    const id = newId(type)
    const paintExtras = COLOR_LAYER_TYPES.has(type)
      ? (type === 'background'
        ? { color: paintFillRef.current }
        : { color: paintFillRef.current, stroke: paintStrokeRef.current })
      : {}
    setLayersTracked((prev) => [
      ...prev,
      { id, type, visible: true, opacity: 1, blend: 'normal', ...layerDefaults(type), ...paintExtras, ...extras },
    ])
    /* Adding a layer always moves focus to the new layer — canvas (or
     * whatever was selected) gets replaced. Until the layer is committed,
     * the [+] button and its dropdown should preserve canvas selection
     * (handled in the doc-down deselect listener). */
    setSelectedIds([id])
  }, [setLayersTracked])

  const removeLayer = useCallback((id) => {
    setLayersTracked((prev) => prev.filter((l) => l.id !== id))
    setSelectedIds((prev) => prev.filter((sid) => sid !== id))
  }, [setLayersTracked])

  /* Delete every selected layer in one transaction so undo restores all of
   * them together. The 'canvas' magic id is excluded — Canvas can't be
   * deleted. Replaces the inline `selectedIds.filter(...).forEach(removeLayer)`
   * pattern that lived in CanvasArea, LayerStack, and InspectorRail. */
  const deleteSelected = useCallback(() => {
    const ids = selectedIds.filter((id) => id !== 'canvas')
    if (ids.length === 0) return
    beginTransaction()
    ids.forEach(removeLayer)
    commitTransaction()
  }, [selectedIds, removeLayer, beginTransaction, commitTransaction])

  const updateLayer = useCallback((id, partial) => {
    setLayersTracked((prev) => patchLayerDeep(prev, id, partial))
  }, [setLayersTracked])

  const toggleLayer = useCallback((id) => {
    setLayersTracked((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
  }, [setLayersTracked])

  const toggleLayerLock = useCallback((id) => {
    setLayersTracked((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)))
  }, [setLayersTracked])

  /* Flip a layer in place about its own bbox center. Paths bake the mirror
   * into the node geometry (so node-edit chrome stays true to the render);
   * every other positioned layer toggles a flipX/flipY flag that
   * LayerRenderer / the SVG export builder apply as a transform. Cover
   * types and legacy unbounded layers are skipped — no box to flip about. */
  const flipLayer = useCallback((id, axis) => {
    setLayersTracked((prev) => prev.map((l) => {
      if (l.id !== id || l.locked || COVER_TYPES.includes(l.type)) return l
      if (l.type === 'path' && Array.isArray(l.nodes)) {
        const sx = axis === 'h' ? -1 : 1
        const sy = axis === 'v' ? -1 : 1
        const norm = normalizePathRings(scalePathNodes(l.nodes, sx, sy), l.holes?.map((r) => scalePathNodes(r, sx, sy)))
        return { ...l, nodes: norm.nodes, holes: norm.holes }
      }
      if (l.x == null || l.w == null) return l
      return axis === 'h' ? { ...l, flipX: !l.flipX } : { ...l, flipY: !l.flipY }
    }))
  }, [setLayersTracked])

  /* Flip every selected layer, one transaction → one undo entry. */
  const flipSelected = useCallback((axis) => {
    const ids = selectedIds.filter((sid) => sid !== 'canvas')
    if (ids.length === 0) return
    beginTransaction()
    ids.forEach((id) => flipLayer(id, axis))
    commitTransaction()
  }, [selectedIds, flipLayer, beginTransaction, commitTransaction])

  /* Wrap the selected closed vector layers (paths + basic shape kinds +
   * other bool groups) in a NON-DESTRUCTIVE `bool` group ('unite' |
   * 'subtract' | 'intersect' | 'exclude'). Operands become `children` in
   * z-order bottom-first (subtract = bottom minus uppers, Figma semantics),
   * stored in group-relative coords like `group` children. The group lands
   * at the topmost operand's z-position and adopts the bottom operand's
   * paint — same placement + paint rule the old destructive combine used.
   * Geometry stays live (computeBoolean re-runs on child edits); an empty
   * result (disjoint intersect) still wraps, boxed to the operands' joint
   * bbox, so the group remains manipulable. `flattenSelected` bakes it. */
  const booleanGroup = useCallback((op) => {
    const current = layersRef.current
    const targets = current.filter((l) => selectedIds.includes(l.id) && isBooleanable(l))
    if (targets.length < 2) return
    const base = targets[0]
    const box = computeBoolean(targets, op)?.bounds ?? jointBbox(targets)
    const id = newId('bool')
    setLayersTracked((prev) => {
      const targetIds = new Set(targets.map((t) => t.id))
      const topIdx = Math.max(...prev.map((l, i) => (targetIds.has(l.id) ? i : -1)))
      const newLayer = {
        id, type: 'bool', op,
        visible: true, opacity: base.opacity ?? 1, blend: base.blend ?? 'normal',
        x: box.x, y: box.y, w: box.w, h: box.h,
        color: base.color ?? 'palette:dark',
        stroke: base.stroke ?? null,
        strokeWidth: base.strokeWidth ?? 0,
        children: targets.map((t) => ({ ...t, x: (t.x ?? 0) - box.x, y: (t.y ?? 0) - box.y })),
      }
      const next = []
      prev.forEach((l, i) => {
        if (i === topIdx) next.push(newLayer)
        if (!targetIds.has(l.id)) next.push(l)
      })
      return next
    })
    setSelectedIds([id])
  }, [selectedIds, setLayersTracked])

  /* Flatten — bake boolean geometry to a real `path` layer (the old
   * destructive result):
   *   - one selected bool group  → replaced by its computed path.
   *   - ≥2 eligible vector layers → destructive unite (Figma ⌘E semantics).
   * Result lands at the topmost input's z-position, adopting the bottom
   * input's paint. Empty results are a no-op. Tracked through history. */
  const flattenSelected = useCallback(() => {
    const current = layersRef.current
    const targets = current.filter((l) => selectedIds.includes(l.id) && isBooleanable(l))
    if (targets.length === 0) return
    /* A lone non-bool layer has nothing to flatten. */
    if (targets.length === 1 && targets[0].type !== 'bool') return
    const result = booleanCombine(targets, 'unite')
    if (!result || (result.nodes?.length ?? 0) < 2) return
    const norm = normalizePathRings(result.nodes, result.holes)
    const base = targets[0]
    const id = newId('path')
    setLayersTracked((prev) => {
      const targetIds = new Set(targets.map((t) => t.id))
      const topIdx = Math.max(...prev.map((l, i) => (targetIds.has(l.id) ? i : -1)))
      const newLayer = {
        id, type: 'path', visible: true, opacity: base.opacity ?? 1, blend: base.blend ?? 'normal',
        nodes: norm.nodes, holes: norm.holes, closed: true,
        x: norm.dx, y: norm.dy, w: norm.w, h: norm.h,
        color: base.color ?? 'palette:dark',
        stroke: base.stroke ?? null,
        strokeWidth: base.strokeWidth ?? 0,
      }
      const next = []
      prev.forEach((l, i) => {
        if (i === topIdx) next.push(newLayer)
        if (!targetIds.has(l.id)) next.push(l)
      })
      return next
    })
    setSelectedIds([id])
  }, [selectedIds, setLayersTracked])

  /* Convert a primitive shape layer (rect / ellipse / triangle / polygon /
   * star / line) to an editable `path` layer in place — same id, paint,
   * opacity/blend, painted geometry. Flip flags + rotation are BAKED into
   * the nodes (mirror-about-center then rotate-about-center, matching the
   * DOM `rotate() scale()` order) — paths always carry transform-free
   * geometry, same philosophy as flipLayer / node-edit entry. One-way;
   * tracked through history, undo restores the shape. */
  const convertShapeToPath = useCallback((layerId) => {
    setLayersTracked((prev) => prev.map((l) => {
      if (l.id !== layerId || l.type !== 'shape') return l
      const geo = shapeToPathNodes(l)
      if (!geo) return l
      let nodes = geo.nodes
      const cx = (l.w ?? 0) / 2
      const cy = (l.h ?? 0) / 2
      if (l.flipX || l.flipY) {
        /* mirror about the box center: scale about origin + shift back. */
        nodes = scalePathNodes(nodes, l.flipX ? -1 : 1, l.flipY ? -1 : 1)
          .map((n) => shiftNode(n, l.flipX ? cx * 2 : 0, l.flipY ? cy * 2 : 0))
      }
      const rot = typeof l.rotation === 'number' ? l.rotation : 0
      if (rot) nodes = rotatePathNodes(nodes, rot, cx, cy)
      const norm = normalizePath(nodes)
      return {
        id: l.id, type: 'path', visible: l.visible ?? true,
        opacity: l.opacity ?? 1, blend: l.blend ?? 'normal',
        ...(l.locked ? { locked: true } : {}),
        nodes: norm.nodes, closed: geo.closed,
        x: (l.x ?? 0) + norm.dx, y: (l.y ?? 0) + norm.dy,
        w: norm.w, h: norm.h,
        /* line paints stroke-only (falling back to fill color, like its
         * renderer); closed kinds keep fill and only stroke when the shape
         * actually painted one. */
        color: geo.closed ? (l.color ?? null) : null,
        stroke: geo.closed ? (l.stroke ?? null) : (l.stroke ?? l.color ?? null),
        strokeWidth: geo.closed
          ? (l.stroke != null ? (l.strokeWidth ?? 0) : 0)
          : (l.strokeWidth ?? 2),
        ...(l.strokeDasharray ? { strokeDasharray: l.strokeDasharray } : {}),
        ...(l.strokeLinecap   ? { strokeLinecap:   l.strokeLinecap }   : {}),
        ...(l.strokeLinejoin  ? { strokeLinejoin:  l.strokeLinejoin }  : {}),
      }
    }))
  }, [setLayersTracked])

  const duplicateLayer = useCallback((id) => {
    setLayersTracked((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i < 0) return prev
      const src = prev[i]
      const clone = { ...src, id: newId(src.type) }
      /* Group/bool children get fresh ids too — duplicated child ids would
       * make panel-side child edits write into both copies at once. */
      if (Array.isArray(clone.children)) clone.children = reidLayers(clone.children)
      if (clone.x != null) { clone.x += 24; clone.y += 24 }
      const next = [...prev]
      next.splice(i + 1, 0, clone)
      return next
    })
  }, [setLayersTracked])

  /* Clear the canvas — drop all layers, clear selection, and reset the
   * loaded-preset tracking so the next Save creates a fresh preset rather
   * than overwriting the previously-loaded one. Tracked through history
   * (layers); undo restores layers (preset tracking does not undo). */
  const clearLayers = useCallback(() => {
    setLayersTracked(() => [])
    setSelectedIds([])
    setCurrentPresetId(null)
    setCurrentPresetName(null)
  }, [setLayersTracked])

  /* Group multiple layers into a single `group` layer. Refuses if fewer than
   * 2 layers passed, or if any of them is itself a group (flat groups only
   * for v1). Children store group-relative coords so transforming the group
   * moves them as a unit. The group lands at the top of the stack; the user
   * can reorder afterward. */
  const groupLayers = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length < 2) return
    const groupId = newId('group')
    let didCreate = false
    setLayersTracked((prev) => {
      const selected = ids.map((id) => prev.find((l) => l.id === id)).filter(Boolean)
      if (selected.length < 2) return prev
      if (selected.some((l) => l.type === 'group')) return prev

      const xs  = selected.map((l) => l.x ?? 0)
      const ys  = selected.map((l) => l.y ?? 0)
      const xs2 = selected.map((l) => (l.x ?? 0) + (l.w ?? 0))
      const ys2 = selected.map((l) => (l.y ?? 0) + (l.h ?? 0))
      const gx = Math.min(...xs)
      const gy = Math.min(...ys)
      const gw = Math.max(...xs2) - gx
      const gh = Math.max(...ys2) - gy

      const children = selected.map((l) => ({
        ...l,
        x: (l.x ?? 0) - gx,
        y: (l.y ?? 0) - gy,
      }))

      const idsSet = new Set(ids)
      const remaining = prev.filter((l) => !idsSet.has(l.id))
      const group = {
        id: groupId,
        type: 'group',
        visible: true,
        opacity: 1,
        blend:   'normal',
        x: gx, y: gy, w: gw, h: gh,
        children,
      }
      didCreate = true
      return [...remaining, group]
    })
    if (didCreate) setSelectedIds([groupId])
  }, [setLayersTracked])

  /* Ungroup — replace a group layer with its children, restoring their
   * canvas-absolute coords. Selects the freed children so the user can keep
   * working with them. */
  const ungroupLayer = useCallback((id) => {
    let restoredIds = []
    setLayersTracked((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i < 0) return prev
      const group = prev[i]
      if (group.type !== 'group') return prev
      const restored = (group.children ?? []).map((c) => ({
        ...c,
        x: (c.x ?? 0) + (group.x ?? 0),
        y: (c.y ?? 0) + (group.y ?? 0),
      }))
      restoredIds = restored.map((c) => c.id)
      const next = [...prev]
      next.splice(i, 1, ...restored)
      return next
    })
    if (restoredIds.length) setSelectedIds(restoredIds)
  }, [setLayersTracked])

  /* Release a boolean (Figma's release, the un-boolean): the bool layer is
   * replaced in place by its children at their canvas-absolute positions,
   * original z-order preserved. Selection moves to the released layers.
   * Distinct from flattenSelected, which bakes to one path. `id` defaults
   * to the current selection. Top-level bools only, like ungroupLayer. */
  const releaseBoolean = useCallback((id = selectedIdsRef.current[0]) => {
    let restoredIds = []
    setLayersTracked((prev) => {
      const i = prev.findIndex((l) => l.id === id)
      if (i < 0) return prev
      const bool = prev[i]
      if (bool.type !== 'bool') return prev
      const restored = (bool.children ?? []).map((c) => ({
        ...c,
        x: (c.x ?? 0) + (bool.x ?? 0),
        y: (c.y ?? 0) + (bool.y ?? 0),
      }))
      restoredIds = restored.map((c) => c.id)
      const next = [...prev]
      next.splice(i, 1, ...restored)
      return next
    })
    if (restoredIds.length) setSelectedIds(restoredIds)
  }, [setLayersTracked])

  /* Reparent a layer (panel drag): move `id` into `targetParentId`'s
   * children (a group/bool id, or null for the top level) at `index` —
   * the insertion position in the target's child order AFTER the layer
   * left its old spot. Coords convert through absolute canvas space so the
   * layer doesn't move visually; bool containers on both paths refit.
   * Rejected: unknown ids, non-container targets, cycles (a container into
   * its own descendant), and non-boolean geometry into a bool (only closed
   * paths / basic shapes / bools contribute to a result — anything else
   * would silently vanish, since bool children don't render individually). */
  const reparentLayer = useCallback((id, targetParentId = null, index = 0) => {
    if (!id || id === 'canvas' || id === targetParentId) return
    let didMove = false
    setLayersTracked((prev) => {
      const src = locateLayer(prev, id)
      if (!src) return prev
      const moving = src.layer
      if (targetParentId != null) {
        const target = findLayerDeep(prev, targetParentId)
        if (!target || (target.type !== 'group' && target.type !== 'bool')) return prev
        if (findLayerDeep([moving], targetParentId)) return prev          /* cycle */
        if (target.type === 'bool' && !hasBooleanGeometry(moving)) return prev
      }
      const absX = src.originX + (moving.x ?? 0)
      const absY = src.originY + (moving.y ?? 0)
      const removed = removeLayerDeep(prev, id)
      /* Target origin measured POST-removal — pulling the layer out may
       * have refit an ancestor bool and moved the target's coord space. */
      let ox = 0, oy = 0
      if (targetParentId != null) {
        const t = locateLayer(removed, targetParentId)
        if (!t) return prev
        ox = t.originX + (t.layer.x ?? 0)
        oy = t.originY + (t.layer.y ?? 0)
      }
      didMove = true
      return insertLayerDeep(removed, targetParentId, index, { ...moving, x: absX - ox, y: absY - oy })
    })
    if (didMove) setSelectedIds([id])
  }, [setLayersTracked])

  /* Align the currently-selected positioned layers to their common bbox.
   * `axis` is 'h' or 'v'; `mode` is 'start' / 'center' / 'end' (mapping
   * to left/center/right or top/middle/bottom respectively). Locked
   * layers and `canvas` are skipped. */
  const alignSelected = useCallback((axis, mode) => {
    setLayersTracked((prev) => {
      const ids = selectedIdsRef.current.filter((id) => id !== 'canvas')
      const selected = ids
        .map((id) => prev.find((l) => l.id === id))
        .filter((l) => l && typeof l.x === 'number' && typeof l.y === 'number' && !l.locked)
      if (selected.length < 2) return prev

      const xs  = selected.map((l) => l.x)
      const ys  = selected.map((l) => l.y)
      const xs2 = selected.map((l) => l.x + (l.w ?? 0))
      const ys2 = selected.map((l) => l.y + (l.h ?? 0))
      const bx = Math.min(...xs)
      const by = Math.min(...ys)
      const bw = Math.max(...xs2) - bx
      const bh = Math.max(...ys2) - by

      const idsSet = new Set(selected.map((l) => l.id))
      return prev.map((l) => {
        if (!idsSet.has(l.id)) return l
        if (axis === 'h') {
          if (mode === 'start')  return { ...l, x: bx }
          if (mode === 'center') return { ...l, x: bx + (bw - (l.w ?? 0)) / 2 }
          if (mode === 'end')    return { ...l, x: bx + bw - (l.w ?? 0) }
        } else if (axis === 'v') {
          if (mode === 'start')  return { ...l, y: by }
          if (mode === 'center') return { ...l, y: by + (bh - (l.h ?? 0)) / 2 }
          if (mode === 'end')    return { ...l, y: by + bh - (l.h ?? 0) }
        }
        return l
      })
    })
  }, [setLayersTracked])

  /* Flatten a pattern layer to a static `shape{kind:'flatten'}` wrapped in
   * a `group` so the flattened result occupies one slot in the layer stack.
   * Renders the pattern via `buildPatternSvg` against the current palette,
   * stores the resulting SVG string on the shape, and replaces the original
   * pattern layer in place. One-way: re-edit by re-inserting from the
   * library entry. Tracked through history; undo restores. */
  const flattenPattern = useCallback((layerId) => {
    setLayersTracked((prev) => {
      const layer = prev.find((l) => l.id === layerId)
      if (!layer || layer.type !== 'pattern') return prev
      const shapeSvg = getShapeSvg(layer.shapeId, layer.customSvg)
      if (!shapeSvg) return prev
      const resolvedColor  = resolveColor(layer.color, palette) ?? '#FFFFFF'
      const resolvedBg     = layer.bgOn ? (resolveColor(layer.bg, palette) ?? null) : null
      const resolvedStroke = resolveColor(layer.stroke, palette)
      const sw             = layer.strokeWidth ?? 0
      const renderedSvg = buildPatternSvg({
        shapeSvg,
        cols:     layer.cols, rows: layer.rows,
        gap:      layer.gap, padding: layer.padding,
        stretch:  layer.stretch, overflow: layer.overflow,
        rules:    layer.rules ?? [],
        color:    resolvedColor,
        bg:       resolvedBg,
        stroke:      sw > 0 ? resolvedStroke : null,
        strokeWidth: sw,
        size:        layer.scale ?? 256,
      })
      const shapeId = newId('shape')
      const groupId = newId('group')
      const shape = {
        id:      shapeId,
        type:    'shape',
        kind:    'flatten',
        svg:     renderedSvg,
        fit:     'fill',
        x: 0, y: 0,
        w: layer.w ?? CANVAS_W,
        h: layer.h ?? CANVAS_H,
        visible: true, opacity: 1, blend: 'normal',
      }
      const group = {
        id:       groupId,
        type:     'group',
        x: layer.x ?? 0, y: layer.y ?? 0,
        w: layer.w ?? CANVAS_W, h: layer.h ?? CANVAS_H,
        visible:  layer.visible ?? true,
        opacity:  layer.opacity ?? 1,
        blend:    layer.blend   ?? 'normal',
        children: [shape],
      }
      return prev.map((l) => (l.id === layerId ? group : l))
    })
  }, [setLayersTracked, palette])

  /* Flatten a text layer to a `group` of per-glyph `shape{kind:'flatten'}`
   * layers. Each glyph becomes its own shape — sized to the glyph's actual
   * path bounding box (trimmed to the visual shape, not the line height) so
   * letters can be moved / restyled independently after flattening. */
  const flattenText = useCallback(async (layerId) => {
    const layer = layersRef.current.find((l) => l.id === layerId)
    if (!layer || layer.type !== 'text') return
    const resolvedColor = resolveColor(layer.color, palette) ?? '#FFFFFF'
    /* Compute glyph paths in layer-relative coords (x=0,y=0). */
    const { glyphs, offset } = await computeFrameGlyphs({ ...layer, x: 0, y: 0, color: resolvedColor })
    const visibleGlyphs = glyphs.filter((g) => g.d && g.bbox)
    if (visibleGlyphs.length === 0) return

    const size = layer.size ?? 96
    /* In type-lab's render the baseline sits at y = `size` within the layer's
     * vertical space; glyph paths extend upward (negative y) for caps and
     * downward (positive y) for descenders. We project each glyph's bbox
     * into layer-relative coords here. */
    const baselineY = size

    const children = visibleGlyphs.map((g) => {
      const { x1, y1, x2, y2 } = g.bbox
      const w = Math.max(x2 - x1, 4)
      const h = Math.max(y2 - y1, 4)
      /* Each shape's local SVG: viewBox sized to the glyph bbox; the path
       * is translated by (-x1, -y1) so its leftmost / topmost extent lands
       * at the viewBox origin. preserveAspectRatio="none" so resizing
       * stretches the glyph. */
      /* fill="currentColor" so the wrapper's CSS `color` (driven by
       * layer.color in `ShapeLayer`) applies live — user can edit hex in
       * the inspector and the glyph re-tints. */
      const innerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" preserveAspectRatio="none"><path d="${g.d}" transform="translate(${(-x1).toFixed(2)} ${(-y1).toFixed(2)})" fill="currentColor" fill-rule="evenodd"/></svg>`
      return {
        id:      newId('shape'),
        type:    'shape',
        kind:    'flatten',
        svg:     innerSvg,
        fit:     'fill',
        color:   resolvedColor,
        /* Group-relative coords:
         *   left   = textAlign offset + glyph baseline-x + bbox left-bearing
         *   top    = baseline + bbox top (negative for caps → cap-line) */
        x: offset + g.x + x1,
        y: baselineY + y1,
        w,
        h,
        visible: true, opacity: 1, blend: 'normal',
      }
    })

    const group = {
      id:       newId('group'),
      type:     'group',
      x: layer.x ?? 0, y: layer.y ?? 0,
      w: layer.w ?? 600, h: layer.h ?? (size * 1.2),
      visible:  layer.visible ?? true,
      opacity:  layer.opacity ?? 1,
      blend:    layer.blend   ?? 'normal',
      children,
    }
    setLayersTracked((prev) => prev.map((l) => (l.id === layerId ? group : l)))
  }, [setLayersTracked, palette])

  /* Add a flattened group from a Type Lab frame spec — used by "Send to
   * compose" when axisOn is true. Same per-glyph shape pipeline as
   * flattenText, but builds a fresh group + centers it on the compose canvas
   * instead of replacing an existing text layer. */
  const addFlattenedFromFrame = useCallback(async (frame) => {
    const resolvedColor = resolveColor(frame.color, palette) ?? '#FFFFFF'
    const { glyphs, offset } = await computeFrameGlyphs({ ...frame, x: 0, y: 0, color: resolvedColor })
    const visibleGlyphs = glyphs.filter((g) => g.d && g.bbox)
    if (visibleGlyphs.length === 0) return

    const size = frame.size ?? 96
    const baselineY = size

    const children = visibleGlyphs.map((g) => {
      const { x1, y1, x2, y2 } = g.bbox
      const w = Math.max(x2 - x1, 4)
      const h = Math.max(y2 - y1, 4)
      const innerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" preserveAspectRatio="none"><path d="${g.d}" transform="translate(${(-x1).toFixed(2)} ${(-y1).toFixed(2)})" fill="currentColor" fill-rule="evenodd"/></svg>`
      return {
        id:      newId('shape'),
        type:    'shape',
        kind:    'flatten',
        svg:     innerSvg,
        fit:     'fill',
        color:   resolvedColor,
        x: offset + g.x + x1,
        y: baselineY + y1,
        w, h,
        visible: true, opacity: 1, blend: 'normal',
      }
    })

    const groupW = frame.w ?? 600
    const groupH = frame.h ?? (size * 1.2)
    const { x, y } = boxFromAnchor('C', groupW, groupH)

    const group = {
      id:       newId('group'),
      type:     'group',
      x, y, w: groupW, h: groupH,
      visible:  true, opacity: 1, blend: 'normal',
      children,
    }
    setLayersTracked((prev) => [...prev, group])
    setSelectedIds([group.id])
  }, [setLayersTracked, palette])

  /* Re-id layers (and nested group/bool children) so loaded presets don't
   * collide with anything already in the canvas — each load produces fresh
   * ids regardless of what the source preset stored. */
  const reidLayers = (arr) => (Array.isArray(arr) ? arr : []).map((l) => ({
    ...l,
    id: newId(l.type ?? 'layer'),
    ...(Array.isArray(l.children)
      ? { children: reidLayers(l.children) }
      : {}),
  }))

  /* Load a saved preset into the live state. Whole-frame intent replaces
   * the canvas (aspect + layers + bound palette); partial-chunk intent
   * appends layers to the current canvas. Uses the raw useState setters
   * so the wrapper-side resets in `setPoolId` / `setModeId` don't trample
   * the loaded palette. Tracked through history; undo restores. */
  const loadPreset = useCallback((preset) => {
    if (!preset) return
    /* Raw setters so a saved custom canvas keeps its stored W/H. Presets
     * without explicit dims fall back to the aspect preset table. */
    if (preset.aspect) setAspectState(preset.aspect)
    if (typeof preset.canvasW === 'number' && typeof preset.canvasH === 'number') {
      setCanvasW(preset.canvasW); setCanvasH(preset.canvasH)
    } else if (preset.aspect && PRESET_SIZES[preset.aspect]) {
      setCanvasW(PRESET_SIZES[preset.aspect].w); setCanvasH(PRESET_SIZES[preset.aspect].h)
    }
    if (preset.palette) {
      if (preset.palette.poolId) setPoolId(preset.palette.poolId)
      if (preset.palette.modeId) setModeId(preset.palette.modeId)
      if (Array.isArray(preset.palette.colors)) setColors(preset.palette.colors)
      if (Array.isArray(preset.palette.locks)) setLocks(preset.palette.locks)
    }
    const fresh = reidLayers(preset.layers)
    if (preset.intent === 'partial') {
      setLayersTracked((prev) => [...prev, ...fresh])
      /* partial chunks don't claim the loaded-preset slot; the host frame
       * keeps its currentPresetId. */
    } else {
      /* default: whole-frame replace */
      setLayersTracked(() => fresh)
      setCurrentPresetId(preset.id ?? null)
      setCurrentPresetName(preset.name ?? null)
    }
    setSelectedIds([])
  }, [setLayersTracked])

  /* Drag-to-canvas: insert a library item as the appropriate layer type
   * (pattern → pattern layer; type → text layer; preset → append its
   * layers as a partial chunk). Selects the inserted layer(s).
   *
   * `at` is an optional virtual-coord drop point `{ vx, vy }` from the
   * canvas drop handler. If supplied, positioned layers (text) center on
   * it; pattern still defaults to full-canvas (its bounds are meaningful).
   * Preset chunks shift relative to the drop point. */
  const insertFromLibrary = useCallback((slot, item, at = null) => {
    if (!item) return
    if (slot === 'preset' && Array.isArray(item.layers)) {
      const fresh = reidLayers(item.layers)
      const offset = at && fresh[0] != null
        ? { dx: at.vx - (fresh[0].x ?? 0) - (fresh[0].w ?? 0) / 2,
            dy: at.vy - (fresh[0].y ?? 0) - (fresh[0].h ?? 0) / 2 }
        : null
      const placed = offset
        ? fresh.map((l) => l.x != null ? { ...l, x: l.x + offset.dx, y: l.y + offset.dy } : l)
        : fresh
      setLayersTracked((prev) => [...prev, ...placed])
      if (placed[0]) setSelectedIds([placed[0].id])
      return
    }
    if (slot === 'pattern') {
      const layer = {
        id: newId('pattern'),
        type: 'pattern',
        visible: true, opacity: 1, blend: 'normal',
        x: 0, y: 0, w: CANVAS_W, h: CANVAS_H,
        ...patternFromSpec(item),
      }
      setLayersTracked((prev) => [...prev, layer])
      setSelectedIds([layer.id])
      return
    }
    if (slot === 'type') {
      const w = 600, h = 120
      const pos = at
        ? { x: at.vx - w / 2, y: at.vy - h / 2 }
        : boxFromAnchor('C', w, h)
      const layer = {
        id: newId('text'),
        type: 'text',
        visible: true, opacity: 1, blend: 'normal',
        ...pos, w, h,
        text:       item.text       ?? 'New text',
        width:      item.width      ?? 'Tight',
        weight:     item.weight     ?? 600,
        italic:     item.italic     ?? false,
        size:       item.size       ?? 96,
        tracking:   item.tracking   ?? -0.01,
        lineHeight: item.lineHeight ?? 1.05,
        case:       item.case       ?? 'original',
        textAlign:  item.textAlign  ?? 'center',
        color:      item.color      ?? 'palette:dark',
      }
      setLayersTracked((prev) => [...prev, layer])
      setSelectedIds([layer.id])
    }
  }, [setLayersTracked])

  /* ─── Autosave (phase 8) ───
   * Debounced write of the live canvas to localStorage so a refresh /
   * accidental tab close doesn't lose work. Writes whenever layers, aspect,
   * or the bound palette change; clears the slot when the canvas empties.
   * Restored from on first mount if a draft is present and the user confirms. */
  const modal = useModal()
  const restoreCheckedRef = useRef(false)

  useEffect(() => {
    if (restoreCheckedRef.current) return
    restoreCheckedRef.current = true
    let raw
    try { raw = localStorage.getItem(DRAFT_KEY) } catch { return }
    if (!raw) return
    let draft
    try { draft = JSON.parse(raw) } catch {
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      return
    }
    if (!draft || !Array.isArray(draft.layers) || draft.layers.length === 0) {
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      return
    }
    ;(async () => {
      const ok = await modal.confirm('Restore your last canvas? You had unsaved work from your previous session.')
      if (ok) {
        /* Raw setters, not the smart setAspect — a saved 'custom' canvas
         * must keep its stored W/H, not snap back to a preset table entry. */
        if (draft.aspect) setAspectState(draft.aspect)
        if (typeof draft.canvasW === 'number') setCanvasW(draft.canvasW)
        if (typeof draft.canvasH === 'number') setCanvasH(draft.canvasH)
        if (typeof draft.showGrid === 'boolean') setShowGrid(draft.showGrid)
        if (typeof draft.showRulers === 'boolean') setShowRulers(draft.showRulers)
        if (draft.guides && Array.isArray(draft.guides.h) && Array.isArray(draft.guides.v)) setGuides(draft.guides)
        if (draft.canvas) {
          if (draft.canvas.fill !== undefined)        setCanvasFill(draft.canvas.fill)
          if (typeof draft.canvas.fillOpacity === 'number') setCanvasFillOpacity(draft.canvas.fillOpacity)
        }
        if (draft.palette) {
          if (draft.palette.poolId) setPoolId(draft.palette.poolId)
          if (draft.palette.modeId) setModeId(draft.palette.modeId)
          /* Migration: drafts saved while the palette tokens were broken
           * (phantom token names) carry six IDENTICAL colors — discard those
           * so the real pool defaults show instead of the collapsed set. */
          const dc = draft.palette.colors
          if (Array.isArray(dc) && !dc.every((c) => c === dc[0])) setColors(dc)
          if (Array.isArray(draft.palette.locks))  setLocks(draft.palette.locks)
        }
        if (draft.paint) {
          if (draft.paint.fill   !== undefined) setPaintFill(draft.paint.fill)
          if (draft.paint.stroke !== undefined) setPaintStroke(draft.paint.stroke)
          if (draft.paint.active === 'fill' || draft.paint.active === 'stroke') setActivePaint(draft.paint.active)
        }
        setLayers(draft.layers)
        setSelectedIds([])
      } else {
        try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      }
    })()
  }, [modal])

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (layers.length === 0) {
          localStorage.removeItem(DRAFT_KEY)
          return
        }
        const draft = {
          aspect,
          canvasW, canvasH, showGrid, showRulers, guides,
          layers,
          canvas:  { fill: canvasFill, fillOpacity: canvasFillOpacity },
          palette: { poolId, modeId, colors, locks },
          paint:   { fill: paintFill, stroke: paintStroke, active: activePaint },
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch { /* quota / disabled storage: ignore */ }
    }, 500)
    return () => clearTimeout(t)
  }, [layers, aspect, canvasW, canvasH, showGrid, showRulers, guides, canvasFill, canvasFillOpacity, poolId, modeId, colors, locks, paintFill, paintStroke, activePaint])

  /* Move a layer so it ends up at array position `toIndex` post-move. */
  const moveLayer = useCallback((id, toIndex) => {
    setLayersTracked((prev) => {
      const fromIndex = prev.findIndex((l) => l.id === id)
      if (fromIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      const clamped = Math.max(0, Math.min(next.length, toIndex))
      if (clamped === fromIndex) return prev
      next.splice(clamped, 0, moved)
      return next
    })
  }, [setLayersTracked])

  const value = {
    /* selection */
    selectedId, selectedIds, select, selectCanvas, toggleSelection, selectMany,

    /* preferences */
    snapEnabled, toggleSnap,

    /* loaded preset tracking */
    currentPresetId, currentPresetName, setCurrentPresetId, setCurrentPresetName,

    /* aspect + canvas dimensions + view */
    aspect, setAspect,
    canvasW, canvasH, canvasRatio, setCanvasSize,
    showGrid, setShowGrid, toggleGrid,
    showRulers, toggleRulers,
    guides, setGuides,
    view, setView,

    /* canvas fill (bottom-most "layer") */
    canvasFill, setCanvasFill,
    canvasFillOpacity, setCanvasFillOpacity,

    /* active paint (fill / stroke pair) + app-level paint colors */
    activePaint, setActivePaint,
    paintFill, setPaintFill,
    paintStroke, setPaintStroke,

    /* palette */
    poolId, modeId, colors, locks, edited, bgOn, isSeedPool, isSeedSeeding,
    palette,
    setPoolId: (id) => {
      setPoolId(id)
      setColors(poolFor(id).defaults)
      setLocks(FREE_FLAGS)
      setEdited(FREE_FLAGS)
      setHasRandomized(false)
    },
    setModeId: (id) => {
      setModeId(id)
      if (!poolFor(poolId).isSeed) {
        setColors(generateFor(poolId, id, colors, FREE_FLAGS))
        setLocks(FREE_FLAGS)
        setEdited(FREE_FLAGS)
      }
    },
    toggleLock: (idx) => setLocks((prev) => prev.map((v, i) => (i === idx ? !v : v))),
    setColorAt: (idx, hex) => {
      setColors((prev) => prev.map((v, i) => (i === idx ? hex : v)))
      if (!(isSeedSeeding && idx === 0)) {
        setEdited((prev) => prev.map((v, i) => (i === idx ? true : v)))
      }
    },
    randomize: () => {
      const generated = generateFor(poolId, modeId, colors, locks)
      const unlockedIdx = generated.map((_, i) => i).filter((i) => !locks[i])
      const unlockedValues = unlockedIdx.map((i) => generated[i])
      for (let i = unlockedValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[unlockedValues[i], unlockedValues[j]] = [unlockedValues[j], unlockedValues[i]]
      }
      const next = [...generated]
      unlockedIdx.forEach((pos, k) => { next[pos] = unlockedValues[k] })
      setColors(next)
      setEdited((prev) => prev.map((v, i) => (locks[i] ? v : false)))
      if (isSeedPool) setHasRandomized(true)
    },
    reset: () => {
      setLocks(FREE_FLAGS)
      setColors(poolFor(poolId).defaults)
      setEdited(FREE_FLAGS)
      setHasRandomized(false)
    },
    toggleBg: () => setBgOn((v) => !v),
    /* Load a saved palette spec into the live palette. Used by the topbar
     * "open library item" menu and PaletteInspector "Apply saved" button. */
    loadPalette: (item) => {
      if (!item) return
      if (item.poolId) setPoolId(item.poolId)
      if (item.modeId) setModeId(item.modeId)
      if (Array.isArray(item.colors)) setColors(item.colors)
      if (typeof item.bgEnabled === 'boolean') setBgOn(item.bgEnabled)
      setLocks(FREE_FLAGS)
      setEdited(FREE_FLAGS)
      setHasRandomized(false)
    },

    /* layers */
    layers,
    addLayer, removeLayer, updateLayer, toggleLayer, toggleLayerLock, moveLayer, duplicateLayer, clearLayers, deleteSelected,
    /* booleanSelected kept as an alias — existing call sites now wrap
     * non-destructively; switch them to booleanGroup at leisure. */
    flipLayer, flipSelected, booleanGroup, booleanSelected: booleanGroup, flattenSelected, convertShapeToPath,
    groupLayers, ungroupLayer, releaseBoolean, reparentLayer, alignSelected, flattenPattern, flattenText, addFlattenedFromFrame, loadPreset, insertFromLibrary,

    /* history */
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo, redo,
    beginTransaction, commitTransaction,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useComposeState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useComposeState must be inside <ComposeStateProvider>')
  return ctx
}

/* Resolve a color reference like 'palette:primary' or '#FFFFFF' to a hex. */
export function resolveColor(ref, palette) {
  if (!ref) return null
  if (typeof ref !== 'string') return null
  if (ref.startsWith('palette:')) return palette?.[ref.slice('palette:'.length)] ?? null
  return ref
}
