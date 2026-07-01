import PaletteInspector from '../../compose/inspectors/PaletteInspector'

/**
 * PalettePanel — right.body (top). Always-visible palette controls.
 * Persistent across selections, in every mode.
 *
 * Wraps the existing PaletteInspector content with a panel-style header
 * for visual consistency with the other rail panels.
 */
export default function PalettePanel() {
  return (
    <div className="kol-compose-rail">
      <div className="kol-compose-rail-head">
        <span className="kol-helper-10 uppercase text-meta">Palette</span>
      </div>
      <div className="p-4">
        <PaletteInspector />
      </div>
    </div>
  )
}
