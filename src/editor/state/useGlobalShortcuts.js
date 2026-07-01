import { useEffect } from 'react'
import { matchAny } from './keymap'
import { useComposeState } from '../compose/state'

/**
 * useGlobalShortcuts — keymap dispatcher for shortcuts that should work in
 * EVERY mode, not just Compose. Mounted by EditorShell so palette / pattern
 * / type all get undo, redo, deselect, etc.
 *
 * Compose-only shortcuts (delete layer, group, paint focus, tools) stay in
 * CanvasArea's local handler — they're only meaningful when CanvasArea is
 * mounted.
 *
 * Inputs and contentEditable elements are skipped so typing doesn't trigger
 * shortcuts (matches the local CanvasArea dispatcher's behavior).
 */
const GLOBAL_IDS = new Set(['undo', 'redo', 'redo-alt', 'deselect'])

export function useGlobalShortcuts() {
  const { undo, redo, canUndo, canRedo, select } = useComposeState()

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const shortcut = matchAny(e)
      if (!shortcut || !GLOBAL_IDS.has(shortcut.id)) return

      switch (shortcut.id) {
        case 'undo':       if (canUndo) { e.preventDefault(); undo() }; return
        case 'redo':
        case 'redo-alt':   if (canRedo) { e.preventDefault(); redo() }; return
        case 'deselect':   e.preventDefault(); select(null); return
        default:           return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, canUndo, canRedo, select])
}
