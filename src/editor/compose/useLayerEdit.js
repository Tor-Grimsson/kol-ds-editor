import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useComposeState } from './state'

/**
 * useLayerEdit — single coordinator for "edit a layer."
 *
 * Replaces ad-hoc `updateLayer(id, ...)` calls scattered across inspectors,
 * keymap shortcuts, and color modal. Every writer goes through one hook so
 * batching, history, and (future) validation share one path.
 *
 * History modes:
 *   discrete    — every patch pushes its own history entry. Use for
 *                 commit-style writes (Enter, blur, button click).
 *   coalesce    — opens a transaction on first patch, commits after
 *                 `coalesceMs` of quiet. Use for slider drags, typed
 *                 inputs, hue strip drags — anything that fires in
 *                 rapid succession.
 *   transaction — caller manages begin/commit explicitly (see CanvasArea
 *                 drag-move). Patches don't push individually.
 *
 * Returns:
 *   patch(partial)        — merge-update layer fields.
 *   setProp(key, value)   — single-field shorthand.
 *   flush()               — force-commit pending coalesce now.
 */
export function useLayerEdit(id, { history = 'discrete', coalesceMs = 250 } = {}) {
  const { updateLayer, beginTransaction, commitTransaction } = useComposeState()
  const timerRef = useRef(null)

  const flush = useCallback(() => {
    if (timerRef.current === null) return
    clearTimeout(timerRef.current)
    timerRef.current = null
    commitTransaction()
  }, [commitTransaction])

  const patch = useCallback((partial) => {
    if (!id) return
    if (history === 'discrete') {
      updateLayer(id, partial)
      return
    }
    if (history === 'coalesce') {
      if (timerRef.current === null) beginTransaction()
      updateLayer(id, partial)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        commitTransaction()
      }, coalesceMs)
      return
    }
    /* 'transaction' — caller owns begin/commit. */
    updateLayer(id, partial)
  }, [id, history, coalesceMs, updateLayer, beginTransaction, commitTransaction])

  const setProp = useCallback((k, v) => patch({ [k]: v }), [patch])

  /* Commit any pending coalesced edit on unmount or id change so the work
   * isn't dropped on the floor. */
  useEffect(() => () => flush(), [flush, id])

  /* Memoized so consumers can put the hook's return in effect deps (e.g.
   * CanvasArea's window keydown keymap) without rebinding every render. */
  return useMemo(() => ({ patch, setProp, flush }), [patch, setProp, flush])
}
