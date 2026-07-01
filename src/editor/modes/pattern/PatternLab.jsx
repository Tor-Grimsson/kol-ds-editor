import EditorShell from '../../EditorShell'
import PatternCanvas from './PatternCanvas'
import PatternControls from './PatternControls'
import LayerStack from '../../compose/LayerStack'

/**
 * Pattern mode body. Layers in `left.body`; full pattern controls
 * (incl. rules) in `right.body`. File / Mode / Canvas / Templates in topbar.
 */
const PATTERN_REGISTRY = {
  canvas: PatternCanvas,
  panels: [
    { slot: 'left.body',  order: 0, Component: LayerStack },
    { slot: 'right.body', order: 0, Component: PatternControls },
  ],
}

export default function PatternLab() {
  return <EditorShell registry={PATTERN_REGISTRY} />
}
