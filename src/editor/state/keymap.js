/**
 * Editor keymap — single source of truth for keyboard shortcuts.
 *
 * Each entry is `{ id, combo, label, section, hidden? }`. The canvas key
 * handler uses `matchAny(event)` to look up the matching shortcut by combo;
 * the ShortcutsOverlay reads SHORTCUTS to render the cheat sheet (skipping
 * `hidden: true` entries).
 *
 * Combo grammar: `Mod+Shift+Alt+Key`. `Mod` = ⌘ on Mac, Ctrl elsewhere.
 * Keys are either a single character (case-insensitive for letters) or a
 * named key like `ArrowLeft`, `Escape`, `Space`, `Backspace`, `Delete`,
 * `Tab`, `Enter`.
 */

export const SHORTCUTS = [
  /* Edit */
  { id: 'undo',        combo: 'Mod+Z',       label: 'Undo',                     section: 'Edit' },
  { id: 'redo',        combo: 'Mod+Shift+Z', label: 'Redo',                     section: 'Edit' },
  { id: 'redo-alt',    combo: 'Mod+Y',       label: 'Redo',                     section: 'Edit', hidden: true },
  { id: 'duplicate',   combo: 'Mod+D',       label: 'Duplicate selection',      section: 'Edit' },
  { id: 'delete-back', combo: 'Backspace',   label: 'Delete selection',         section: 'Edit' },
  { id: 'delete-fwd',  combo: 'Delete',      label: 'Delete selection',         section: 'Edit', hidden: true },

  /* Selection */
  { id: 'deselect',    combo: 'Escape',      label: 'Deselect',                 section: 'Selection' },
  { id: 'group',       combo: 'Mod+G',       label: 'Group selection',          section: 'Selection' },
  { id: 'ungroup',     combo: 'Mod+Shift+G', label: 'Ungroup',                  section: 'Selection' },

  /* Layer */
  { id: 'toggle-lock',       combo: 'L',                  label: 'Toggle lock',          section: 'Layer' },
  { id: 'toggle-visibility', combo: 'H',                  label: 'Toggle visibility',    section: 'Layer' },
  { id: 'flip-h',            combo: 'Shift+H',            label: 'Flip horizontal',      section: 'Layer' },
  { id: 'flip-v',            combo: 'Shift+V',            label: 'Flip vertical',        section: 'Layer' },
  { id: 'nudge-left',        combo: 'ArrowLeft',          label: 'Nudge ← 1px',          section: 'Layer' },
  { id: 'nudge-right',       combo: 'ArrowRight',         label: 'Nudge → 1px',          section: 'Layer' },
  { id: 'nudge-up',          combo: 'ArrowUp',            label: 'Nudge ↑ 1px',          section: 'Layer' },
  { id: 'nudge-down',        combo: 'ArrowDown',          label: 'Nudge ↓ 1px',          section: 'Layer' },
  { id: 'nudge-left-10',     combo: 'Shift+ArrowLeft',    label: 'Nudge ← 10px',         section: 'Layer', hidden: true },
  { id: 'nudge-right-10',    combo: 'Shift+ArrowRight',   label: 'Nudge → 10px',         section: 'Layer', hidden: true },
  { id: 'nudge-up-10',       combo: 'Shift+ArrowUp',      label: 'Nudge ↑ 10px',         section: 'Layer', hidden: true },
  { id: 'nudge-down-10',     combo: 'Shift+ArrowDown',    label: 'Nudge ↓ 10px',         section: 'Layer', hidden: true },

  /* Tools */
  { id: 'tool-select',  combo: 'V', label: 'Select tool',       section: 'Tools' },
  { id: 'node-edit',    combo: 'A', label: 'Edit path nodes',   section: 'Tools' },
  { id: 'tool-text',    combo: 'T', label: 'Text tool',         section: 'Tools' },
  { id: 'tool-pen',     combo: 'P', label: 'Pen tool',          section: 'Tools' },
  { id: 'tool-rect',    combo: 'R', label: 'Rectangle tool',    section: 'Tools' },
  { id: 'tool-ellipse', combo: 'O', label: 'Ellipse tool',      section: 'Tools' },
  { id: 'tool-zoom',    combo: 'Z', label: 'Zoom tool',         section: 'Tools' },

  /* Color */
  { id: 'paint-default', combo: 'D',       label: 'Default fill + stroke (white / black)', section: 'Color' },
  { id: 'paint-toggle',  combo: 'X',       label: 'Toggle fill / stroke focus',            section: 'Color' },
  { id: 'paint-swap',    combo: 'Shift+X', label: 'Swap fill and stroke colors',           section: 'Color' },
  { id: 'paint-clear',   combo: 'N',       label: 'Clear focused paint (none)',            section: 'Color' },
  { id: 'paint-clear',   combo: '/',       label: 'Clear focused paint (none)',            section: 'Color', hidden: true },

  /* View */
  { id: 'show-shortcuts', combo: 'S',     label: 'Show shortcuts',          section: 'View' },
  { id: 'pan',            combo: 'Space', label: 'Hold + drag to pan',      section: 'View', passive: true },
]

const KEY_LABELS = {
  Mod:        '⌘',
  Shift:      '⇧',
  Alt:        '⌥',
  Ctrl:       '⌃',
  ArrowLeft:  '←',
  ArrowRight: '→',
  ArrowUp:    '↑',
  ArrowDown:  '↓',
  Backspace:  '⌫',
  Delete:     'Del',
  Escape:     'Esc',
  Space:      'Space',
  Tab:        'Tab',
  Enter:      '⏎',
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

/* Parse a combo string into its constituent parts. */
function parseCombo(combo) {
  const parts = combo.split('+')
  return {
    needsMod:   parts.includes('Mod'),
    needsShift: parts.includes('Shift'),
    needsAlt:   parts.includes('Alt'),
    key:        parts[parts.length - 1],
  }
}

/* Match a KeyboardEvent against a combo string. */
export function matchCombo(event, combo) {
  const { needsMod, needsShift, needsAlt, key } = parseCombo(combo)
  const modPressed = isMac() ? event.metaKey : event.ctrlKey

  if (needsMod !== modPressed) return false
  if (needsShift !== event.shiftKey) return false
  if (needsAlt !== event.altKey) return false

  if (key.length === 1) return event.key.toLowerCase() === key.toLowerCase()
  if (key === 'Space') return event.code === 'Space'
  return event.key === key || event.code === key
}

/* Find the first SHORTCUTS entry that matches the given event. Skips
 * entries flagged `passive: true` (those are documented but handled
 * elsewhere — e.g. Space-pan in PanViewport). */
export function matchAny(event, shortcuts = SHORTCUTS) {
  for (const s of shortcuts) {
    if (s.passive) continue
    if (matchCombo(event, s.combo)) return s
  }
  return null
}

/* Render a combo as glyphs for display: 'Mod+Shift+Z' → '⌘⇧Z'. */
export function comboLabel(combo) {
  return combo.split('+').map((p) => KEY_LABELS[p] ?? p).join('')
}

/* Group SHORTCUTS by section, preserving SHORTCUTS order within each group.
 * Skips hidden entries. */
export function shortcutsBySection() {
  const groups = new Map()
  for (const s of SHORTCUTS) {
    if (s.hidden) continue
    if (!groups.has(s.section)) groups.set(s.section, [])
    groups.get(s.section).push(s)
  }
  return [...groups.entries()].map(([section, items]) => ({ section, items }))
}
