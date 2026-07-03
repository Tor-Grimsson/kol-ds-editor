import EditorErrorBoundary from './EditorErrorBoundary'
import { ToolProvider }       from './state/tools'
import { GeneratorLibraryProvider } from './library/LibraryProvider'
import { useGlobalShortcuts } from './state/useGlobalShortcuts'
import { ComposeStateProvider } from './compose/state'
import { PaletteStateProvider } from './modes/palette/state'
import { PatternStateProvider } from './modes/pattern/state'
import { TypeStateProvider }    from './modes/type/state'
import PaletteModal from './color/PaletteModal.jsx'
import Compose from '../pages/Compose'

/**
 * Editor — the whole app, mounted at `/`.
 *
 * Always renders the compose body. The palette / pattern / type state
 * providers stay mounted (nesting order preserved from the old registry:
 * ToolProvider > Compose > Palette > Pattern > Type) — the color modal and
 * library flows read palette state, and pattern / type state can still back
 * library items. PaletteModal (the palette generator; NOT color/ColorModal,
 * which is the per-layer color panel in the left rail) mounts inside the
 * stack so it sees palette + compose state; opens on `kol:open-color-modal`.
 */
function EditorBody() {
  /* Global shortcuts (undo / redo / deselect) — mounted here so keyboard
   * works everywhere, not just inside CanvasArea. */
  useGlobalShortcuts()
  return (
    <>
      <Compose />
      <PaletteModal />
    </>
  )
}

export default function Editor() {
  return (
    <EditorErrorBoundary>
      {/* Library outermost — MenuTop (File > Open) and every save-to-library
       * flow read it; it was exported but mounted nowhere, so all of those
       * silently no-opped against the empty fallback. */}
      <GeneratorLibraryProvider>
        <ToolProvider>
          <ComposeStateProvider>
            <PaletteStateProvider>
              <PatternStateProvider>
                <TypeStateProvider>
                  <EditorBody />
                </TypeStateProvider>
              </PatternStateProvider>
            </PaletteStateProvider>
          </ComposeStateProvider>
        </ToolProvider>
      </GeneratorLibraryProvider>
    </EditorErrorBoundary>
  )
}
