import { useNavigate } from 'react-router-dom'
import { Section } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { Slider } from '@kolkrabbi/kol-component'
import { Textarea } from '@kolkrabbi/kol-component'
import ColorPicker from './ColorPicker'
import RuleRow from './RuleRow'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { useComposeState } from '../../compose/state'
import { SHAPE_OPTIONS } from './shapes'
import { usePatternState } from './state'

/**
 * PatternControls — Tool Properties content for Pattern mode. Shape /
 * grid params / rules / color / save.
 */
export default function PatternControls() {
  const {
    shapeId, setShapeId, customSvg, setCustomSvg,
    cols, setCols, rows, setRows, gap, setGap, padding, setPadding,
    stretch, setStretch, overflow, setOverflow, bgOn, setBgOn,
    colors, effectiveBg, svgString, rules,
    addRule, updateRule, removeRule, rerollRule, randomizeRules,
    randomizeColors, setColorAt, resetColors, copyCss,
    boundLayerId, unbindLayer,
  } = usePatternState()
  const { savePattern } = useGeneratorLibrary()
  const { addLayer }    = useComposeState()
  const navigate = useNavigate()

  const onSendToCompose = () => {
    /* Skip color/bg — let the new layer adopt compose's palette refs
     * instead of pinning Pattern Lab's literal hex (matches the
     * LayerInspector "Apply saved pattern" precedent). */
    addLayer('pattern', {
      shapeId, customSvg, cols, rows, gap, padding, stretch, overflow, rules,
    })
    navigate('/editor/compose')
  }

  const onDoneLink = () => {
    unbindLayer()
    navigate('/editor/compose')
  }

  return (
    <div className="kol-compose-rail">
      <div className="kol-compose-rail-head">
        <span className="kol-helper-10 uppercase text-meta">Pattern controls</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {boundLayerId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-secondary border border-fg-08">
            <span className="kol-helper-10 text-emphasis flex-1">Linked → Compose layer</span>
            <EditorButton variant="primary" size="sm" onClick={onDoneLink}>Done</EditorButton>
            <EditorButton variant="secondary" size="sm" onClick={unbindLayer} title="Unlink without leaving">Unlink</EditorButton>
          </div>
        )}
        <Section label="Shape">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={SHAPE_OPTIONS}
            value={shapeId}
            onChange={setShapeId}
          />
        </Section>

        {shapeId === 'custom' && (
          <Section label="Custom SVG">
            <Textarea
              variant="filled" size="sm"
              value={customSvg}
              onChange={(e) => setCustomSvg(e.target.value)}
              placeholder='<svg viewBox="0 0 24 24">…</svg>'
            />
          </Section>
        )}

        <div className="grid grid-cols-2 items-end gap-3">
          <Section label={`Columns · ${cols}`}>
            <Slider min={1} max={32} value={cols} onChange={setCols} />
          </Section>
          <Section label={`Rows · ${rows}`}>
            <Slider min={1} max={32} value={rows} onChange={setRows} />
          </Section>
        </div>

        <Section label={`Gap · ${gap}px`}>
          <Slider min={-64} max={64} value={gap} onChange={setGap} />
        </Section>

        <Section label={`Padding · ${padding}px`}>
          <Slider min={-128} max={128} value={padding} onChange={setPadding} />
        </Section>

        <div className="grid grid-cols-3 items-end gap-3">
          <Section label="Stretch">
            <ViewToggle
              variant="single"
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              viewMode={stretch ? 'on' : 'off'}
              onViewChange={(v) => setStretch(v === 'on')}
            />
          </Section>
          <Section label="Overflow">
            <ViewToggle
              variant="single"
              options={[{ value: 'clip', label: 'Clip' }, { value: 'visible', label: 'Visible' }]}
              viewMode={overflow ? 'visible' : 'clip'}
              onViewChange={(v) => setOverflow(v === 'visible')}
            />
          </Section>
          <Section label="Bg">
            <ViewToggle
              variant="single"
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              viewMode={bgOn ? 'on' : 'off'}
              onViewChange={(v) => setBgOn(v === 'on')}
            />
          </Section>
        </div>

        <Section label={`Rules · ${rules.length}`}>
          <div className="flex flex-col gap-2 w-full">
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
        </Section>

        <Section label="Color">
          <ColorPicker
            values={colors}
            onChange={setColorAt}
            onCopyCss={copyCss}
            onReset={resetColors}
          />
        </Section>

        <EditorButton variant="primary" size="sm" className="w-full" onClick={randomizeColors}>
          Randomize colors
        </EditorButton>

        <EditorButton
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => savePattern({
            shapeId, customSvg, cols, rows, gap, padding, stretch, overflow,
            color: colors.color, bg: effectiveBg, rules,
          })}
        >
          Save pattern to library
        </EditorButton>

        <EditorButton variant="primary" size="sm" className="w-full" onClick={onSendToCompose}>
          Send to compose
        </EditorButton>
      </div>
    </div>
  )
}
