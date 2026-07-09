import EditorButton from '../components/EditorButton'
import { useComposeState } from './state'
import { findLayerDeep } from './helpers'
import LayerInspector   from './inspectors/LayerInspector'
import CanvasInspector  from './inspectors/CanvasInspector'
import AlignmentPanel   from './AlignmentPanel'

/**
 * InspectorRail — Tool Properties panel content.
 *
 * Routes by selection:
 *   - empty                   → nothing-selected message
 *   - 'canvas'                → CanvasInspector (canvas-as-layer fill / opacity)
 *   - 1 layer.id              → layer inspector (delegates by type)
 *   - 2+ layer.ids            → multi-select summary + Group action
 *
 * Palette editing left the rail (palette modal). Aspect + view live in
 * the topbar Canvas menu.
 */
export default function InspectorRail() {
  const { selectedIds, selectedId, layers, groupLayers } = useComposeState()

  /* `canvas` is selectable but not a layer — exclude from multi-layer
   * counting + group action. Canvas takes precedence: `selectCanvas` sets
   * `['canvas', ...allLayers]` so inspecting Canvas with ≥2 layers in the
   * frame would otherwise fall into the multi-layer branch and hide
   * fill/opacity controls behind the Group action. The title + delete-layer
   * button live in the shared SelectionPalettePanel header now. */
  const isCanvas = selectedId === 'canvas'
  const layerOnlyIds = selectedIds.filter((id) => id !== 'canvas')
  const isMultiLayer = !isCanvas && layerOnlyIds.length >= 2
  const layer = !isCanvas && !isMultiLayer ? findLayerDeep(layers, selectedId) : null

  let body = null
  if (isCanvas) {
    body  = <CanvasInspector />
  }
  else if (isMultiLayer) {
    body = (
      <div className="flex flex-col gap-3">
        <p className="kol-helper-12 text-meta">{layerOnlyIds.length} layers selected.</p>
        <AlignmentPanel />
        <EditorButton
          variant="primary"
          size="sm"
          className="w-full"
          iconLeft="component"
          iconSize={12}
          onClick={() => groupLayers(layerOnlyIds)}
        >
          Group selection
        </EditorButton>
      </div>
    )
  }
  else if (layer) { body = <LayerInspector layer={layer} /> }
  /* Nothing selected → show the canvas info / background as the default. */
  else { body = <CanvasInspector /> }

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {body && (
        <div className="kol-compose-inspector-body">
          {body}
        </div>
      )}
    </div>
  )
}
