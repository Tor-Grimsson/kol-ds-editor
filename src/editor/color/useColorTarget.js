import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useComposeState, resolveColor, COLOR_LAYER_TYPES } from '../compose/state'
import { findLayerDeep } from '../compose/helpers'

/**
 * useColorTarget — single owner of "the current paint pair" (fill + stroke).
 *
 * Photoshop / Affinity model: SwatchStack is canonical. The fill / stroke
 * pair is **app-level state** (`paintFill` / `paintStroke` in compose
 * state), persistent across selections, exists with no selection at all.
 *
 * Reads always come from app-level state — there is no "no target" branch.
 *
 * Writes always succeed:
 *   - setFill(v)   → setPaintFill(v)
 *                    + (if color layer selected) updateLayer(id, { color: v })
 *                    + (if canvas selected)      setCanvasFill(v)
 *   - setStroke(v) → setPaintStroke(v)
 *                    + (if color layer selected) updateLayer(id, { stroke: v })
 *                    (canvas has no stroke; skipped)
 *
 * `activePaint` is the raw user-chosen focus — X (paint-toggle) always
 * toggles fill ↔ stroke regardless of selection. SwatchStack's front
 * indicator + the writer always agree because both come from the same
 * app-level source.
 *
 * Shape:
 *   { activePaint, setActivePaint, swap,
 *     hex, raw, onChange, label,         ← active paint
 *     fillHex,   fillRaw,   setFill,
 *     strokeHex, strokeRaw, setStroke }
 *
 * History: pass `{ history: 'coalesce' }` to bundle slider drags into
 * one undo entry per quiet period. Used by ColourPanel for the hue
 * strip / SB square / wheel / RGB+HSL slider drags.
 */
export function useColorTarget({ history = 'discrete', coalesceMs = 250 } = {}) {
  const {
    selectedId, layers, palette,
    canvasFill, setCanvasFill,
    updateLayer,
    activePaint, setActivePaint,
    paintFill,   setPaintFill,
    paintStroke, setPaintStroke,
    beginTransaction, commitTransaction,
  } = useComposeState()

  /* Coalesce: open one transaction on first write, commit after `coalesceMs`
   * of quiet. Slider drags + SB-square drags collapse to one undo entry. */
  const timerRef = useRef(null)
  const flush = useCallback(() => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    commitTransaction()
  }, [commitTransaction])
  const schedule = useCallback(() => {
    if (timerRef.current === null) beginTransaction()
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      commitTransaction()
    }, coalesceMs)
  }, [beginTransaction, commitTransaction, coalesceMs])
  useEffect(() => () => flush(), [flush])
  const coalesce = history === 'coalesce'

  const isCanvas = selectedId === 'canvas'
  const layer    = !isCanvas && selectedId ? findLayerDeep(layers, selectedId) : null
  const isColorLayer = !!layer && COLOR_LAYER_TYPES.has(layer.type)
  /* Narrow, identity-stable derivations — the callbacks/memo below key on
   * these instead of the layer OBJECT, whose identity churns on every layer
   * patch (60×/s during drags) and would rebuild the return each render. */
  const layerType    = layer?.type ?? ''
  const colorLayerId = isColorLayer ? layer.id : null

  /* Reads: always from app-level state. Resolved hex passes through
   * `resolveColor` so palette refs (set on the layer) display correctly
   * after the selection-sync effect copies them in. */
  const fillRaw   = paintFill
  const strokeRaw = paintStroke
  const fillHex   = resolveColor(fillRaw,   palette)
  const strokeHex = resolveColor(strokeRaw, palette)

  /* Writes: app-level always; selection (layer or canvas) when applicable. */
  const setFill = useCallback((v) => {
    if (coalesce) schedule()
    setPaintFill(v)
    if (isCanvas)          setCanvasFill(v)
    else if (colorLayerId) updateLayer(colorLayerId, { color: v })
  }, [coalesce, schedule, setPaintFill, isCanvas, setCanvasFill, colorLayerId, updateLayer])
  const setStroke = useCallback((v) => {
    if (coalesce) schedule()
    setPaintStroke(v)
    if (colorLayerId) updateLayer(colorLayerId, { stroke: v })
    /* canvas has no stroke; skipped */
  }, [coalesce, schedule, setPaintStroke, colorLayerId, updateLayer])

  const effective = activePaint === 'stroke' ? 'stroke' : 'fill'

  const swap = useCallback(() => {
    setActivePaint(effective === 'fill' ? 'stroke' : 'fill')
  }, [setActivePaint, effective])

  /* Memoized so consumers can put the hook's return in effect deps (e.g.
   * CanvasArea's window keydown keymap) without rebinding every render. */
  return useMemo(() => ({
    activePaint:    effective,
    setActivePaint,
    swap,
    label:          isCanvas ? 'Canvas' : layerType,

    /* active paint — what hue / D / N / inspector default writes target */
    hex:      (effective === 'stroke' ? strokeHex : fillHex) ?? '#000000',
    raw:      effective === 'stroke' ? strokeRaw : fillRaw,
    onChange: effective === 'stroke' ? setStroke : setFill,

    /* full pair — SwatchStack reads both at once */
    fillHex:   fillHex   ?? null,
    strokeHex: strokeHex ?? null,
    fillRaw, strokeRaw,
    setFill, setStroke,
  }), [effective, setActivePaint, swap, isCanvas, layerType, fillHex, strokeHex, fillRaw, strokeRaw, setFill, setStroke])
}
