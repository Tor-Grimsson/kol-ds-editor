import { Dropdown, LabeledControl, Slider, ViewToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import BindDot from '../../params/BindDot'
import { isBinding } from '../../params/resolve'
import { TEXT_SCHEMA } from '../../params/schemas/text'
import { WIDTHS, WEIGHTS, CASES } from '../../modes/type/cuts'
import { useComposeState, resolveColor } from '../state'
import { findLayerDeep } from '../helpers'
import { useLayerEdit } from '../useLayerEdit'
import { useGeneratorLibrary } from '../../library/LibraryProvider'

/**
 * TextPanel — the Text tab of the right rail (selection-driven: the tab only
 * shows for text layers). The Type mode typography surface (Width / Weight /
 * Case / Italic / Metrics) harvested onto the selected layer's own props.
 *
 * One home per control: these styling fields left the Parameters tab, which
 * keeps Content + any tab:'anim' params (TEXT_TAB_KEYS below is the split).
 * Align rides along — it's text styling with no other home now. Fill stays
 * in the Inspector (shared paint surface, not duplicated here).
 *
 * Type mode's Variable axis block (morph / fade / random, Cut B, Curve,
 * Explode) is NOT here: compose text layers render via TypeBlock, which has
 * no axis-morph path (workshop vs compose split — TypeControlsPanel flattens
 * axisOn frames on their way in).
 *
 * Same rail shell + write path as ParametersPanel (46px header, useLayerEdit
 * coalesced history); Metrics keep their bind dots via the TEXT_SCHEMA param
 * defs so bindings resolve identically everywhere.
 */

/* Styling keys this tab owns — ParametersPanel filters these OUT of the
 * text layer's schema-driven view (one home per control). */
export const TEXT_TAB_KEYS = new Set([
  'width', 'weight', 'case', 'italic', 'textAlign', 'size', 'tracking', 'lineHeight',
])

const WIDTH_OPTIONS  = WIDTHS.map((w) => ({ value: w.id, label: w.label }))
const WEIGHT_OPTIONS = WEIGHTS.map((w) => ({ value: w.id, label: w.label }))
const CASE_OPTIONS   = CASES.map((c) => ({ value: c.id, label: c.label }))
const ALIGN_PARAM    = TEXT_SCHEMA.find((p) => p.key === 'textAlign')

/* Metric sliders reuse the schema param defs (ranges + binding identity)
 * under the mode-verbatim labels and value formatting. */
const metric = (key, label, format) => ({ ...TEXT_SCHEMA.find((p) => p.key === key), label, format })
const METRIC_PARAMS = [
  metric('size',       'Size',        (v) => `${v}px`),
  metric('tracking',   'Tracking',    (v) => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(3).replace(/^0/, '')}em`),
  metric('lineHeight', 'Line-height', (v) => v.toFixed(2)),
]

export default function TextPanel() {
  const { selectedId, layers } = useComposeState()
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null
  const text = layer?.type === 'text' ? layer : null

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {/* Header (title + delete) is shared in SelectionPalettePanel. */}
      <div className="kol-compose-inspector-body">
        {text
          ? <TextSurface key={text.id} layer={text} />
          : <p className="kol-helper-12 text-meta">Select a text layer to edit it.</p>}
      </div>
    </div>
  )
}

function TextSurface({ layer }) {
  const { palette } = useComposeState()
  const { saveType } = useGeneratorLibrary()
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp

  const onSave = () => {
    /* Save shape matches Type mode's saver (minus the axis fields the layer
     * doesn't carry). Color resolves to literal hex — library type specs
     * are hex-only (Type mode consumes them too). */
    saveType({
      text:       layer.text,
      width:      layer.width,
      weight:     layer.weight,
      italic:     layer.italic,
      size:       layer.size,
      tracking:   layer.tracking,
      lineHeight: layer.lineHeight,
      case:       layer.case,
      color:      resolveColor(layer.color, palette) ?? layer.color,
      textAlign:  layer.textAlign,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <LabeledControl label="Width">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={WIDTH_OPTIONS}
            value={layer.width}
            onChange={(v) => setProp('width', v)}
          />
        </LabeledControl>
        <LabeledControl label="Weight">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={WEIGHT_OPTIONS}
            value={layer.weight}
            onChange={(v) => setProp('weight', Number(v))}
          />
        </LabeledControl>
      </div>

      <div className="grid grid-cols-4 items-end gap-3">
        <div className="col-span-3 min-w-0">
          <LabeledControl label="Case">
            <ViewToggle
              options={CASE_OPTIONS}
              viewMode={layer.case ?? 'original'}
              onViewChange={(v) => setProp('case', v)}
            />
          </LabeledControl>
        </div>
        <LabeledControl label="Italic">
          <ViewToggle
            variant="single"
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={layer.italic ? 'on' : 'off'}
            onViewChange={(v) => setProp('italic', v === 'on')}
          />
        </LabeledControl>
      </div>

      <LabeledControl label={ALIGN_PARAM.label}>
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={ALIGN_PARAM.options}
          value={layer.textAlign ?? ALIGN_PARAM.default}
          onChange={(v) => setProp('textAlign', v)}
        />
      </LabeledControl>

      <LabeledControl label="Metrics">
        <div className="flex flex-col gap-4">
          {METRIC_PARAMS.map((p) => (
            <MetricRow key={p.key} param={p} layer={layer} setProp={setProp} />
          ))}
        </div>
      </LabeledControl>

      <EditorButton variant="primary" size="sm" className="w-full" onClick={onSave}>
        Save type to library
      </EditorButton>
    </div>
  )
}

/* One metric slider + its bind dot. A bound (animated/modulated) prop is
 * driven by the graph — show a read-only marker rather than let the slider
 * fight the binding (same policy as AutoControls). */
function MetricRow({ param: p, layer, setProp }) {
  const raw = layer[p.key]
  const bound = isBinding(raw)
  const value = typeof raw === 'number' ? raw : p.default
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        {bound
          ? (
            <div className="flex items-center justify-between">
              <span className="kol-helper-10 uppercase text-meta">{p.label}</span>
              <span className="kol-helper-12 text-meta italic">animated</span>
            </div>
          )
          : (
            <Slider
              label={p.label}
              min={p.min} max={p.max} step={p.step}
              value={value}
              formatValue={p.format}
              onChange={(v) => setProp(p.key, v)}
            />
          )}
      </div>
      <BindDot layer={layer} param={p} setProp={setProp} />
    </div>
  )
}
