import { useState } from 'react'
import EditorButton from '../../components/EditorButton'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { findLayerDeep } from '../helpers'
import { useLayerEdit } from '../useLayerEdit'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { ModulationList } from '../../params/ModulationEditor'
import { deriveScopes, allScopeParams, computeRoll, useRollSeed, SeedField } from '../../params/rolls'
import { motionPresetsFor, axisKeys } from '../../params/motionPresets'
import { lookPresetsFor } from '../../params/lookPresets'
import { paramSection } from '../../params/schema'
import KeyframeEditor from './KeyframeEditor'
import CameraPoseSlots from './CameraPoseSlots'
import RulesEditor from './RulesEditor'
import { OrganicProfileEditor } from './ProfileEditor'
import CurveEditor from './CurveEditor'
import ParatypeTools from './ParatypeTools'
import SoftformsLayers from './SoftformsLayers'
import { SHAPE_SCHEMA } from '../../params/schemas/shape'
import { PATTERN_SCHEMA } from '../../params/schemas/pattern'
import { TEXT_SCHEMA } from '../../params/schemas/text'
import { PHOTO_SCHEMA } from '../../params/schemas/photo'
import { TEXT_TAB_KEYS } from './TextPanel'
import { loopById, loopBgToggleable, resolveCameraKeys } from '../../../loops/registry'
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
const ANIM_HINT = 'Modulate any parameter via its bind dot (Time · LFO · Expression · Audio · MIDI · Joystick …). Pick a source at the dot; its controls appear here.'

/* Text params minus the styling keys the Text tab owns (one home per
 * control) — leaves Content plus any future non-styling params. */
const TEXT_PARAMS_SCHEMA = TEXT_SCHEMA.filter((p) => !TEXT_TAB_KEYS.has(p.key))

export default function ParametersPanel() {
  const { selectedId, layers } = useComposeState()
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {/* Header (title + delete) is shared in SelectionPalettePanel. */}
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
  const shared = { layer, setProp, patch: edit.patch, updateLayer, palette, renderAnimate, tab }
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
        {tab === 'anim' && (
          <>
            <ModulationList layer={layer} schema={SHAPE_SCHEMA} setProp={setProp} />
            <AutoControls schema={SHAPE_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
          </>
        )}
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
        {tab === 'anim' && (
          <>
            <ModulationList layer={layer} schema={PHOTO_SCHEMA} setProp={setProp} />
            <AutoControls schema={PHOTO_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
          </>
        )}
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

/* 'Custom' shows in a motion dropdown only while active, so it never reads
 * as a second pickable 'off' (labs motionOpts). */
const motionOpts = (presets, val) => {
  const opts = presets.map((p) => ({ value: p.id, label: p.label }))
  return (val == null || val === 'custom') ? [{ value: 'custom', label: 'Custom' }, ...opts] : opts
}

/**
 * LoopFields — the loop layer's control surface (plan.md Phase 3): category →
 * preset picker (labs Loops page model, always visible above the sub-tab
 * strip), then Generate (theme/toggles + scoped seeded randomize) · Style ·
 * Animation (motion Frame/Form preset dropdowns + params + camera rail).
 */
function LoopFields({ layer, setProp, patch, updateLayer, palette, renderAnimate, tab, tabStrip, tree }) {
  const loop = loopById(layer.loopId)
  const schema = loop?.params ?? []

  /* Theme — recolour roled color params (bg/fg/accent) via the imported
   * loops theme module. Non-roled params and user edits survive. */
  const themeId = layer.themeId ?? DEFAULT_THEME
  const invert = !!layer.themeInvert
  const onTheme  = (id) => updateLayer(layer.id, { themeId: id, ...themeParams(layer, loop?.params, id, invert) })
  const onInvert = (v)  => updateLayer(layer.id, { themeInvert: v, ...themeParams(layer, loop?.params, themeId, v) })

  /* ── Generate: Look quick-select (labs softforms look recipes) — picking
   * applies the preset patch in one coalesced write; editing any param a
   * look covers flips the dropdown to Custom (motion-preset mechanics). ── */
  const looks = lookPresetsFor(layer.loopId)
  const lookList = looks ? Object.keys(looks).map((name) => ({ id: name, label: name })) : null
  const lookKeys = looks ? new Set(Object.values(looks).flatMap((p) => Object.keys(p))) : null

  /* ── Generate: scoped, seeded rolls (labs LoopsShell Generate model) ──
   * Scope buttons are schema filters (sections + the Colour type-scope);
   * every press = one seeded randomizeSchema roll merged over the layer,
   * one history entry, seed persisted as `_rollSeed`. */
  const seed = useRollSeed(layer)
  const scopes = deriveScopes(schema, layer)
  const tables = motionPresetsFor(layer.loopId, layer)
  const roll = (params, scope) => {
    const rollPatch = computeRoll(layer, params, seed.take(), { stripNoRandom: !!scope?.motion })
    /* A motion roll is by definition hand-off-the-preset — flip the touched
     * axis dropdown(s) to Custom (labs rollMotionFrame/Form). */
    if (tables && scope?.motion) {
      if (scope.id !== 'Form') rollPatch._framePreset = 'custom'
      if (scope.id !== 'Frame') rollPatch._formPreset = 'custom'
    }
    /* Same hand-off rule for the Look dropdown. */
    if (lookKeys && Object.keys(rollPatch).some((k) => lookKeys.has(k))) rollPatch._lookPreset = 'custom'
    updateLayer(layer.id, rollPatch)
  }

  /* ── Animation: Frame/Form quick-select presets (labs ScanlineEditor /
   * PatternControls model). Picking patches only that axis; editing any
   * param an axis covers flips ITS dropdown to Custom. ── */
  const frameKeys = tables ? axisKeys(tables.frame) : null
  const formKeys = tables ? axisKeys(tables.form) : null
  /* One write path for every schema param — flips whichever quick-select
   * dropdowns (motion Frame/Form, Look) cover the edited key to Custom. */
  const setParamProp = (k, v) => {
    const extra = {}
    if (frameKeys?.has(k)) extra._framePreset = 'custom'
    if (formKeys?.has(k)) extra._formPreset = 'custom'
    if (lookKeys?.has(k)) extra._lookPreset = 'custom'
    patch({ [k]: v, ...extra })
  }
  const applyMotionPreset = (axisProp, presets) => (id) => {
    const p = presets.find((x) => x.id === id)
    patch({ [axisProp]: id, ...(p?.params ?? {}) })
  }
  const applyLook = (name) => patch({ _lookPreset: name, ...(looks?.[name] ?? {}) })

  /* Field-loop camera rail — the def's `camera` schema (folded into the
   * layer's defaults by contract.js loopDefaults, read by makeCam at draw)
   * that AutoControls never rendered; labs showed it as the Camera section
   * of the Animation tab (LoopsShell.jsx:378). */
  const cameraSchema = loop?.camera ? loop.camera.map((p) => ({ ...p, section: 'Camera' })) : null

  /* Camera pose slots + reset (labs CameraPanel) — a pose is the layer's
   * camera param values: the def's camera rail plus any schema params
   * sectioned 'Camera' (scene3d fov/orbit, softforms3d θ/φ/dist, ribbon…). */
  const camParams = [...(loop?.camera ?? []), ...schema.filter((p) => paramSection(p) === 'Camera')]
  const isEngine = loop?.kind === 'engine'
  const showCamSlots = camParams.length > 0 || (isEngine && loop?.orbit)

  /* 3D-scene keyframe track (primitiveKeyframes sampler) — reachable once
   * the layer's animMode param is flipped to keyframes. */
  const showKeyframes = loop?.engine === 'scene'
    && (layer.animMode === 'keyframes' || layer.animMode === 'keyframe')

  return (
    <>
      <LoopPicker layer={layer} tree={tree} />

      {tabStrip}

      {tab === 'generate' && (
        <>
          {/* Soft Forms per-form scene editing (labs Layers tab) — the
              primary control surface, above Look/Theme. */}
          {(layer.loopId === 'softforms' || layer.loopId === 'softforms3d') && <SoftformsLayers layer={layer} />}
          {looks && (
            <LabeledControl label="Look">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={motionOpts(lookList, layer._lookPreset)}
                value={layer._lookPreset ?? 'custom'}
                onChange={applyLook}
              />
            </LabeledControl>
          )}
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
            {/* Camera is driven by the Orbit tool (C) — a viewport mode, not a
                per-layer toggle, so it never fights layer dragging. 3D loops
                orbit; field/pattern loops rotate + zoom; shape loops zoom. */}
            {(() => {
              const ck = loop?.orbit ? { yaw: 1, dist: 1 } : resolveCameraKeys(loop)
              if (!ck) return null
              const verb = loop?.orbit ? 'drag to orbit, scroll to zoom'
                : ck.yaw ? 'drag to rotate, scroll to zoom'
                : 'scroll to zoom'
              return (
                <p className="kol-helper-11 text-meta col-span-2">
                  Press C (Orbit tool) to move the camera — {verb}.
                </p>
              )
            })()}
          </div>

          {/* Schema params flagged tab:'generate' (penrose shape/glyph/font/
              weight/seed) — pickers above the randomize block, labs order. */}
          <AutoControls schema={schema} layer={layer} setProp={setParamProp} palette={palette} renderAnimate={renderAnimate} tab="generate" />

          <EditorButton variant="primary" size="sm" className="w-full" onClick={() => roll(allScopeParams(schema, layer))}>
            Randomize all
          </EditorButton>
          {scopes.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {scopes.map((s) => (
                <EditorButton key={s.id} variant="primary" size="sm" onClick={() => roll(s.params, s)}>
                  {s.label}
                </EditorButton>
              ))}
            </div>
          )}
          <SeedField seed={seed} />
          {/* Pattern-rules tiles: the rule-stack editor (labs Rules section) —
              seeded rolls share the SeedField above. */}
          {layer.loopId === 'pattern-rules' && (layer.render ?? 'tiles') === 'tiles' && (
            <RulesEditor layer={layer} patch={patch} seed={seed} />
          )}
        </>
      )}

      {tab === 'style' && (
        <>
          <AutoControls schema={schema} layer={layer} setProp={setParamProp} palette={palette} renderAnimate={renderAnimate} tab="style" />
          {/* Organic field, Edge profile = Custom: the draggable bezier curve
              (self-gates on render/field/waveProfile). */}
          {layer.loopId === 'pattern-rules' && <OrganicProfileEditor layer={layer} patch={patch} />}
          {/* Math curves: kind/epicycle-term authoring (forks stock clips). */}
          {layer.loopId === 'math-curves' && <CurveEditor layer={layer} patch={patch} />}
        </>
      )}

      {tab === 'anim' && (
        <>
          {tables && (
            <>
              <span className="kol-helper-10 text-meta">Motion</span>
              <LabeledControl label="Frame">
                <Dropdown
                  variant="subtle" size="sm" className="w-full"
                  options={motionOpts(tables.frame, layer._framePreset)}
                  value={layer._framePreset ?? 'custom'}
                  onChange={applyMotionPreset('_framePreset', tables.frame)}
                />
              </LabeledControl>
              <LabeledControl label="Form">
                <Dropdown
                  variant="subtle" size="sm" className="w-full"
                  options={motionOpts(tables.form, layer._formPreset)}
                  value={layer._formPreset ?? 'custom'}
                  onChange={applyMotionPreset('_formPreset', tables.form)}
                />
              </LabeledControl>
            </>
          )}
          <ModulationList layer={layer} schema={schema} setProp={setParamProp} />
          <AutoControls schema={schema} layer={layer} setProp={setParamProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
          {showKeyframes && (
            <KeyframeEditor layer={layer} patch={patch} defaultDuration={loop?.duration ?? 8} />
          )}
          {cameraSchema && (
            <AutoControls schema={cameraSchema} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />
          )}
          {showCamSlots && (
            <CameraPoseSlots layer={layer} patch={patch} camParams={camParams} isEngine={isEngine} showHeader={!cameraSchema} />
          )}
        </>
      )}
      {/* Para-Type misc layer: flatten-to-vector (Generate) + XY explore
          pad (Style) — self-gates on loopId + tab. */}
      <ParatypeTools layer={layer} patch={patch} tab={tab} />
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
      scale:     spec.scale     ?? layer.scale,
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
        <>
          <ModulationList layer={layer} schema={PATTERN_SCHEMA} setProp={setProp} />
          <AutoControls schema={PATTERN_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
        </>
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
        <>
          <ModulationList layer={layer} schema={TEXT_SCHEMA} setProp={setProp} />
          <AutoControls schema={TEXT_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
        </>
      )}
    </>
  )
}
