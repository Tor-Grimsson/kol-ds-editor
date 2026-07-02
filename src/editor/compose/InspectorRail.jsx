import EditorButton from '../components/EditorButton'
import { useComposeState } from './state'
import { findLayerDeep } from './helpers'
import { labelForLayer } from './labels'
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
 * Palette stays in its own persistent PalettePanel. Aspect + view live in
 * the topbar Canvas menu.
 */
export default function InspectorRail() {
  const { selectedIds, selectedId, layers, groupLayers, deleteSelected } = useComposeState()

  /* `canvas` is selectable but not a layer — exclude from multi-layer
   * counting + group action. Canvas takes precedence: `selectCanvas` sets
   * `['canvas', ...allLayers]` so inspecting Canvas with ≥2 layers in the
   * frame would otherwise fall into the multi-layer branch and hide
   * fill/opacity controls behind the Group action. Trash is suppressed
   * for the canvas branch — `deleteSelected` would otherwise nuke every
   * layer in the frame. */
  const isCanvas = selectedId === 'canvas'
  const layerOnlyIds = selectedIds.filter((id) => id !== 'canvas')
  const isMultiLayer = !isCanvas && layerOnlyIds.length >= 2
  const layer = !isCanvas && !isMultiLayer ? findLayerDeep(layers, selectedId) : null
  const canDelete = !isCanvas && layerOnlyIds.length > 0
  const onDelete = deleteSelected

  let body = null
  let title = ''
  if (isCanvas) {
    title = 'Canvas'
    body  = <CanvasInspector />
  }
  else if (isMultiLayer) {
    title = `${layerOnlyIds.length} layers`
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
  else if (layer) { title = labelForLayer(layer); body = <LayerInspector layer={layer} /> }
  /* Nothing selected → show the canvas info / background as the default. */
  else { title = 'Canvas'; body = <CanvasInspector /> }

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      <div className="flex items-center gap-3 px-4 min-h-[46px]">
        {title && <span className="kol-helper-12 text-emphasis">{title}</span>}
        {canDelete && (
          <EditorButton
            variant="primary"
            size="sm"
            animateIcon
            quiet
            iconOnly="trash"
            iconSize={12}
            aria-label="Delete selected"
            title="Delete selected"
            onClick={onDelete}
            className="ml-auto"
            style={{ padding: 6 }}
          />
        )}
      </div>
      {body && (
        <div className="kol-compose-inspector-body">
          {body}
        </div>
      )}
    </div>
  )
}
