import { useEffect, useState } from 'react'
import { comboLabel, shortcutsBySection } from '../state/keymap'
import EditorButton from '../components/EditorButton'

/**
 * ShortcutsOverlay — modal cheat sheet for the editor keymap.
 *
 * Listens for the window event `kol:show-shortcuts` to open. Esc / backdrop
 * click / close button to dismiss. Renders SHORTCUTS grouped by section in a
 * 2-column layout.
 *
 * The window-event channel keeps this component decoupled from the canvas
 * key handler — anything that wants to summon the overlay just dispatches
 * the event.
 */

/* Modal backdrop — dark in both themes (kol-theme ships no scrim token yet). */
const SCRIM = 'rgba(0, 0, 0, 0.6)'

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onShow  = () => setOpen(true)
    const onClose = () => setOpen(false)
    window.addEventListener('kol:show-shortcuts',  onShow)
    window.addEventListener('kol:close-shortcuts', onClose)
    return () => {
      window.removeEventListener('kol:show-shortcuts',  onShow)
      window.removeEventListener('kol:close-shortcuts', onClose)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const sections = shortcutsBySection()

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: SCRIM }}
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-surface-primary border border-fg-08 rounded shadow-xl flex flex-col"
        style={{ width: 720, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-fg-08">
          <span className="kol-helper-12 text-emphasis">Keyboard shortcuts</span>
          <EditorButton
            variant="primary"
            size="sm"
            quiet
            iconOnly="close"
            iconSize={14}
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="overflow-y-auto p-5 grid grid-cols-2 gap-x-8 gap-y-5">
          {sections.map(({ section, items }) => (
            <Section key={section} title={section} items={items} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ title, items }) {
  return (
    <div>
      <p className="kol-helper-10 uppercase tracking-widest text-meta mb-2">{title}</p>
      <ul className="flex flex-col">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-1">
            <span className="kol-helper-12 text-emphasis normal-case tracking-normal">{s.label}</span>
            <kbd
              className="kol-mono-10 text-meta px-2 py-0.5 rounded border border-fg-08 bg-fg-04"
              style={{ minWidth: 32, textAlign: 'center' }}
            >
              {comboLabel(s.combo)}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  )
}
