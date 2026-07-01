import '../../styles/kol-typography-fonts-full.css'
import EditorShell from '../../EditorShell'
import TypeCanvasPanel from './TypeCanvasPanel'
import TypeControlsPanel from './TypeControlsPanel'
import LayerStack from '../../compose/LayerStack'

/**
 * Type mode body. State provider lives one level up in `Editor.jsx`.
 */
const TYPE_REGISTRY = {
  canvas: TypeCanvasPanel,
  panels: [
    { slot: 'left.body',  order: 0, Component: LayerStack },
    { slot: 'right.body', order: 0, Component: TypeControlsPanel },
  ],
}

export default function TypeLab() {
  return <EditorShell registry={TYPE_REGISTRY} />
}
