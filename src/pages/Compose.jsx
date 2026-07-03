import usePageTitle from '../components/hooks/usePageTitle'
import EditorShell from '../editor/EditorShell'
import CanvasArea from '../editor/compose/CanvasArea'
import ColorModal from '../editor/color/ColorModal'
import LayersAssetsPanel from '../editor/shell/panels/LayersAssetsPanel'
import SelectionPalettePanel from '../editor/shell/panels/SelectionPalettePanel'
import ToolPalette from '../editor/shell/panels/ToolPalette'
import EditorFooter from '../editor/shell/panels/EditorFooter'
import TimelineDock from '../editor/params/TimelineDock'

/**
 * Compose body — the editor surface. File / Canvas / Templates menus live in
 * the topbar (rendered by EditorShell). ToolPalette sits above the canvas in
 * the canvas-column header. Left rail: Layers/Assets tab group + the
 * Transport/Output/File footer (pinned). Right rail: Palette/Inspector tab
 * group that auto-flips to Inspector on layer-select. ColorModal here is the
 * per-layer color panel (Stroke/Colour/Swatches); the palette generator is
 * the separate PaletteModal mounted by Editor.
 */
const COMPOSE_REGISTRY = {
  canvas: CanvasArea,
  panels: [
    { slot: 'canvas.header', order: 0,  Component: ToolPalette },
    { slot: 'canvas.footer', order: 0,  Component: TimelineDock },
    { slot: 'left.body',     order: -1, Component: ColorModal },
    { slot: 'left.body',     order: 0,  Component: LayersAssetsPanel },
    { slot: 'left.footer',   order: 0,  Component: EditorFooter },
    { slot: 'right.body',    order: 0,  Component: SelectionPalettePanel },
  ],
}

export default function Compose() {
  usePageTitle('Editor')
  return <EditorShell registry={COMPOSE_REGISTRY} />
}
