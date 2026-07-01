import Canvas, { CANVAS_DEFAULTS } from '../../shell/Canvas'
import TypeCanvas from './TypeCanvas'
import { useTypeState } from './state'

/**
 * TypeCanvasPanel — canvas content for Type mode. Wraps the existing
 * `TypeCanvas` (inner frame rendering) inside a `Canvas` (aspect + pan)
 * with state from context.
 */
export default function TypeCanvasPanel() {
  const { state, selectedFrame, updateFrame, deleteFrame, selectFrame } = useTypeState()
  return (
    <Canvas
      aspect={state.aspect}
      bgColor={state.bgColor}
      guideColor={selectedFrame?.color ?? CANVAS_DEFAULTS.guideColor}
      panEnabled
    >
      <TypeCanvas
        frames={state.frames}
        selectedId={state.selectedId}
        onSelect={selectFrame}
        onUpdateFrame={updateFrame}
        onDeleteFrame={deleteFrame}
      />
    </Canvas>
  )
}
