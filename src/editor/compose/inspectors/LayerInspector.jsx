import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import EditorButton from '../../components/EditorButton'
import { Input } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { Icon } from '@kolkrabbi/kol-loader'
import { useComposeState, resolveColor, COVER_TYPES } from '../state'
import { scalePathNodes } from '../path-math'
import EditorIcon from '../../icons/EditorIcon'
import { useLayerEdit } from '../useLayerEdit'
import { useColorTarget } from '../../color/useColorTarget'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { usePatternState } from '../../modes/pattern/state'
import { useTypeState } from '../../modes/type/state'
import RuleRow, { newRule, randomRule } from '../../modes/pattern/RuleRow'
import { ColorField } from './ColorField'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { SHAPE_SCHEMA } from '../../params/schemas/shape'
import { PATTERN_SCHEMA } from '../../params/schemas/pattern'
import { TEXT_SCHEMA } from '../../params/schemas/text'
import { PHOTO_SCHEMA } from '../../params/schemas/photo'
import { schemaDefaults } from '../../params/schema'
import { GROUPS, loopById, presetsInGroup } from '../../../loops/registry'
import { presetParams } from '../../../loops/registry'
import { FILTERS, filterById } from '../../../filters'
import { themeParams } from '../../../loops/theme'
import { THEME_OPTIONS, DEFAULT_THEME } from '../../../loops/lib/themes'

/**
 * LayerInspector — per-type knobs for the selected layer.
 *
 * Quick toggles (visibility / opacity / blend) live in the rail row's
 * expand panel — this inspector handles the heavier per-type controls
 * (position, color, content, source, etc.).
 */
/* Shape kinds with a primitive vector outline — convertible to a path. */
const PATHABLE_KINDS = ['rect', 'ellipse', 'triangle', 'polygon', 'star', 'line']

export default function LayerInspector({ layer }) {
  const { updateLayer, ungroupLayer, flipLayer, convertShapeToPath, palette } = useComposeState()
  /* Color writes route through useColorTarget so the inspector, the picker,
   * the keymap, and the swatch stack all share one writer. Photoshop model:
   * writes always succeed, app-level paint state is the canonical source. */
  const target = useColorTarget()

  /* `coalesce` collapses slider drags + typed-input flurries into one undo
   * entry per quiet period. Dropdowns/toggles also batch within 250ms but
   * commit cleanly between distinct edits in practice. */
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp

  /* Per-field animate affordance (AutoControls' renderAnimate seam). */
  const renderAnimate = (p) => <BindDot layer={layer} param={p} setProp={setProp} />

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
              {layer.type === 'photo' && (
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

      {layer.type === 'shape' && (
        <>
          <AutoControls schema={SHAPE_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />
          {PATHABLE_KINDS.includes(layer.kind) && (
            <EditorButton
              variant="secondary" size="sm" className="w-full"
              onClick={() => convertShapeToPath(layer.id)}
              title="Convert the shape to an editable bezier path (one-way)"
            >
              Convert to path
            </EditorButton>
          )}
        </>
      )}

      {layer.type === 'text' && (
        <TextFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} renderAnimate={renderAnimate} />
      )}

      {layer.type === 'pattern' && <PatternFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} renderAnimate={renderAnimate} />}
      {layer.type === 'photo' && <ImageFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} renderAnimate={renderAnimate} />}
      {layer.type === 'loop' && <LoopFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} renderAnimate={renderAnimate} />}

      {layer.type === 'group' && (
        <GroupFields layer={layer} ungroupLayer={ungroupLayer} />
      )}
    </div>
  )
}

/**
 * LoopFields — the loop layer's control surface (plan.md Phase 3): category →
 * preset picker (labs Loops page model: 2 groups × N presets), the loop's own
 * declared params auto-rendered (with bind dots — loop knobs are animatable
 * like any layer prop), theme recolour, randomise.
 */
function LoopFields({ layer, setProp, updateLayer, palette, renderAnimate }) {
  const loop = loopById(layer.loopId)
  const group = layer.loopGroup ?? 'shape'
  const presets = presetsInGroup(group)
  const groupOptions = GROUPS.map((g) => ({ value: g.id, label: g.label }))
  /* Flat dropdown; `sub` buckets read as a label prefix (Dropdown has no
   * option groups — revisit if it grows them). */
  const presetOptions = presets.map((p) => ({ value: p.id, label: p.sub ? `${p.sub} · ${p.label}` : p.label }))

  /* Picking a preset resets the loop's params to the preset's full set
   * (labs semantic — a preset is a curated starting point, not a patch). */
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
  const onGroup = (g) => applyPreset(presetsInGroup(g)[0], g)

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
      <LabeledControl label="Category">
        <Dropdown variant="subtle" size="sm" className="w-full" options={groupOptions} value={group} onChange={onGroup} />
      </LabeledControl>
      <LabeledControl label="Preset">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={presetOptions}
          value={layer.presetId}
          onChange={(id) => applyPreset(presets.find((p) => p.id === id))}
        />
      </LabeledControl>

      <AutoControls schema={loop?.params ?? []} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />

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
      </div>

      <EditorButton variant="primary" size="sm" className="w-full" onClick={onRandomise}>
        Randomise
      </EditorButton>
    </>
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

/**
 * PatternFields — full Pattern Lab control surface in compose's inspector
 * (Phase 6f). Layer carries the pattern params directly; LayerRenderer +
 * build.js call `buildPatternSvg` per render.
 *
 * "Apply saved pattern" picker reads from `library.pattern` (Pattern Lab's
 * save slot) and copies params into the layer. "Save to library" sends the
 * current layer's params back the other way — symmetric with Type Lab.
 */
function PatternFields({ layer, setProp, updateLayer, palette, renderAnimate }) {
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

      <AutoControls schema={PATTERN_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />

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
  )
}

function ImageFields({ layer, setProp, updateLayer, palette, renderAnimate }) {
  const fileRef = useRef(null)
  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setProp('src', reader.result)
    reader.readAsDataURL(file)
  }
  const onClear = () => {
    setProp('src', null)
    if (fileRef.current) fileRef.current.value = ''
  }
  /* Filter — image filters (src/filters) rendered on a live canvas. Picking
   * one writes the filter's full param defaults onto the layer (loop preset
   * semantics — a previous filter's stale keys ride along harmlessly). */
  const activeFilter = filterById(layer.filterId)
  const filterOptions = [
    { value: '', label: 'None' },
    ...FILTERS.map((f) => ({ value: f.id, label: f.label })),
  ]
  const onFilter = (id) => {
    if (!id) { setProp('filterId', null); return }
    const f = filterById(id)
    if (!f) return
    updateLayer(layer.id, { filterId: id, ...schemaDefaults(f.params) })
  }
  return (
    <>
      <LabeledControl label="Source">
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
        {layer.src && (
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
        )}
        <div className="flex items-center gap-2">
          <EditorButton
            variant="secondary" size="sm" iconLeft="upload" iconSize={12}
            className="flex-1"
            onClick={() => fileRef.current?.click()}
          >
            {layer.src ? 'Replace' : 'Upload image'}
          </EditorButton>
          {layer.src && (
            <EditorButton
              variant="secondary" size="sm" iconOnly="trash" iconSize={12}
              aria-label="Clear image"
              onClick={onClear}
            />
          )}
        </div>
      </LabeledControl>
      <AutoControls schema={PHOTO_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />
      <LabeledControl label="Filter">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={filterOptions}
          value={layer.filterId ?? ''}
          onChange={onFilter}
        />
      </LabeledControl>
      {activeFilter && layer.imgW != null && (
        <span className="kol-helper-12 text-meta">Filters don't apply to cropped photos.</span>
      )}
      {activeFilter && (
        <AutoControls schema={activeFilter.params} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />
      )}
    </>
  )
}

/**
 * TextFields — full Type Lab typography surface for the selected text layer.
 *
 * Optional "Saved as" picker reads from the shared library's `type` slot
 * (saves from Type Lab). Picking a spec copies its typography fields into
 * the layer (no live link — layer stays self-contained).
 */
function TextFields({ layer, setProp, updateLayer, palette, renderAnimate }) {
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

      <AutoControls schema={TEXT_SCHEMA} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />

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
  )
}

/* One numeric field with its axis letter OUTSIDE the input, to the left. */
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

function AxisField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span
        className="shrink-0 select-none"
        style={{ fontFamily: 'var(--kol-font-family-mono)', fontSize: 10, width: 10, textAlign: 'center', color: 'var(--kol-fg-48)' }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <Input variant="ghost" size="sm" type="number" value={value} onChange={onChange} />
      </div>
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
