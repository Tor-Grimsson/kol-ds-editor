import { useNavigate } from 'react-router-dom'
import EditorButton from '../../components/EditorButton'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { useComposeState } from '../../compose/state'
import TypeControls from './TypeControls'
import { cssFor } from './cuts'
import { buildTypeCompositionSvg, downloadSvg } from './buildTypeSvg'
import { useTypeState } from './state'

/**
 * TypeControlsPanel — Tool Properties content for Type mode. Wraps the
 * existing `TypeControls` editor surface and adds save / export buttons.
 */
export default function TypeControlsPanel() {
  const {
    state, set, selectedFrame,
    updateFrame, addFrame, explodeFrame, reset,
    boundLayerId, unbindLayer,
  } = useTypeState()
  const { saveType }    = useGeneratorLibrary()
  const { addLayer, addFlattenedFromFrame } = useComposeState()
  const navigate = useNavigate()

  const sendFrame = selectedFrame ?? state.frames[0]
  const willFlatten = !!sendFrame?.axisOn

  const onSendToCompose = async () => {
    const f = sendFrame
    if (!f) return
    if (f.axisOn) {
      /* Morph is on — flatten the current state to a group of per-glyph
       * shapes so the morphed visual lands in compose. Compose's text layer
       * doesn't carry morph fields by design (workshop vs compose split). */
      await addFlattenedFromFrame(f)
    } else {
      /* Plain text — match the field shape used by LayerInspector's "Apply
       * saved spec" picker. Drop color so the new layer keeps the default
       * `palette:dark` ref instead of pinning literal hex. */
      addLayer('text', {
        text:       f.text,
        width:      f.width,
        weight:     f.weight,
        italic:     f.italic,
        size:       f.size,
        tracking:   f.tracking,
        lineHeight: f.lineHeight,
        case:       f.case,
        textAlign:  f.textAlign,
      })
    }
    navigate('/editor/compose')
  }

  const onDoneLink = () => {
    unbindLayer()
    navigate('/editor/compose')
  }

  const onSave = () => {
    const f = selectedFrame ?? state.frames[0]
    if (!f) return
    saveType({
      text:       f.text,
      width:      f.width,
      weight:     f.weight,
      italic:     f.italic,
      size:       f.size,
      tracking:   f.tracking,
      lineHeight: f.lineHeight,
      case:       f.case,
      color:      f.color,
      textAlign:  f.textAlign,
      axisOn:     f.axisOn,
      width2:     f.width2,
      weight2:    f.weight2,
      blend:      f.blend,
    })
  }

  const onCopyCss = () => {
    const f = selectedFrame ?? state.frames[0]
    if (!f) return
    navigator.clipboard?.writeText(cssFor({
      width: f.width, weight: f.weight, italic: f.italic, size: f.size,
      tracking: f.tracking, lineHeight: f.lineHeight, color: f.color,
    }))
  }

  const onExportSvg = async () => {
    const svg = await buildTypeCompositionSvg(state)
    downloadSvg(svg, 'type-composition.svg')
  }

  return (
    <div className="kol-compose-rail">
      <div className="kol-compose-rail-head">
        <span className="kol-helper-10 uppercase text-meta">Type controls</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {boundLayerId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-secondary border border-fg-08">
            <span className="kol-helper-10 text-emphasis flex-1">Linked → Compose layer</span>
            <EditorButton variant="primary" size="sm" onClick={onDoneLink}>Done</EditorButton>
            <EditorButton variant="secondary" size="sm" onClick={unbindLayer} title="Unlink without leaving">Unlink</EditorButton>
          </div>
        )}
        <TypeControls
          state={state}
          set={set}
          selectedFrame={selectedFrame}
          onUpdateFrame={updateFrame}
          onAddFrame={addFrame}
          onExplode={explodeFrame}
          onCopy={onCopyCss}
          onReset={reset}
        />

        <EditorButton variant="primary" size="sm" className="w-full" onClick={onSave}>
          Save type to library
        </EditorButton>

        <EditorButton variant="primary" size="sm" className="w-full" onClick={onSendToCompose}>
          {willFlatten ? 'Flatten & send to compose' : 'Send to compose'}
        </EditorButton>

        <EditorButton
          variant="primary"
          size="sm"
          className="w-full"
          onClick={onExportSvg}
          title="Download the composition as an .svg file"
        >
          Download SVG
        </EditorButton>
      </div>
    </div>
  )
}
