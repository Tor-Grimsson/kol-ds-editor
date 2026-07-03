import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EditorButton from '../../components/EditorButton'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { Slider, Textarea } from '@kolkrabbi/kol-component'
import { ColorField } from './ColorField'
import { useComposeState, resolveColor } from '../state'
import { findLayerDeep } from '../helpers'
import { labelForLayer } from '../labels'
import { useLayerEdit } from '../useLayerEdit'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { usePatternState } from '../../modes/pattern/state'
import { useTypeState } from '../../modes/type/state'
import RuleRow, { newRule, randomRule } from '../../modes/pattern/RuleRow'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { SHAPE_SCHEMA } from '../../params/schemas/shape'
import { PATTERN_SCHEMA } from '../../params/schemas/pattern'
import { TEXT_SCHEMA } from '../../params/schemas/text'
import { PHOTO_SCHEMA } from '../../params/schemas/photo'
import { loopById, loopBgToggleable } from '../../../loops/registry'
import { LoopPicker } from './LoopPicker'
import { themeParams } from '../../../loops/theme'
import { THEME_OPTIONS, DEFAULT_THEME } from '../../../loops/lib/themes'
import { KINETIC_PRESETS, kineticPresetById, presetComp } from '../../../kinetic/presets'
import { KINETIC_KNOBS, knobOptions, randomiseComp } from '../../../kinetic/knobs'

/**
 * ParametersPanel — the Parameters tab of the right rail (Phase 6-A).
 *
 * The Inspector stays high-level (position / transform / opacity / blend /
 * paint); everything schema-driven or type-deep lives HERE: shape kind
 * params, text typography, pattern surface, photo fit, loop controls.
 * Inspector pointer rows flip to this tab (`kol:open-params`). Effects
 * (filter picker + params) live in the dedicated Effects tab (EffectsPanel).
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
  } else if (layer.type === 'kinetic') {
    body = <KineticFields {...shared} />
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
function LoopFields({ layer, setProp, updateLayer, palette, renderAnimate, tab, tabStrip }) {
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
      <LoopPicker layer={layer} />

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
 * KineticFields — the kinetic-type layer's control surface: a preset player
 * over the opaque `layer.comp` composition, deliberately NOT the labs kinetic
 * editor. Knobs come from KINETIC_KNOBS (src/kinetic/knobs.js) — a declarative
 * schema whose get/set are pure comp transforms, rendered here rather than via
 * AutoControls because the comp is the layer's single source of truth (flat
 * layer-prop mirrors would desync on preset switches). Every edit writes a
 * fresh comp through setProp (coalesced history). Generate = preset picker +
 * per-instance text + Randomise; Style = look/arrangement knobs; Animation =
 * motion knobs + stagger (per-string desync) with the bind-dot hint.
 */
function KineticFields({ layer, setProp, updateLayer, palette, tab }) {
  const comp = layer.comp ?? { bg: '#0b0d12', instances: [] }
  const presetOptions = KINETIC_PRESETS.map((p) => ({ value: p.id, label: p.sub ? `${p.sub} · ${p.label}` : p.label }))

  /* Picking a preset resets the whole composition (loop preset semantics —
   * a curated starting point, not a patch). Discrete history entry. */
  const applyPreset = (id) => {
    const preset = kineticPresetById(id)
    if (!preset) return
    updateLayer(layer.id, { presetId: preset.id, presetLabel: preset.label, comp: presetComp(preset) })
  }

  /* Immutable comp writes — knobs return fresh objects all the way down so
   * the renderer's identity check re-applies the composition. */
  const writeComp = (next) => setProp('comp', next)
  const patchInstance = (idx, partial) =>
    writeComp({ ...comp, instances: comp.instances.map((x, i) => (i === idx ? { ...x, ...partial } : x)) })

  /* Randomise — roll the tractable knobs (noRandom/when honored in
   * randomiseComp). Discrete history entry, like a preset pick. */
  const onRandomise = () => updateLayer(layer.id, { comp: randomiseComp(comp) })

  const knobs = KINETIC_KNOBS.filter((k) => k.tab === tab && (!k.when || k.when(comp)))

  return (
    <>
      {tab === 'generate' && (
        <>
          <LabeledControl label="Preset">
            <Dropdown
              variant="subtle" size="sm" className="w-full"
              options={presetOptions}
              value={layer.presetId}
              onChange={applyPreset}
            />
          </LabeledControl>
          {comp.instances.map((inst, i) => (
            <LabeledControl key={inst.id ?? i} label={i === 0 ? 'Text' : `Text ${i + 1}`}>
              <Textarea
                variant="ghost" size="sm" rows={2}
                value={inst.text ?? ''}
                onChange={(e) => patchInstance(i, { text: e.target.value })}
              />
            </LabeledControl>
          ))}
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onRandomise}>
            Randomise
          </EditorButton>
        </>
      )}

      {tab !== 'generate' && knobs.map((k, i) => (
        <Fragment key={k.key}>
          {k.section && k.section !== knobs[i - 1]?.section && (
            <span className="kol-helper-10 text-meta">{k.section}</span>
          )}
          <KineticKnob knob={k} comp={comp} palette={palette} onComp={writeComp} />
        </Fragment>
      ))}

      {tab === 'anim' && <p className="kol-helper-12 text-meta">{ANIM_HINT}</p>}
    </>
  )
}

/* One kinetic knob → the matching KOL control. Writes go through the knob's
 * pure comp transform; palette refs resolve to literal hex at write time —
 * the SVG engine paints raw fill strings (same trade-off as "Edit in Pattern
 * mode"). */
function KineticKnob({ knob: k, comp, palette, onComp }) {
  const value = k.get(comp)
  const write = (v) => onComp(k.set(comp, v))
  if (k.type === 'color') {
    return <ColorField label={k.label} value={value} onChange={(v) => write(resolveColor(v, palette) ?? v)} palette={palette} />
  }
  if (k.type === 'select') {
    return (
      <LabeledControl label={k.label}>
        <Dropdown variant="subtle" size="sm" className="w-full" options={knobOptions(k, comp)} value={value} onChange={write} />
      </LabeledControl>
    )
  }
  return (
    <LabeledControl label={k.label}>
      <Slider min={k.min} max={k.max} step={k.step ?? 1} value={typeof value === 'number' ? value : k.min} onChange={write} />
    </LabeledControl>
  )
}

/**
 * PatternFields — full Pattern Lab control surface. Layer carries the pattern
 * params directly; LayerRenderer + build.js call `buildPatternSvg` per render.
 *
 * "Apply saved pattern" picker reads from `library.pattern` (Pattern Lab's
 * save slot) and copies params into the layer. "Save to library" sends the
 * current layer's params back the other way — symmetric with Type Lab.
 * Generate holds the picker + actions; Style the params + rules editor.
 */
function PatternFields({ layer, setProp, updateLayer, palette, renderAnimate, tab }) {
  const { library, savePattern } = useGeneratorLibrary()
  const { flattenPattern }       = useComposeState()
  const { loadPattern }          = usePatternState()
  const navigate                 = useNavigate()
  const patterns = library.pattern ?? []
  const patternOptions = [
    { value: '', label: '— pick spec' },
    ...patterns.map((p, i) => ({ value: p.id, label: `Pattern ${i + 1}` })),
  ]

  const rules = layer.rules ?? []
  const setRules = (next) => updateLayer(layer.id, { rules: next })
  const addRule    = () => setRules([...rules, newRule()])
  const updateRule = (idx, updated) => setRules(rules.map((r, i) => i === idx ? updated : r))
  const removeRule = (idx) => setRules(rules.filter((_, i) => i !== idx))
  const rerollRule = (idx) => setRules(rules.map((r, i) => i === idx ? { ...randomRule(), id: r.id } : r))
  const randomizeRules = () => {
    const count = Math.floor(Math.random() * 3) + 1
    setRules(Array.from({ length: count }, randomRule))
  }

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

  const onSave = () => {
    /* Save shape matches Pattern mode's saver: bg is the canonical source —
     * `null` when off, hex/ref when on. patternFromSpec on load derives
     * `bgOn = spec.bg != null` so we don't store a redundant flag. */
    savePattern({
      shapeId:   layer.shapeId,
      customSvg: layer.customSvg,
      cols:      layer.cols,
      rows:      layer.rows,
      gap:       layer.gap,
      padding:   layer.padding,
      stretch:   layer.stretch,
      overflow:  layer.overflow,
      bg:        layer.bgOn ? layer.bg : null,
      color:     layer.color,
      rules:     layer.rules ?? [],
      scale:     layer.scale,
    })
  }

  const onEditInPatternMode = () => {
    /* Resolve palette refs to literal hex on entry — Pattern mode operates
     * on hex; passing 'palette:secondary' verbatim breaks the renderer. The
     * palette-ref binding on the source layer is intentionally lost (same
     * trade-off as the photoshop-paint adoption — refs only survive while
     * editing inside compose itself). `boundLayerId` opts into round-trip
     * so subsequent edits in Pattern mode flow back to this layer. */
    const resolvedColor = resolveColor(layer.color, palette) ?? layer.color
    const resolvedBg    = layer.bgOn ? (resolveColor(layer.bg, palette) ?? layer.bg) : null
    loadPattern({
      shapeId:   layer.shapeId,
      customSvg: layer.customSvg,
      cols:      layer.cols,
      rows:      layer.rows,
      gap:       layer.gap,
      padding:   layer.padding,
      stretch:   layer.stretch,
      overflow:  layer.overflow,
      color:     resolvedColor,
      bg:        resolvedBg,
      rules:     layer.rules ?? [],
    }, { boundLayerId: layer.id })
    navigate('/editor/pattern')
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

          <div className="grid grid-cols-2 gap-2">
            <EditorButton variant="primary" size="sm" className="w-full" onClick={randomizeRules}>
              Randomize rules
            </EditorButton>
            <EditorButton variant="primary" size="sm" className="w-full" onClick={onSave} title="Save current pattern params to the shared library">
              Save to library
            </EditorButton>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-fg-08">
            <EditorButton variant="secondary" size="sm" className="w-full" onClick={onEditInPatternMode}
              title="Open this layer's params in Pattern mode for richer editing">
              Pattern mode
            </EditorButton>
            <EditorButton variant="secondary" size="sm" className="w-full" onClick={onFlatten}
              title="Flatten the pattern to static SVG shapes (one-way)">
              Flatten
            </EditorButton>
          </div>
        </>
      )}

      {tab === 'style' && (
        <>
          <AutoControls schema={PATTERN_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />

          <LabeledControl label={`Rules · ${rules.length}`}>
            <div className="flex flex-col gap-2">
              {rules.map((rule, i) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onChange={(updated) => updateRule(i, updated)}
                  onRemove={() => removeRule(i)}
                  onReroll={() => rerollRule(i)}
                />
              ))}
              <EditorButton variant="primary" size="sm" iconLeft="plus" onClick={addRule}>
                Add rule
              </EditorButton>
            </div>
          </LabeledControl>
        </>
      )}

      {tab === 'anim' && (
        <AutoControls schema={PATTERN_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
      )}
    </>
  )
}

/**
 * TextFields — full Type Lab typography surface for the selected text layer.
 *
 * Optional "Saved as" picker reads from the shared library's `type` slot
 * (saves from Type Lab). Picking a spec copies its typography fields into
 * the layer (no live link — layer stays self-contained). Picker + actions
 * live in Generate; typography params in Style.
 */
function TextFields({ layer, setProp, updateLayer, palette, renderAnimate, tab }) {
  const { library } = useGeneratorLibrary()
  const { flattenText } = useComposeState()
  const { loadType } = useTypeState()
  const navigate = useNavigate()
  const specs = library.type ?? []

  const onEditInTypeMode = () => {
    /* Resolve palette refs to literal hex on entry (same trade-off as
     * Pattern mode's "Edit in"). `boundLayerId: layer.id` makes the new
     * frame's id match the layer so updateFrame round-trips back. */
    const resolvedColor = resolveColor(layer.color, palette) ?? layer.color
    loadType({
      text:       layer.text,
      width:      layer.width,
      weight:     layer.weight,
      italic:     layer.italic,
      size:       layer.size,
      tracking:   layer.tracking,
      lineHeight: layer.lineHeight,
      case:       layer.case,
      color:      resolvedColor,
      textAlign:  layer.textAlign,
    }, { boundLayerId: layer.id })
    navigate('/editor/type')
  }

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

          <div className="grid grid-cols-2 gap-2">
            <EditorButton variant="secondary" size="sm" className="w-full" onClick={onEditInTypeMode}
              title="Open this layer's spec in Type mode as a new frame">
              Type mode
            </EditorButton>
            <EditorButton variant="secondary" size="sm" className="w-full" onClick={onFlatten}
              title="Flatten the text to glyph-outline shapes (one-way)">
              Flatten
            </EditorButton>
          </div>
        </>
      )}

      {tab === 'style' && (
        <AutoControls schema={TEXT_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="style" />
      )}

      {tab === 'anim' && (
        <AutoControls schema={TEXT_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
      )}
    </>
  )
}
