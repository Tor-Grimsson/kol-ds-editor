import EditorShell from '../../EditorShell'
import PaletteCanvas from './PaletteCanvas'
import PaletteControls from './PaletteControls'
import LayerStack from '../../compose/LayerStack'

/**
 * Palette mode body. State provider lives one level up in `Editor.jsx`.
 *
 * `LayerStack` mounts in every mode's `left.body` so the compose canvas
 * state stays visible while authoring in tool modes.
 */
const PALETTE_REGISTRY = {
  canvas: PaletteCanvas,
  panels: [
    { slot: 'left.body',  order: 0, Component: LayerStack },
    { slot: 'right.body', order: 0, Component: PaletteControls },
  ],
}

export default function ComboLab() {
  return <EditorShell registry={PALETTE_REGISTRY} />
}
