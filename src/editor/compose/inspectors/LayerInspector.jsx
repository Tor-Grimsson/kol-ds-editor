import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EditorButton from '../../components/EditorButton'
import { ColorSwatch } from '@kolkrabbi/kol-component'
import { Input } from '@kolkrabbi/kol-component'
import { Slider } from '@kolkrabbi/kol-component'
import { Textarea } from '@kolkrabbi/kol-component'
import { Dropdown, PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
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
import { WIDTHS, WEIGHTS, CASES } from '../../modes/type/cuts'
import { SHAPE_OPTIONS } from '../../modes/pattern/shapes'
import RuleRow, { newRule, randomRule } from '../../modes/pattern/RuleRow'

const FIT_OPTIONS = [
  { value: 'cover',    label: 'Cover' },
  { value: 'contain',  label: 'Contain' },
  { value: 'fill',     label: 'Fill' },
]

const PALETTE_REFS = [
  { value: 'palette:primary',   label: 'Primary' },
  { value: 'palette:secondary', label: 'Secondary' },
  { value: 'palette:light',     label: 'Light' },
  { value: 'palette:dark',      label: 'Dark' },
  { value: 'palette:accent',    label: 'Accent' },
  { value: 'palette:bg',        label: 'Background' },
]

const SHAPE_LOGO_VARIANTS = [
  { value: 'logomark',    label: 'Logomark' },
  { value: 'wordmark',    label: 'Wordmark' },
  { value: 'lockup-hori', label: 'Lockup · horizontal' },
  { value: 'lockup-vert', label: 'Lockup · vertical' },
]

const SHAPE_FIT_OPTIONS = [
  { value: 'fill',    label: 'Stretch (fill)' },
  { value: 'contain', label: 'Aspect (contain)' },
]

const SHAPE_KIND_OPTIONS = [
  { value: 'logo',     label: 'Logo'      },
  { value: 'rect',     label: 'Rectangle' },
  { value: 'ellipse',  label: 'Ellipse'   },
  { value: 'triangle', label: 'Triangle'  },
  { value: 'line',     label: 'Line'      },
  { value: 'polygon',  label: 'Polygon'   },
  { value: 'star',     label: 'Star'      },
  { value: 'flatten',  label: 'Flatten'   },
]

const WIDTH_OPTIONS  = WIDTHS.map((w)  => ({ value: w.id,  label: w.label }))
const WEIGHT_OPTIONS = WEIGHTS.map((w) => ({ value: w.id,  label: w.label }))
const CASE_OPTIONS   = CASES.map((c)   => ({ value: c.id,  label: c.label }))
const ALIGN_OPTIONS  = [
  { value: 'left',   label: 'Left'   },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right'  },
]

/**
 * LayerInspector — per-type knobs for the selected layer.
 *
 * Quick toggles (visibility / opacity / blend) live in the rail row's
 * expand panel — this inspector handles the heavier per-type controls
 * (position, color, content, source, etc.).
 */
export default function LayerInspector({ layer }) {
  const { updateLayer, ungroupLayer, flipLayer, palette } = useComposeState()
  /* Color writes route through useColorTarget so the inspector, the picker,
   * the keymap, and the swatch stack all share one writer. Photoshop model:
   * writes always succeed, app-level paint state is the canonical source. */
  const target = useColorTarget()

  /* `coalesce` collapses slider drags + typed-input flurries into one undo
   * entry per quiet period. Dropdowns/toggles also batch within 250ms but
   * commit cleanly between distinct edits in practice. */
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
              value={Math.round(layer.rotation ?? 0)}
              onChange={(e) => {
                const n = Number(e.target.value)
                setProp('rotation', Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 0)
              }}
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

      {layer.type === 'shape' && (
        <LabeledControl label="Kind">
          <Dropdown
            variant="subtle"
            size="sm"
            className="w-full"
            options={SHAPE_KIND_OPTIONS}
            value={layer.kind ?? 'logo'}
            onChange={(v) => setProp('kind', v)}
          />
        </LabeledControl>
      )}

      {layer.type === 'shape' && (layer.kind ?? 'logo') === 'logo' && (
        <LabeledControl label="Variant">
          <Dropdown variant="subtle" size="sm" className="w-full" options={SHAPE_LOGO_VARIANTS} value={layer.variant} onChange={(v) => setProp('variant', v)} />
        </LabeledControl>
      )}

      {layer.type === 'shape' && layer.kind === 'flatten' && (
        <LabeledControl label="Fit">
          <ViewToggle
            options={SHAPE_FIT_OPTIONS}
            viewMode={layer.fit ?? 'fill'}
            onViewChange={(v) => setProp('fit', v)}
          />
        </LabeledControl>
      )}

      {layer.type === 'shape' && layer.kind === 'polygon' && (
        <LabeledControl label="Sides">
          <Slider
            min={3} max={12} step={1}
            value={layer.sides ?? 5}
            formatValue={(v) => `${v}`}
            onChange={(v) => setProp('sides', v)}
          />
        </LabeledControl>
      )}

      {layer.type === 'shape' && layer.kind === 'star' && (
        <>
          <LabeledControl label="Points">
            <Slider
              min={3} max={12} step={1}
              value={layer.points ?? 5}
              formatValue={(v) => `${v}`}
              onChange={(v) => setProp('points', v)}
            />
          </LabeledControl>
          <LabeledControl label="Inner ratio">
            <Slider
              min={0.2} max={0.9} step={0.05}
              value={layer.innerRatio ?? 0.5}
              formatValue={(v) => v.toFixed(2)}
              onChange={(v) => setProp('innerRatio', v)}
            />
          </LabeledControl>
        </>
      )}

      {layer.type === 'shape' && layer.kind === 'line' && (
        <LabeledControl label="Slope">
          <ViewToggle
            options={[
              { value: '\\', label: '↘' },
              { value: '/',  label: '↗' },
            ]}
            viewMode={layer.slope ?? '\\'}
            onViewChange={(v) => setProp('slope', v)}
          />
        </LabeledControl>
      )}

      {layer.type === 'text' && (
        <TextFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} />
      )}

      {layer.type === 'pattern' && <PatternFields layer={layer} setProp={setProp} updateLayer={updateLayer} palette={palette} />}
      {layer.type === 'photo' && <ImageFields layer={layer} setProp={setProp} />}

      {layer.type === 'group' && (
        <GroupFields layer={layer} ungroupLayer={ungroupLayer} />
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

/**
 * PatternFields — full Pattern Lab control surface in compose's inspector
 * (Phase 6f). Layer carries the pattern params directly; LayerRenderer +
 * build.js call `buildPatternSvg` per render.
 *
 * "Apply saved pattern" picker reads from `library.pattern` (Pattern Lab's
 * save slot) and copies params into the layer. "Save to library" sends the
 * current layer's params back the other way — symmetric with Type Lab.
 */
function PatternFields({ layer, setProp, updateLayer, palette }) {
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

      <LabeledControl label="Shape">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={SHAPE_OPTIONS}
          value={layer.shapeId}
          onChange={(v) => setProp('shapeId', v)}
        />
      </LabeledControl>

      {layer.shapeId === 'custom' && (
        <LabeledControl label="Custom SVG">
          <Textarea
            variant="ghost" size="sm" rows={3}
            value={layer.customSvg ?? ''}
            onChange={(e) => setProp('customSvg', e.target.value)}
            placeholder='<svg viewBox="0 0 24 24">…</svg>'
          />
        </LabeledControl>
      )}

      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Cols" hint={`${layer.cols}`}>
          <Slider min={1} max={32} value={layer.cols} onChange={(v) => setProp('cols', v)} />
        </LabeledControl>
        <LabeledControl label="Rows" hint={`${layer.rows}`}>
          <Slider min={1} max={32} value={layer.rows} onChange={(v) => setProp('rows', v)} />
        </LabeledControl>
      </div>

      <LabeledControl label="Gap" hint={`${layer.gap}px`}>
        <Slider min={-64} max={64} value={layer.gap} onChange={(v) => setProp('gap', v)} />
      </LabeledControl>

      <LabeledControl label="Padding" hint={`${layer.padding}px`}>
        <Slider min={-128} max={128} value={layer.padding} onChange={(v) => setProp('padding', v)} />
      </LabeledControl>

      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Stretch">
          <ViewToggle
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={layer.stretch ? 'on' : 'off'}
            onViewChange={(v) => setProp('stretch', v === 'on')}
          />
        </LabeledControl>
        <LabeledControl label="Overflow">
          <ViewToggle
            options={[{ value: 'clip', label: 'Clip' }, { value: 'visible', label: 'Visible' }]}
            viewMode={layer.overflow ? 'visible' : 'clip'}
            onViewChange={(v) => setProp('overflow', v === 'visible')}
          />
        </LabeledControl>
      </div>

      <LabeledControl label="Tile bg">
        <ViewToggle
          options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
          viewMode={layer.bgOn ? 'on' : 'off'}
          onViewChange={(v) => setProp('bgOn', v === 'on')}
        />
      </LabeledControl>

      {layer.bgOn && (
        <ColorField label="Tile bg color" value={layer.bg} onChange={(v) => setProp('bg', v)} palette={palette} />
      )}

      <LabeledControl label="Tile size" hint={`${layer.scale}px`}>
        <Slider min={64} max={1024} step={16} value={layer.scale} onChange={(v) => setProp('scale', v)} />
      </LabeledControl>

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

function ImageFields({ layer, setProp }) {
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
      <LabeledControl label="Fit">
        <Dropdown variant="subtle" size="sm" className="w-full" options={FIT_OPTIONS} value={layer.fit ?? 'cover'} onChange={(v) => setProp('fit', v)} />
      </LabeledControl>
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
function TextFields({ layer, setProp, updateLayer, palette }) {
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

      <LabeledControl label="Content">
        <Textarea
          variant="ghost"
          size="sm"
          rows={2}
          value={layer.text ?? ''}
          onChange={(e) => setProp('text', e.target.value)}
        />
      </LabeledControl>

      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Cut">
          <Dropdown variant="subtle" size="sm" className="w-full" options={WIDTH_OPTIONS} value={layer.width ?? 'Tight'} onChange={(v) => setProp('width', v)} />
        </LabeledControl>
        <LabeledControl label="Weight">
          <Dropdown variant="subtle" size="sm" className="w-full" options={WEIGHT_OPTIONS} value={layer.weight ?? 600} onChange={(v) => setProp('weight', Number(v))} />
        </LabeledControl>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Case">
          <Dropdown variant="subtle" size="sm" className="w-full" options={CASE_OPTIONS} value={layer.case ?? 'original'} onChange={(v) => setProp('case', v)} />
        </LabeledControl>
        <LabeledControl label="Align">
          <Dropdown variant="subtle" size="sm" className="w-full" options={ALIGN_OPTIONS} value={layer.textAlign ?? 'center'} onChange={(v) => setProp('textAlign', v)} />
        </LabeledControl>
      </div>

      <LabeledControl label="Italic">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
          value={layer.italic ? 'on' : 'off'}
          onChange={(v) => setProp('italic', v === 'on')}
        />
      </LabeledControl>

      <LabeledControl label="Size" hint={`${layer.size}px`}>
        <Slider min={12} max={400} step={1} value={layer.size} onChange={(v) => setProp('size', v)} />
      </LabeledControl>
      <LabeledControl label="Tracking" hint={`${(layer.tracking ?? 0).toFixed(3)}em`}>
        <Slider min={-0.05} max={0.2} step={0.005} value={layer.tracking ?? 0} onChange={(v) => setProp('tracking', v)} />
      </LabeledControl>
      <LabeledControl label="Leading" hint={(layer.lineHeight ?? 1).toFixed(2)}>
        <Slider min={0.85} max={2.0} step={0.05} value={layer.lineHeight ?? 1.05} onChange={(v) => setProp('lineHeight', v)} />
      </LabeledControl>

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

/**
 * ColorField — swatch button + inline hex input. The swatch shows the
 * resolved color; the hex input lets the user type a literal hex without
 * opening anything. Click the swatch to open a popover with the palette-ref
 * grid (Primary / Secondary / Light / Dark / Accent). Drives both the
 * inspector and (via the same target) the always-mounted ColorModal.
 */
export function ColorField({ value, onChange, palette, label = 'Color', hideLabel = false }) {
  const isPaletteRef = typeof value === 'string' && value.startsWith('palette:')
  const isNone       = value == null
  const resolved     = resolveColor(value, palette) ?? '#FFFFFF'
  const subtitle     = isNone
    ? 'None'
    : isPaletteRef
      ? (PALETTE_REFS.find((r) => r.value === value)?.label ?? value)
      : resolved.toUpperCase()
  const isStroke     = label === 'Stroke'

  const [open, setOpen] = useState(false)
  const popover = usePopover({ open, onOpenChange: setOpen, placement: 'bottom-start', offset: 4 })

  return (
    <LabeledControl label={hideLabel ? null : label}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={popover.refs.setReference}
          {...popover.getReferenceProps()}
          aria-label={`${label}: ${subtitle}`}
          className="inline-flex items-center shrink-0"
        >
          <ColorSwatch
            hex={resolved}
            size={32}
            showTransparent={isNone}
            transparentTone={isStroke ? 'error' : 'warning'}
            hoverable={false}
          />
        </button>
        <Input
          variant="ghost"
          size="sm"
          prefix="#"
          chars={6}
          uppercase
          value={resolved.replace(/^#/, '').toUpperCase()}
          onChange={(e) => onChange('#' + e.target.value.replace(/^#/, '').toUpperCase())}
        />
      </div>
      <PopoverPanel
        popover={popover}
        panel={false}
        focus={false}
        className="bg-surface-secondary border border-fg-08 rounded p-2 flex flex-col gap-2 shadow-lg"
        style={{ minWidth: 200 }}
      >
        <div className="grid grid-cols-6 gap-1">
          {PALETTE_REFS.map((ref) => (
            <ColorSwatch
              key={ref.value}
              hex={resolveColor(ref.value, palette) ?? '#000000'}
              size="fill"
              selected={value === ref.value}
              title={ref.label}
              onClick={() => { onChange(ref.value); setOpen(false) }}
            />
          ))}
        </div>
      </PopoverPanel>
    </LabeledControl>
  )
}
