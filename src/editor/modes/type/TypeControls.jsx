import { Slider } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { Input } from '@kolkrabbi/kol-component'
import { ColorSwatch } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { Section } from '@kolkrabbi/kol-component'
import { ColorField } from '../../compose/inspectors/LayerInspector'
import { resolveColor, useComposeState } from '../../compose/state'
import { WIDTHS, WEIGHTS, ASPECTS, CASES, PALETTE } from './cuts'
import { CURVE_OPTIONS } from './curveMath'

const ASPECT_OPTIONS = ASPECTS.map(a => ({ value: a.id, label: a.label }))
const CASE_OPTIONS   = CASES.map(c   => ({ value: c.id, label: c.label }))
const WIDTH_OPTIONS  = WIDTHS.map(w  => ({ value: w.id,  label: w.label }))
const WEIGHT_OPTIONS = WEIGHTS.map(w => ({ value: w.id,  label: w.label }))

function PaletteRow({ value, onChange }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {PALETTE.map(p => (
        <ColorSwatch
          key={p.hex}
          hex={p.hex}
          size="fill"
          title={p.label}
          selected={value === p.hex}
          onClick={() => onChange(p.hex)}
        />
      ))}
    </div>
  )
}

function FrameInspector({ frame, onUpdateFrame, onExplode }) {
  const update = (patch) => onUpdateFrame(frame.id, patch)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Section label="Width">
          <Dropdown variant="subtle" size="sm" className="w-full" options={WIDTH_OPTIONS} value={frame.width} onChange={v => update({ width: v })} />
        </Section>
        <Section label="Weight">
          <Dropdown variant="subtle" size="sm" className="w-full" options={WEIGHT_OPTIONS} value={frame.weight} onChange={v => update({ weight: Number(v) })} />
        </Section>
      </div>

      <div className="grid grid-cols-4 items-end gap-3">
        <div className="col-span-3 min-w-0">
          <Section label="Case">
            <ViewToggle
              options={CASE_OPTIONS}
              viewMode={frame.case}
              onViewChange={v => update({ case: v })}
            />
          </Section>
        </div>
        <Section label="Italic">
          <ViewToggle
            variant="single"
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={frame.italic ? 'on' : 'off'}
            onViewChange={(v) => update({ italic: v === 'on' })}
          />
        </Section>
      </div>

      <Section label="Metrics">
        <div className="flex flex-col gap-4">
          <Slider label="Size"        min={12}    max={400}  step={1}     value={frame.size}       formatValue={v => `${v}px`}                                                       onChange={v => update({ size: v })} />
          <Slider label="Tracking"    min={-0.05} max={0.2}  step={0.005} value={frame.tracking}   formatValue={v => `${v < 0 ? '-' : ''}${Math.abs(v).toFixed(3).replace(/^0/, '')}em`} onChange={v => update({ tracking: v })} />
          <Slider label="Line-height" min={0.85}  max={2.0}  step={0.05}  value={frame.lineHeight} formatValue={v => v.toFixed(2)}                                                  onChange={v => update({ lineHeight: v })} />
        </div>
      </Section>

      <Section label="Color">
        <div className="flex flex-col gap-2">
          <PaletteRow value={frame.color} onChange={v => update({ color: v })} />
          <div className="flex gap-1 items-center">
            <ColorSwatch hex={frame.color} />
            <Input
              variant="filled"
              size="sm"
              prefix="#"
              chars={6}
              uppercase
              value={(frame.color ?? '').replace(/^#/, '').toUpperCase()}
              onChange={(e) => update({ color: '#' + e.target.value.replace(/^#/, '').toUpperCase() })}
              className="flex-1"
            />
          </div>
        </div>
      </Section>

      <div className="border-t border-fg-08 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="kol-helper-10 uppercase text-meta">Variable axis</span>
          <ViewToggle
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={frame.axisOn ? 'on' : 'off'}
            onViewChange={(v) => update({ axisOn: v === 'on' })}
          />
        </div>
        {frame.axisOn && (
          <div className="flex flex-col gap-3">
            <Section label="Mode">
              <ViewToggle
                options={[
                  { value: 'morph',  label: 'Morph paths' },
                  { value: 'fade',   label: 'Fade A↔B' },
                  { value: 'random', label: 'Random / letter' },
                ]}
                viewMode={frame.axisMode ?? 'morph'}
                onViewChange={v => update({ axisMode: v })}
              />
            </Section>

            {((frame.axisMode ?? 'morph') === 'morph' || (frame.axisMode ?? 'morph') === 'fade') && (
              <div className="grid grid-cols-2 gap-3">
                <Section label="Cut B · Width">
                  <Dropdown variant="subtle" size="sm" className="w-full" options={WIDTH_OPTIONS} value={frame.width2} onChange={v => update({ width2: v })} />
                </Section>
                <Section label="Cut B · Weight">
                  <Dropdown variant="subtle" size="sm" className="w-full" options={WEIGHT_OPTIONS} value={frame.weight2} onChange={v => update({ weight2: Number(v) })} />
                </Section>
              </div>
            )}

            {(frame.axisMode ?? 'morph') === 'morph' && (
              <Section label="Curve">
                <Dropdown
                  variant="subtle"
                  size="sm"
                  className="w-full"
                  options={CURVE_OPTIONS}
                  value={frame.axisCurve ?? 'flat'}
                  onChange={v => update({ axisCurve: v })}
                />
              </Section>
            )}

            <Slider
              label={(frame.axisMode ?? 'morph') === 'random' ? 'Seed' : 'Blend'}
              min={0}
              max={100}
              value={Math.round(frame.blend * 100)}
              onChange={v => update({ blend: v / 100 })}
              formatValue={v => `${v}%`}
            />

            {(frame.axisMode ?? 'morph') === 'random' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Section label="Lock width">
                    <Dropdown
                      variant="subtle"
                      size="sm"
                      className="w-full"
                      options={[{ value: '', label: 'Any' }, ...WIDTH_OPTIONS]}
                      value={frame.randomWidthLock ?? ''}
                      onChange={v => update({ randomWidthLock: v })}
                    />
                  </Section>
                  <Section label="Lock weight">
                    <Dropdown
                      variant="subtle"
                      size="sm"
                      className="w-full"
                      options={[{ value: '', label: 'Any' }, ...WEIGHT_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))]}
                      value={frame.randomWeightLock ?? ''}
                      onChange={v => update({ randomWeightLock: v })}
                    />
                  </Section>
                </div>
                <EditorButton
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => update({ blend: Math.random() })}
                >
                  Re-roll layout
                </EditorButton>
              </>
            )}

            <EditorButton
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => onExplode?.(frame.id)}
              title="Replace this frame with one frame per letter, each with a random cut"
            >
              Explode to per-letter frames
            </EditorButton>

            <p className="kol-helper-10 text-subtle">
              {(frame.axisMode ?? 'morph') === 'morph'
                ? 'Real SVG path morph between Cut A and Cut B (loads woff2 outlines via opentype.js). Drag the dot to scrub.'
                : (frame.axisMode ?? 'morph') === 'fade'
                  ? 'Opacity blend between Cut A and Cut B layered renders. Drag the dot to scrub.'
                  : 'Each letter gets its own random cut. Drag the dot to scrub the seed — every position re-shuffles.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TypeControls({ state, set, selectedFrame, onUpdateFrame, onAddFrame, onExplode, onCopy, onReset }) {
  /* Palette comes from compose state — same source the compose ColorField
   * reads, so palette refs picked here resolve consistently. */
  const { palette } = useComposeState()
  const onBgChange = (v) => {
    if (typeof v !== 'string') return
    if (v.startsWith('palette:')) {
      const hex = resolveColor(v, palette)
      if (hex) set({ bgColor: hex })
    } else {
      set({ bgColor: v })
    }
  }
  return (
    <>
      <Section label="Aspect">
        <Dropdown
          variant="subtle"
          size="sm"
          className="w-full"
          options={ASPECT_OPTIONS}
          value={state.aspect}
          onChange={v => set({ aspect: v })}
        />
      </Section>

      <Section label="Canvas background">
        <ColorField value={state.bgColor} onChange={onBgChange} palette={palette} hideLabel />
      </Section>

      <div className="border-t border-fg-08 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="kol-helper-10 uppercase text-meta">
            {selectedFrame ? 'Selected frame' : 'No frame selected'}
          </span>
          <EditorButton variant="primary" size="sm" iconLeft="plus" onClick={onAddFrame} title="Add frame">
            Add frame
          </EditorButton>
        </div>
        {selectedFrame ? (
          <FrameInspector frame={selectedFrame} onUpdateFrame={onUpdateFrame} onExplode={onExplode} />
        ) : (
          <p className="kol-helper-12 text-subtle">Click a frame on the canvas to edit, or hit + Add frame.</p>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-fg-08">
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={onCopy}>Copy CSS</EditorButton>
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={onReset}>Reset</EditorButton>
      </div>
    </>
  )
}
