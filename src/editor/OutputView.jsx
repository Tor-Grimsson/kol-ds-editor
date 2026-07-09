import { useEffect } from 'react'
import { EditorProviders } from './Editor'
import Canvas from './shell/Canvas'
import LayerRenderer from './compose/LayerRenderer'
import { resolveColor, useComposeState } from './compose/state'
import { transport } from './params/transport'
import { applyThemeMode, getThemeMode } from './theme'
import { OUTPUT_SNAPSHOT_KEY } from './compose/useComposeFile'

/**
 * OutputView — the composition rendered full-screen with ZERO editor chrome,
 * opened in its own browser tab (App gates on `?view=output`). Purpose: a
 * clean surface to screen-record with OS/tab capture, sidestepping the in-app
 * SVG-round-trip Record path and its fps sag. It seeds from a one-shot
 * localStorage snapshot the "Open output" button writes (see
 * `useComposeFile.openOutputWindow`) — a static document is all a loop
 * recording needs, the loop plays live via the transport.
 */

/* Frame fill with opacity — mirrors CanvasArea's bgColor derivation.
 * ponytail: tiny pure copy, not worth a shared util just for this. */
function hexWithAlpha(hex, alpha) {
  if (!hex || typeof hex !== 'string') return hex
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* Chromeless frame: the same `Canvas` letterbox CanvasArea uses, with
 * `guideColor="transparent"` collapsing the dashed border + aspect label to
 * nothing, and no pan/zoom/rulers. Just the composition, fit to the tab.
 * Exported — the mobile chrome (`./mobile/MobileView`) renders on it too. */
export function OutputStage({ fit = 'contain' }) {
  const { aspect, canvasW, canvasH, layers, palette, canvasFill, canvasFillOpacity } = useComposeState()
  const fillHex = resolveColor(canvasFill, palette)
  const bgColor = fillHex
    ? (canvasFillOpacity < 1 ? hexWithAlpha(fillHex, canvasFillOpacity) : fillHex)
    : null
  return (
    <div className="fixed inset-0" style={{ background: '#000' }}>
      <Canvas
        aspect={aspect}
        customRatio={canvasW / canvasH}
        bgColor={bgColor ?? undefined}
        guideColor="transparent"
        gutter={0}
        fit={fit}
      >
        <div className="relative w-full h-full">
          {layers.map((layer) => (
            <LayerRenderer key={layer.id} layer={layer} palette={palette} />
          ))}
        </div>
      </Canvas>
    </div>
  )
}

/* Runs inside the provider stack: apply the stored theme, hydrate the doc from
 * the snapshot, start playback, render the stage. Once, on mount. */
function OutputBody() {
  const { loadPreset } = useComposeState()
  useEffect(() => {
    applyThemeMode(getThemeMode())
    try {
      const raw = localStorage.getItem(OUTPUT_SNAPSHOT_KEY)
      const env = raw ? JSON.parse(raw) : null
      if (env?.spec) loadPreset(env.spec)
    } catch { /* no/invalid snapshot — render whatever the stack seeds */ }
    transport.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <OutputStage />
}

export default function OutputView() {
  return (
    /* persistDraft off — the output tab renders a snapshot; prompting restore
     * or autosaving that snapshot over the editor's live draft is never right. */
    <EditorProviders persistDraft={false}>
      <OutputBody />
    </EditorProviders>
  )
}
