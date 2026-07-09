import { useEffect } from 'react'
import EditorErrorBoundary from './EditorErrorBoundary'
import { ToolProvider }       from './state/tools'
import { GeneratorLibraryProvider } from './library/LibraryProvider'
import { useGlobalShortcuts } from './state/useGlobalShortcuts'
import { ComposeStateProvider, useComposeState } from './compose/state'
import { transport } from './params/transport'
import { getAppSettings } from './lib/appSettings'
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

  /* appSettings boot (labs parity): seed the canvas frame from the global
   * default aspect and start the transport if autoplay is on. Runs once at
   * mount — a draft-restore (async, behind a confirm) still overrides the
   * aspect afterward. The loop-theme + clip-to-frame defaults seed at
   * layer-create time (see appSettings.js consumers). */
  const { setAspect } = useComposeState()
  useEffect(() => {
    const s = getAppSettings()
    if (s.autoplay) transport.play()
    if (s.defaultAspect && s.defaultAspect !== 'custom') setAspect(s.defaultAspect)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Compose />
      <PaletteModal />
    </>
  )
}

/**
 * EditorProviders — the full context stack (error boundary + library > tool >
 * compose > palette > pattern > type), shared by the editor and the
 * chromeless output window (`./OutputView`) so both render off identical
 * state. Nesting order is load-bearing (see EditorBody). Library outermost —
 * MenuTop (File > Open) and every save-to-library flow read it.
 */
export function EditorProviders({ children, persistDraft = true }) {
  return (
    <EditorErrorBoundary>
      <GeneratorLibraryProvider>
        <ToolProvider>
          <ComposeStateProvider persistDraft={persistDraft}>
            <PaletteStateProvider>
              <PatternStateProvider>
                <TypeStateProvider>
                  {children}
                </TypeStateProvider>
              </PatternStateProvider>
            </PaletteStateProvider>
          </ComposeStateProvider>
        </ToolProvider>
      </GeneratorLibraryProvider>
    </EditorErrorBoundary>
  )
}

export default function Editor() {
  return (
    <EditorProviders>
      <EditorBody />
    </EditorProviders>
  )
}
