import { useState } from 'react'
import EditorButton from '../../components/EditorButton'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { findLayerDeep } from '../helpers'
import { labelForLayer } from '../labels'
import { useLayerEdit } from '../useLayerEdit'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { SHAPE_SCHEMA } from '../../params/schemas/shape'
import { PATTERN_SCHEMA } from '../../params/schemas/pattern'
import { TEXT_SCHEMA } from '../../params/schemas/text'
import { PHOTO_SCHEMA } from '../../params/schemas/photo'
import { TEXT_TAB_KEYS } from './TextPanel'
import { loopById, loopBgToggleable } from '../../../loops/registry'
import { MISC_TREE } from '../../../loops/taxonomy'
import { LoopPicker } from './LoopPicker'
import KineticPanel from './KineticPanel'
import { themeParams } from '../../../loops/theme'
import { THEME_OPTIONS, DEFAULT_THEME } from '../../../loops/lib/themes'

/**
 * ParametersPanel — the Parameters tab of the right rail (Phase 6-A).
 *
 * The Inspector stays high-level (position / transform / opacity / blend /
 * paint); everything schema-driven or type-deep lives HERE: shape kind
 * params, photo fit, loop controls. Text typography and the pattern surface
 * moved to their selection-driven Text / Pattern tabs (TextPanel /
 * PatternPanel) — one home per control; this tab keeps their non-styling
 * remainder (content, saved-spec pickers, mode/flatten actions, tab:'anim'
 * params). Inspector pointer rows flip to this tab (`kol:open-params`).
 * Effects (filter picker + params) live in the dedicated Effects tab
 * (EffectsPanel).
 *
 * Labs information architecture (kol-labs-single scanlines): a segmented
 * Generate · Style · Animation strip splits each type's surface — Generate
 * holds pickers + randomize/actions, Style the look params (grouped under
 * section headers via schema `section` metadata), Animation the motion
 * params (`tab:'anim'`). Loop Category/Preset stay above the strip, always
 * reachable. Renders the same rail skeleton as InspectorRail (header row +
 * .kol-compose-inspector-body) so tab-switching doesn't shift the column.
 *
 * Same write path as the inspector: useLayerEdit coalesced history +
 * BindDot per animatable field.
 */
const SUBTAB_OPTIONS = [
  { value: 'generate', label: 'Generate' },
  { value: 'style',    label: 'Style' },
  { value: 'anim',     label: 'Animation' },
]
const ANIM_HINT = 'Animate any parameter via its bind dot.'

/* Text params minus the styling keys the Text tab owns (one home per
 * control) — leaves Content plus any future non-styling params. */
const TEXT_PARAMS_SCHEMA = TEXT_SCHEMA.filter((p) => !TEXT_TAB_KEYS.has(p.key))

export default function ParametersPanel() {
  const { selectedId, layers } = useComposeState()
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {/* min-h matches InspectorRail's header (trash button height) so
          tab switches never shift the column. */}
      <div className="flex items-center gap-3 px-4 min-h-[46px]">
        {layer && <span className="kol-helper-12 text-emphasis">{labelForLayer(layer)}</span>}
      </div>
      <div className="kol-compose-inspector-body">
        {layer
          ? <LayerParameters key={layer.id} layer={layer} />
          : <p className="kol-helper-12 text-meta">Select a layer to edit its parameters.</p>}
      </div>
    </div>
  )
}

function LayerParameters({ layer }) {
  const { updateLayer, convertShapeToPath, palette } = useComposeState()
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp
  const [tab, setTab] = useState('style')
  const renderAnimate = (p) => <BindDot layer={layer} param={p} setProp={setProp} />
  const shared = { layer, setProp, updateLayer, palette, renderAnimate, tab }
  const tabStrip = <SegmentedToggle value={tab} onChange={setTab} options={SUBTAB_OPTIONS} />

  let body = null
  /* Loop places the strip itself — Category/Preset stay above it. */
  let stripInBody = false
  if (layer.type === 'shape') {
    body = (
      <>
        {tab === 'generate' && ['rect', 'ellipse', 'triangle', 'polygon', 'star', 'line'].includes(layer.kind) && (
          <EditorButton
            variant="secondary" size="sm" className="w-full"
            onClick={() => convertShapeToPath(layer.id)}
            title="Convert the shape to an editable bezier path (one-way)"
          >
            Convert to path
          </EditorButton>
        )}
        {tab === 'style' && <AutoControls schema={SHAPE_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />}
        {tab === 'anim' && <AutoControls schema={SHAPE_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />}
      </>
    )
  } else if (layer.type === 'text') {
    body = <TextFields {...shared} />
  } else if (layer.type === 'pattern') {
    body = <PatternFields {...shared} />
  } else if (layer.type === 'photo') {
    /* Fit only — the filter picker + params live in the Effects tab. */
    body = (
      <>
        {tab === 'style' && <AutoControls schema={PHOTO_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />}
        {tab === 'anim' && <AutoControls schema={PHOTO_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />}
      </>
    )
  } else if (layer.type === 'loop') {
    body = <LoopFields {...shared} tabStrip={tabStrip} />
    stripInBody = true
  } else if (layer.type === 'misc') {
    body = <LoopFields {...shared} tabStrip={tabStrip} tree={MISC_TREE} />
    stripInBody = true
  } else if (layer.type === 'kinetic') {
    /* Kinetic places the strip itself — picker + Elements stay above it. */
    body = <KineticPanel {...shared} tabStrip={tabStrip} />
    stripInBody = true
  } else if (layer.type === 'path') {
    body = tab === 'anim' ? <p className="kol-helper-12 text-meta">{ANIM_HINT}</p> : null
  } else {
    return <p className="kol-helper-12 text-meta">This layer has no parameters.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {!stripInBody && tabStrip}
      {body}
    </div>
  )
}

/**
 * LoopFields — the loop layer's control surface (plan.md Phase 3): category →
 * preset picker (labs Loops page model, always visible above the sub-tab
 * strip), then Generate (theme/toggles + randomise) · Style · Animation.
 */
function LoopFields({ layer, setProp, updateLayer, palette, renderAnimate, tab, tabStrip, tree }) {
  const loop = loopById(layer.loopId)

  /* Theme — recolour roled color params (bg/fg/accent) via the imported
   * loops theme module. Non-roled params and user edits survive. */
  const themeId = layer.themeId ?? DEFAULT_THEME
  const invert = !!layer.themeInvert
  const onTheme  = (id) => updateLayer(layer.id, { themeId: id, ...themeParams(layer, loop?.params, id, invert) })
  const onInvert = (v)  => updateLayer(layer.id, { themeInvert: v, ...themeParams(layer, loop?.params, themeId, v) })

  const onRandomise = () => {
    const patch = {}
    for (const p of loop?.params ?? []) {
      if (p.noRandom) continue
      if (p.type === 'range') {
        const step = p.step ?? 1
        const raw = p.min + Math.random() * (p.max - p.min)
        patch[p.key] = Math.min(p.max, Math.max(p.min, Number((Math.round(raw / step) * step).toFixed(4))))
      } else if (p.type === 'toggle') {
        patch[p.key] = Math.random() < 0.5
      } else if (p.type === 'select' && p.options?.length) {
        patch[p.key] = p.options[Math.floor(Math.random() * p.options.length)].value
      }
    }
    updateLayer(layer.id, patch)
  }

  return (
    <>
      <LoopPicker layer={layer} tree={tree} />

      {tabStrip}

      {tab === 'generate' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <LabeledControl label="Theme">
              <Dropdown variant="subtle" size="sm" className="w-full" options={THEME_OPTIONS} value={themeId} onChange={onTheme} />
            </LabeledControl>
            <LabeledControl label="Invert">
              <ViewToggle
                options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                viewMode={invert ? 'on' : 'off'}
                onViewChange={(v) => onInvert(v === 'on')}
              />
            </LabeledControl>
            {/* Background on/off — only for loops whose bg is a pure backdrop
                fill (loopBgToggleable); hidden where bg feeds colour math or
                the loop is a GL engine. */}
            {loopBgToggleable(loop) && (
              <LabeledControl label="Background">
                <ViewToggle
                  options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                  viewMode={layer.bgOn === false ? 'off' : 'on'}
                  onViewChange={(v) => setProp('bgOn', v === 'on')}
                />
              </LabeledControl>
            )}
            {/* Camera drag — orbit-capable engines only. On = the engine's
                OrbitControls own the pointer on this layer (editor move-drag
                is suppressed there); off = normal layer dragging. */}
            {loop?.orbit && (
              <LabeledControl label="Camera drag">
                <ViewToggle
                  options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                  viewMode={layer.cameraDrag ? 'on' : 'off'}
                  onViewChange={(v) => setProp('cameraDrag', v === 'on')}
                />
              </LabeledControl>
            )}
          </div>

          <EditorButton variant="primary" size="sm" className="w-full" onClick={onRandomise}>
            Randomise
          </EditorButton>
        </>
      )}

      {tab === 'style' && (
        <AutoControls schema={loop?.params ?? []} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />
      )}

      {tab === 'anim' && (
        <AutoControls schema={loop?.params ?? []} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
      )}
    </>
  )
}

/**
 * PatternFields — the pattern layer's NON-styling remainder. The pattern
 * surface itself (schema params, rules editor, colors, save) lives in the
 * Pattern tab (PatternPanel) — one home per control.
 *
 * "Apply saved pattern" picker reads from `library.pattern` (Pattern Lab's
 * save slot) and copies params into the layer.
 */
function PatternFields({ layer, setProp, updateLayer, palette, renderAnimate, tab }) {
  const { library }        = useGeneratorLibrary()
  const { flattenPattern } = useComposeState()
  const patterns = library.pattern ?? []
  const patternOptions = [
    { value: '', label: '— pick spec' },
    ...patterns.map((p, i) => ({ value: p.id, label: `Pattern ${i + 1}` })),
  ]

  const onPickSpec = (id) => {
    if (!id) return
    const spec = patterns.find((p) => p.id === id)
    if (!spec) return
    /* Copy spec params into the layer. Color + bg stay as-is so the user's
     * palette refs aren't trampled by Pattern Lab's literal hex values. */
    updateLayer(layer.id, {
      shapeId:   spec.shapeId   ?? layer.shapeId,
      customSvg: spec.customSvg ?? layer.customSvg,
      cols:      spec.cols      ?? layer.cols,
      rows:      spec.rows      ?? layer.rows,
      gap:       spec.gap       ?? layer.gap,
      padding:   spec.padding   ?? layer.padding,
      stretch:   spec.stretch   ?? layer.stretch,
      overflow:  spec.overflow  ?? layer.overflow,
      rules:     spec.rules     ?? layer.rules,
    })
  }

  const onFlatten = () => flattenPattern(layer.id)

  return (
    <>
      {tab === 'generate' && (
        <>
          {patterns.length > 0 && (
            <LabeledControl label="Apply saved pattern">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={patternOptions}
                value=""
                onChange={onPickSpec}
              />
            </LabeledControl>
          )}

          <div className="pt-2 border-t border-fg-08">
            <EditorButton variant="secondary" size="sm" className="w-full" onClick={onFlatten}
              title="Flatten the pattern to static SVG shapes (one-way)">
              Flatten
            </EditorButton>
          </div>
        </>
      )}

      {tab === 'style' && (
        <p className="kol-helper-12 text-meta">Pattern styling lives in the Pattern tab.</p>
      )}

      {tab === 'anim' && (
        <AutoControls schema={PATTERN_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
      )}
    </>
  )
}

/**
 * TextFields — the text layer's NON-styling remainder. Typography styling
 * (width/weight/case/italic/align/metrics) lives in the Text tab (TextPanel)
 * — one home per control; Style here keeps the Content field.
 *
 * Optional "Saved as" picker reads from the shared library's `type` slot
 * (saves from Type Lab). Picking a spec copies its typography fields into
 * the layer (no live link — layer stays self-contained).
 */
function TextFields({ layer, setProp, updateLayer, palette, renderAnimate, tab }) {
  const { library } = useGeneratorLibrary()
  const { flattenText } = useComposeState()
  const specs = library.type ?? []

  const onFlatten = () => flattenText(layer.id)
  const specOptions = [
    { value: '', label: '— free-form' },
    ...specs.map((t, i) => ({ value: t.id, label: t.text?.slice(0, 24) || `Spec ${i + 1}` })),
  ]

  const onPickSpec = (id) => {
    if (!id) return
    const spec = specs.find((t) => t.id === id)
    if (!spec) return
    /* Copy spec values into the layer fields. Self-contained — no specId tag. */
    updateLayer(layer.id, {
      text:       spec.text       ?? layer.text,
      width:      spec.width      ?? layer.width,
      weight:     spec.weight     ?? layer.weight,
      italic:     spec.italic     ?? layer.italic,
      size:       spec.size       ?? layer.size,
      tracking:   spec.tracking   ?? layer.tracking,
      lineHeight: spec.lineHeight ?? layer.lineHeight,
      case:       spec.case       ?? layer.case,
      textAlign:  spec.textAlign  ?? layer.textAlign,
    })
  }

  return (
    <>
      {tab === 'generate' && (
        <>
          {specs.length > 0 && (
            <LabeledControl label="Apply saved spec">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={specOptions}
                value=""
                onChange={onPickSpec}
              />
            </LabeledControl>
          )}

          <EditorButton variant="secondary" size="sm" className="w-full" onClick={onFlatten}
            title="Flatten the text to glyph-outline shapes (one-way)">
            Flatten
          </EditorButton>
        </>
      )}

      {tab === 'style' && (
        <AutoControls schema={TEXT_PARAMS_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />
      )}

      {tab === 'anim' && (
        <AutoControls schema={TEXT_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
      )}
    </>
  )
}
