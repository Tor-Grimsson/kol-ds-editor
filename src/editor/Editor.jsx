import { useParams, Navigate } from 'react-router-dom'
import usePageTitle from '../components/hooks/usePageTitle'
import { ComposeStateProvider } from './compose/state'
import { PaletteStateProvider } from './modes/palette/state'
import { PatternStateProvider } from './modes/pattern/state'
import { TypeStateProvider }    from './modes/type/state'
import { ToolProvider }         from './state/tools'
import { useGlobalShortcuts }   from './state/useGlobalShortcuts'
import Compose from '../pages/Compose'
import ComboLab    from './modes/palette/ComboLab'
import PatternLab  from './modes/pattern/PatternLab'
import TypeLab     from './modes/type/TypeLab'

/**
 * Editor — `/editor/:mode` route component.
 *
 * Mounts every mode's state provider once, then dispatches to the
 * mode-specific body. Providers stay mounted so state persists across
 * mode switches.
 */
const MODE_TITLES = {
  compose: 'Compose',
  palette: 'Palette',
  pattern: 'Pattern',
  type:    'Type',
}

function ActiveMode() {
  const { mode } = useParams()
  usePageTitle(MODE_TITLES[mode] ?? 'Editor')
  /* Cross-mode shortcuts (undo / redo / deselect) — mounted at the route
   * level so palette / pattern / type modes get keyboard too, not just
   * Compose's CanvasArea. */
  useGlobalShortcuts()
  switch (mode) {
    case 'compose':  return <Compose />
    case 'palette':  return <ComboLab />
    case 'pattern':  return <PatternLab />
    case 'type':     return <TypeLab />
    default:         return <Navigate to="/editor/compose" replace />
  }
}

export default function Editor() {
  return (
    <ToolProvider>
      <ComposeStateProvider>
        <PaletteStateProvider>
          <PatternStateProvider>
            <TypeStateProvider>
              <ActiveMode />
            </TypeStateProvider>
          </PatternStateProvider>
        </PaletteStateProvider>
      </ComposeStateProvider>
    </ToolProvider>
  )
}
