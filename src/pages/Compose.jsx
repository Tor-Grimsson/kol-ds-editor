import usePageTitle from '../components/hooks/usePageTitle'
import EditorShell from '../editor/EditorShell'
import CanvasArea from '../editor/compose/CanvasArea'
import LayersAssetsPanel from '../editor/shell/panels/LayersAssetsPanel'
import SelectionPalettePanel from '../editor/shell/panels/SelectionPalettePanel'
import ColorModal from '../editor/color/ColorModal'
import ToolPalette from '../editor/shell/panels/ToolPalette'

/**
 * Compose mode body. File / Mode / Canvas / Templates menus live in the
 * topbar (rendered by EditorShell). ToolPalette sits above the canvas in
 * the canvas-column header. Left rail: ColorModal (top) + Layers/Assets
 * tab group (bottom). Right rail: Palette/Inspector tab group that
 * auto-flips to Inspector on layer-select.
 */
const COMPOSE_REGISTRY = {
  canvas: CanvasArea,
  panels: [
    { slot: 'canvas.header', order: 0,  Component: ToolPalette },
    { slot: 'left.body',     order: -1, Component: ColorModal },
    { slot: 'left.body',     order: 0,  Component: LayersAssetsPanel },
    { slot: 'right.body',    order: 0,  Component: SelectionPalettePanel },
  ],
}

export default function Compose() {
  usePageTitle('Compose')
  return <EditorShell registry={COMPOSE_REGISTRY} />
}
