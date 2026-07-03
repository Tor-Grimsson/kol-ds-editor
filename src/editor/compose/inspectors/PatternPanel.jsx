import { LabeledControl } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import ColorPicker from '../../modes/pattern/ColorPicker'
import RuleRow, { newRule, randomRule } from '../../modes/pattern/RuleRow'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { PATTERN_SCHEMA } from '../../params/schemas/pattern'
import { useComposeState, resolveColor, patternFromSpec } from '../state'
import { findLayerDeep } from '../helpers'
import { labelForLayer } from '../labels'
import { useLayerEdit } from '../useLayerEdit'
import { useGeneratorLibrary } from '../../library/LibraryProvider'

/**
 * PatternPanel — the Pattern tab of the right rail (selection-driven: the
 * tab only shows for pattern layers). The Pattern mode control surface
 * harvested onto the selected layer's own props — the layer carries its
 * params flat and LayerRenderer/build call buildPatternSvg from them, so
 * every mode control maps 1:1, rules array included.
 *
 * One home per control: the schema params + rules editor + save left the
 * Parameters tab (which keeps the saved-pattern picker, the Pattern-mode /
 * Flatten actions, and any tab:'anim' params). "Send to compose" is gone —
 * this IS compose. Tile size (a layer-only knob with no mode equivalent)
 * lives here too so it keeps a home.
 *
 * The Color/Background swatch strips write literal hex (mode contract —
 * ColorPicker resolves palette refs before storing); the Inspector's Fill
 * field remains the ref-preserving path. Same rail shell + write path as
 * ParametersPanel (46px header, useLayerEdit coalesced history, BindDot per
 * animatable field) so tab switches never shift the column.
 */

/* Mode-verbatim labels over the shared schema (Pattern mode says "Columns",
 * the schema says "Cols"). `bg` drops out — the Background swatch strip is
 * its home; `bgOn` joins the Tile run (mode's Stretch/Overflow/Bg trio) so
 * no stray Color header renders above it. */
const RELABEL = {
  cols: { label: 'Columns' },
  rows: { label: 'Rows' },
  bgOn: { label: 'Bg', section: 'Tile' },
}
const PATTERN_TAB_SCHEMA = PATTERN_SCHEMA
  .filter((p) => p.key !== 'bg')
  .map((p) => (RELABEL[p.key] ? { ...p, ...RELABEL[p.key] } : p))

export default function PatternPanel() {
  const { selectedId, layers } = useComposeState()
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null
  const pattern = layer?.type === 'pattern' ? layer : null

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {/* min-h matches InspectorRail's header so tab switches never shift
          the column. */}
      <div className="flex items-center gap-3 px-4 min-h-[46px]">
        {pattern && <span className="kol-helper-12 text-emphasis">{labelForLayer(pattern)}</span>}
      </div>
      <div className="kol-compose-inspector-body">
        {pattern
          ? <PatternSurface key={pattern.id} layer={pattern} />
          : <p className="kol-helper-12 text-meta">Select a pattern layer to edit it.</p>}
      </div>
    </div>
  )
}

function PatternSurface({ layer }) {
  const { updateLayer, palette } = useComposeState()
  const { savePattern } = useGeneratorLibrary()
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp
  const renderAnimate = (p) => <BindDot layer={layer} param={p} setProp={setProp} />

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

  /* ColorPicker speaks concrete hex — resolve refs for display; background
   * shows transparent while bgOn is off (alt+click transparent = Bg off). */
  const resolvedColor = resolveColor(layer.color, palette) ?? layer.color
  const resolvedBg    = layer.bgOn ? (resolveColor(layer.bg, palette) ?? layer.bg) : null
  const onColorChange = (tab, hex) => {
    if (tab === 'color') {
      /* A transparent fill can't render — PatternLayer falls back to white —
       * so alt+click transparent is a no-op on the Color tab. */
      if (hex != null) setProp('color', hex)
    } else if (hex == null) {
      setProp('bgOn', false)
    } else {
      updateLayer(layer.id, { bg: hex, bgOn: true })
    }
  }
  const copyCss = () => {
    const bg  = resolveColor(layer.bg, palette) ?? layer.bg
    const css = `color: ${resolvedColor};\nbackground: ${bg};`
    if (navigator.clipboard) navigator.clipboard.writeText(css).catch(() => {})
  }
  /* Reset = colors only (mode contract), back to the compose pattern-layer
   * default refs rather than Pattern mode's literal token hexes. */
  const resetColors = () => {
    const d = patternFromSpec({})
    updateLayer(layer.id, { color: d.color, bg: d.bg })
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

  return (
    <div className="flex flex-col gap-4">
      <AutoControls
        schema={PATTERN_TAB_SCHEMA}
        layer={layer}
        setProp={setProp}
        palette={palette}
        renderAnimate={renderAnimate}
      />

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
          <div className="grid grid-cols-2 gap-2">
            <EditorButton variant="primary" size="sm" iconLeft="plus" onClick={addRule}>
              Add rule
            </EditorButton>
            <EditorButton variant="primary" size="sm" onClick={randomizeRules}>
              Randomize
            </EditorButton>
          </div>
        </div>
      </LabeledControl>

      <LabeledControl label="Color">
        <ColorPicker
          values={{ color: resolvedColor, background: resolvedBg }}
          onChange={onColorChange}
          onCopyCss={copyCss}
          onReset={resetColors}
        />
      </LabeledControl>

      <EditorButton
        variant="primary" size="sm" className="w-full"
        onClick={onSave}
        title="Save current pattern params to the shared library"
      >
        Save pattern to library
      </EditorButton>
    </div>
  )
}
