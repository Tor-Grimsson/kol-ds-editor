import { useRef, useState } from 'react'
import EditorButton from '../../components/EditorButton'
import MediaPicker from '../../library/MediaPicker'
import { proxied, isVideoType } from '../../library/mediaLibrary'
import { Input } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { Slider } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { Icon } from '@kolkrabbi/kol-loader'
import { useComposeState, COVER_TYPES } from '../state'
import { scalePathNodes } from '../path-math'
import EditorIcon from '../../icons/EditorIcon'
import { useLayerEdit } from '../useLayerEdit'
import { useColorTarget } from '../../color/useColorTarget'
import { ColorField } from './ColorField'
import BindDot from '../../params/BindDot'
import { BLEND_MODES } from '../LayerStack'
import { filterById } from '../../../filters'
import { GROUPS, loopById, loopBgToggleable, presetsInGroup, presetParams } from '../../../loops/registry'

/**
 * LayerInspector — HIGH-LEVEL surface for the selected layer (Phase 6-A):
 * position / transform / opacity / blend / paint / content source. Anything
 * schema-driven or type-deep (shape kinds, typography, pattern surface,
 * photo filters, loop controls) lives in the Parameters tab
 * (ParametersPanel); the pointer rows below flip to it via `kol:open-params`
 * (SelectionPalettePanel listens).
 */
export default function LayerInspector({ layer }) {
  const { ungroupLayer, flipLayer, palette } = useComposeState()
  /* Color writes route through useColorTarget so the inspector, the picker,
   * the keymap, and the swatch stack all share one writer. Photoshop model:
   * writes always succeed, app-level paint state is the canonical source. */
  const target = useColorTarget()

  /* `coalesce` collapses slider drags + typed-input flurries into one undo
   * entry per quiet period. */
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp

  return (
    <div className="flex flex-col gap-4">
      {!COVER_TYPES.includes(layer.type) && (
        <PositionFields layer={layer} setProp={setProp} patch={edit.patch} />
      )}

      {!COVER_TYPES.includes(layer.type) && (
        <LabeledControl label="Rotate / flip">
          <div className="flex items-center gap-2">
            <AxisField
              label="R"
              value={typeof layer.rotation === 'number' ? Math.round(layer.rotation) : 0}
              onChange={(e) => {
                const n = Number(e.target.value)
                setProp('rotation', Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 0)
              }}
            />
            <BindDot
              layer={layer}
              param={{ key: 'rotation', label: 'Rotation', type: 'range', min: 0, max: 360, default: 0 }}
              setProp={setProp}
            />
            <div className="flex items-center gap-1 shrink-0">
              <FlipButton axis="h" layer={layer} flipLayer={flipLayer} />
              <FlipButton axis="v" layer={layer} flipLayer={flipLayer} />
              {layer.type === 'photo' && layer.srcType !== 'video' && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('kol:enter-crop', { detail: layer.id }))}
                  title="Crop image (or double-click the photo)"
                  className="inline-flex items-center justify-center w-6 h-6 rounded shrink-0"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--kol-fg-48)' }}
                >
                  <EditorIcon name="crop" size={14} />
                </button>
              )}
            </div>
          </div>
        </LabeledControl>
      )}

      {/* Opacity + blend — the layer-stack expand panel's quick toggles,
        * promoted to the inspector. Value renders as % in the slider's own
        * readout (a LabeledControl hint sat flush against the label). */}
      <LabeledControl label="Opacity">
        <Slider
          min={0} max={1} step={0.01}
          value={layer.opacity ?? 1}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setProp('opacity', v)}
        />
      </LabeledControl>
      <LabeledControl label="Blend">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={BLEND_MODES}
          value={layer.blend ?? 'normal'}
          onChange={(v) => setProp('blend', v)}
        />
      </LabeledControl>

      {/* Loop pickers + backdrop — surfaced here per review (also in
        * Parameters); bg toggle hidden for loops whose bg feeds their
        * color math. */}
      {layer.type === 'loop' && <LoopPickerRows layer={layer} />}
      {layer.type === 'loop' && loopBgToggleable(loopById(layer.loopId)) && (
        <LabeledControl label="Background">
          <ViewToggle
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={layer.bgOn === false ? 'off' : 'on'}
            onViewChange={(v) => setProp('bgOn', v === 'on')}
          />
        </LabeledControl>
      )}

      {/* Both Fill and Stroke render together for any color layer — no
        * conditional hide. Stroke writes always succeed via target.setStroke
        * (Photoshop model); whether the renderer paints stroke is a separate
        * concern (currently rect/ellipse only). */}
      {(layer.type === 'background' || layer.type === 'pattern' || layer.type === 'shape' || layer.type === 'text' || layer.type === 'path') && (
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Fill"   value={layer.color}          onChange={target.setFill}   palette={palette} />
          <ColorField label="Stroke" value={layer.stroke ?? null} onChange={target.setStroke} palette={palette} />
        </div>
      )}

      {/* Open ↔ closed toggle for paths — renderer + export honor `closed`
        * via pathD; in node-edit, clicking the first anchor also closes. */}
      {layer.type === 'path' && (
        <LabeledControl label="Path">
          <ViewToggle
            options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]}
            viewMode={layer.closed ? 'closed' : 'open'}
            onViewChange={(v) => setProp('closed', v === 'closed')}
          />
        </LabeledControl>
      )}

      {/* Content source for photos stays here (it's what the layer IS);
        * fit + filters moved to Parameters. */}
      {layer.type === 'photo' && <ImageSource layer={layer} patch={edit.patch} />}

      <ParamsLink layer={layer} />

      {layer.type === 'group' && (
        <GroupFields layer={layer} ungroupLayer={ungroupLayer} />
      )}
    </div>
  )
}

/* Loop Category + Preset pickers, surfaced in the Inspector (review r3 —
 * the deep params stay in Parameters, but switching what plays shouldn't
 * need a tab flip). Same preset semantics as LoopFields: picking one
 * resets the loop's params to the preset's full set. */
function LoopPickerRows({ layer }) {
  const { updateLayer } = useComposeState()
  const group = layer.loopGroup ?? 'shape'
  const presets = presetsInGroup(group)
  const applyPreset = (preset, g = group) => {
    if (!preset) return
    updateLayer(layer.id, {
      loopGroup:   g,
      presetId:    preset.id,
      presetLabel: preset.label,
      loopId:      preset.loop,
      ...presetParams(preset),
    })
  }
  return (
    <>
      <LabeledControl label="Category">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={GROUPS.map((g) => ({ value: g.id, label: g.label }))}
          value={group}
          onChange={(g) => applyPreset(presetsInGroup(g)[0], g)}
        />
      </LabeledControl>
      <LabeledControl label="Preset">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={presets.map((p) => ({ value: p.id, label: p.sub ? `${p.sub} · ${p.label}` : p.label }))}
          value={layer.presetId}
          onChange={(id) => applyPreset(presets.find((p) => p.id === id))}
        />
      </LabeledControl>
    </>
  )
}

/* Pointer rows → the Parameters / Effects tabs (SelectionPalettePanel
 * listens). One row for the type's own parameters, one for its effect
 * (Phase 7 — every positioned layer can host one; the photo row IS the
 * effect row). */
const PARAMS_LABELS = {
  shape:   () => 'Shape parameters',
  text:    () => 'Text parameters',
  pattern: () => 'Pattern parameters',
  loop:    (l) => `Loop · ${l.presetLabel ?? 'parameters'}`,
  kinetic: (l) => `Kinetic · ${l.presetLabel ?? 'parameters'}`,
}
const EFFECTABLE = new Set(['shape', 'text', 'pattern', 'path', 'loop', 'photo'])

function ParamsLink({ layer }) {
  const openParams  = () => window.dispatchEvent(new CustomEvent('kol:open-params'))
  const openEffects = () => window.dispatchEvent(new CustomEvent('kol:open-effects'))
  const labelFor = PARAMS_LABELS[layer.type]
  /* Engine (GL) loops can't host effects yet (no GL source path) — showing
   * the row would open Parameters onto nothing (review r3). */
  const engineLoop = layer.type === 'loop' && loopById(layer.loopId)?.kind === 'engine'
  const fx = EFFECTABLE.has(layer.type) ? filterById(layer.filterId) : null
  const showEffect = EFFECTABLE.has(layer.type) && !engineLoop
  if (!labelFor && !showEffect) return null
  return (
    <div className="flex flex-col gap-2">
      {labelFor && (
        <EditorButton
          variant="secondary" size="sm" className="w-full"
          onClick={openParams}
          title="Open the Parameters tab"
        >
          {labelFor(layer)}
        </EditorButton>
      )}
      {showEffect && (
        <EditorButton
          variant="secondary" size="sm" className="w-full"
          onClick={openEffects}
          title="Open the Effects tab"
        >
          {fx ? `Effect · ${fx.label}` : 'Add effect'}
        </EditorButton>
      )}
    </div>
  )
}

function GroupFields({ layer, ungroupLayer }) {
  const childCount = Array.isArray(layer.children) ? layer.children.length : 0
  return (
    <>
      <LabeledControl label="Children">
        <span className="kol-helper-12 text-meta">{childCount} layer{childCount === 1 ? '' : 's'}</span>
      </LabeledControl>
      <EditorButton
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => ungroupLayer(layer.id)}
      >
        Ungroup
      </EditorButton>
    </>
  )
}

/* Photo content source — upload / library pick / preview / clear. Every
 * write sets srcType so image ↔ video swaps render correctly (library picks
 * can be videos; the URL is proxied same-origin so filters don't taint). */
function ImageSource({ layer, patch }) {
  const fileRef = useRef(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => patch({ src: reader.result, srcType: 'image' })
    reader.readAsDataURL(file)
  }
  const onLibraryPick = (url, { contentType } = {}) => {
    patch({ src: proxied(url), srcType: isVideoType(contentType) ? 'video' : 'image' })
  }
  const onClear = () => {
    patch({ src: null, srcType: 'image' })
    if (fileRef.current) fileRef.current.value = ''
  }
  return (
    <LabeledControl label="Source">
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      {layer.src && (
        layer.srcType === 'video' ? (
          <video
            src={layer.src}
            muted
            preload="metadata"
            className="rounded overflow-hidden border border-fg-08 mb-2 w-full"
            style={{ aspectRatio: '16 / 9', objectFit: layer.fit ?? 'cover' }}
            aria-label="Video preview"
          />
        ) : (
          <div
            className="rounded overflow-hidden border border-fg-08 mb-2"
            style={{
              aspectRatio: '16 / 9',
              backgroundImage: `url("${layer.src}")`,
              backgroundSize: layer.fit ?? 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
            aria-label="Image preview"
          />
        )
      )}
      <div className="flex items-center gap-2">
        <EditorButton
          variant="secondary" size="sm" iconLeft="upload" iconSize={12}
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          {layer.src ? 'Replace' : 'Upload image'}
        </EditorButton>
        <EditorButton
          variant="secondary" size="sm"
          className="flex-1"
          onClick={() => setPickerOpen(true)}
        >
          Library
        </EditorButton>
        {layer.src && (
          <EditorButton
            variant="secondary" size="sm" iconOnly="trash" iconSize={12}
            aria-label="Clear image"
            onClick={onClear}
          />
        )}
      </div>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={onLibraryPick} />
    </LabeledControl>
  )
}

/* Flip action button — mirrors the selected layer about its own center.
 * Paths bake the mirror into node geometry; other layers toggle flipX/Y
 * (state.flipLayer decides). Flag layers show an active tint when flipped. */
function FlipButton({ axis, layer, flipLayer }) {
  const active = axis === 'h' ? !!layer.flipX : !!layer.flipY
  return (
    <button
      type="button"
      onClick={() => flipLayer(layer.id, axis)}
      title={axis === 'h' ? 'Flip horizontal (⇧H)' : 'Flip vertical (⇧V)'}
      className="inline-flex items-center justify-center w-6 h-6 rounded shrink-0"
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: active ? 'var(--kol-accent-primary)' : 'var(--kol-fg-48)',
      }}
    >
      <EditorIcon name={axis === 'h' ? 'flip-h' : 'flip-v'} size={14} />
    </button>
  )
}

/* One numeric field with its axis letter OUTSIDE the input, to the left.
 * `chars` makes the inner input hug a fixed width (the shell never grows on
 * focus — the old ghost/flex-1 combo let a focused input stretch past the
 * rail and force horizontal scroll; review item 7). Filled variant matches
 * the stroke panel's Weight field. */
function AxisField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span
        className="shrink-0 select-none"
        style={{ fontFamily: 'var(--kol-font-family-mono)', fontSize: 10, width: 10, textAlign: 'center', color: 'var(--kol-fg-48)' }}
      >
        {label}
      </span>
      <Input variant="filled" size="sm" type="number" chars={5} value={value} onChange={onChange} />
    </div>
  )
}

function PositionFields({ layer, setProp, patch }) {
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n) : 0
  }
  /* Lock state lives on the layer (not local) so canvas drag handlers can
   * read it too. Encoded as a single number-or-null: a finite number is
   * the locked aspect ratio; null/undefined means unlocked. */
  const aspect = Number.isFinite(layer.aspectLocked) && layer.aspectLocked > 0
    ? layer.aspectLocked
    : null
  const aspectLocked = aspect !== null
  const toggleLock = () => {
    if (aspectLocked) {
      setProp('aspectLocked', null)
    } else if (layer.h > 0) {
      setProp('aspectLocked', layer.w / layer.h)
    }
  }
  /* Path layers draw their nodes at 1:1 — a bare {w,h} write would move the
   * wireframe without touching the geometry. Scale the nodes with the box so
   * the render tracks the typed size. */
  const isPath = layer.type === 'path' && Array.isArray(layer.nodes)
  const withPathScale = (p) => {
    if (!isPath) return p
    const sx = p.w != null ? p.w / Math.max(1, layer.w) : 1
    const sy = p.h != null ? p.h / Math.max(1, layer.h) : 1
    return {
      ...p,
      nodes: scalePathNodes(layer.nodes, sx, sy),
      ...(layer.holes?.length ? { holes: layer.holes.map((r) => scalePathNodes(r, sx, sy)) } : {}),
    }
  }
  const onChangeW = (e) => {
    const w = Math.max(8, num(e.target.value))
    if (aspectLocked) {
      patch(withPathScale({ w, h: Math.max(8, Math.round(w / aspect)) }))
    } else if (isPath) {
      patch(withPathScale({ w }))
    } else {
      setProp('w', w)
    }
  }
  const onChangeH = (e) => {
    const h = Math.max(8, num(e.target.value))
    if (aspectLocked) {
      patch(withPathScale({ w: Math.max(8, Math.round(h * aspect)), h }))
    } else if (isPath) {
      patch(withPathScale({ h }))
    } else {
      setProp('h', h)
    }
  }
  return (
    <LabeledControl label="Position">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AxisField label="X" value={Math.round(layer.x)} onChange={(e) => setProp('x', num(e.target.value))} />
          <AxisField label="Y" value={Math.round(layer.y)} onChange={(e) => setProp('y', num(e.target.value))} />
          {/* spacer matching the lock button below so both rows' inputs align */}
          <span className="w-5 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2">
          <AxisField label="W" value={Math.round(layer.w)} onChange={onChangeW} />
          <AxisField label="H" value={Math.round(layer.h)} onChange={onChangeH} />
          <button
            type="button"
            onClick={toggleLock}
            aria-pressed={aspectLocked}
            title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: aspectLocked ? 'var(--kol-accent-primary)' : 'var(--kol-fg-48)',
            }}
          >
            <Icon name={aspectLocked ? 'lock' : 'unlock'} size={12} />
          </button>
        </div>
      </div>
    </LabeledControl>
  )
}

/* ColorField extracted to ./ColorField; re-exported (imported at top) so
 * existing importers (CanvasInspector, TypeControls, pattern/ColorPicker)
 * keep working. */
export { ColorField }
