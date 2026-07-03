import { Fragment, useState } from 'react'
import EditorButton from '../../components/EditorButton'
import EditorIcon from '../../icons/EditorIcon'
import { Dropdown, LabeledControl, Slider, Textarea } from '@kolkrabbi/kol-component'
import { ColorField } from './ColorField'
import { resolveColor } from '../state'
import { isBinding } from '../../params/resolve'
import { KINETIC_PRESETS, KINETIC_TREE, presetComp, mergeInstance } from '../../../kinetic/presets'
import { KINETIC_KNOBS, knobOptions, randomiseComp } from '../../../kinetic/knobs'

/**
 * KineticPanel — the kinetic-type layer's control surface (extracted from
 * ParametersPanel's KineticFields when the layer graduated from preset player
 * to type tool). Three pieces:
 *
 *   Picker    — the LoopPicker-style TYPE > CATEGORY > PRESET stack over
 *               KINETIC_TREE (presets.js). Always above the sub-tab strip,
 *               like the loop picker. Picking resets the whole comp.
 *   Elements  — the comp's instances (user-facing word: "Element"): select /
 *               add / duplicate / remove / reorder. The selected index is
 *               local UI state; every Style/Animation knob targets it.
 *   Knobs     — KINETIC_KNOBS (src/kinetic/knobs.js), pure comp transforms
 *               parameterized by the selected instance index, rendered here
 *               rather than via AutoControls because the comp is the layer's
 *               single source of truth (flat mirrors would desync on preset
 *               switches). Every edit writes a fresh comp through setProp
 *               (coalesced history); structural edits (preset, add/remove/
 *               reorder/duplicate, randomise) go through updateLayer
 *               (discrete history).
 *
 * Plus ONE flat bindable prop: `morphBlend` (the Animation tab, gated on any
 * element having morph on). The knob writes `layer.morphBlend` write-through
 * — KineticLayer resolves it into every morph-on instance's `morph.blend`
 * before setComposition — so it takes a BindDot and animates like any other
 * flat range param. Note the flat prop, once set, overrides the per-element
 * Style-tab blend.
 */
const ANIM_HINT = 'Animate any parameter via its bind dot.'

const MORPH_BLEND_PARAM = { key: 'morphBlend', label: 'Morph blend', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 }

const iconBtnStyle = { lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

export default function KineticPanel({ layer, setProp, updateLayer, palette, renderAnimate, tab, tabStrip }) {
  const comp = layer.comp ?? { bg: '#0b0d12', instances: [] }
  const insts = comp.instances ?? []

  /* Selected element — local UI state, clamped so removals never point past
   * the end. Preset picks reset it to the first element. */
  const [sel, setSel] = useState(0)
  const idx = Math.min(sel, Math.max(0, insts.length - 1))

  /* Picking a preset resets the whole composition (loop preset semantics —
   * a curated starting point, not a patch). Discrete history entry. */
  const applyPreset = (preset) => {
    if (!preset) return
    updateLayer(layer.id, { presetId: preset.id, presetLabel: preset.label, comp: presetComp(preset) })
    setSel(0)
  }

  /* Immutable comp writes — knobs return fresh objects all the way down so
   * the renderer's identity check re-applies the composition. */
  const writeComp = (next) => setProp('comp', next)
  const writeInstances = (instances) => updateLayer(layer.id, { comp: { ...comp, instances } })
  const patchInstance = (i, partial) =>
    writeComp({ ...comp, instances: insts.map((x, j) => (j === i ? { ...x, ...partial } : x)) })

  /* Randomise — roll the selected element's tractable knobs (noRandom/when
   * honored in randomiseComp). Discrete history entry, like a preset pick. */
  const onRandomise = () => updateLayer(layer.id, { comp: randomiseComp(comp, idx) })

  const knobs = KINETIC_KNOBS.filter((k) => k.tab === tab && (!k.when || k.when(comp, idx)))
  const anyMorph = insts.some((x) => x?.morph?.on)

  return (
    <>
      <KineticPicker layer={layer} onPreset={applyPreset} />

      <div className="flex flex-col gap-1">
        <span className="kol-helper-10 text-meta">Elements</span>
        <ElementList insts={insts} idx={idx} onSelect={setSel} onWrite={writeInstances} />
      </div>

      {tabStrip}

      {tab === 'generate' && (
        <>
          <LabeledControl label="Text">
            <Textarea
              variant="ghost" size="sm" rows={2}
              value={insts[idx]?.text ?? ''}
              onChange={(e) => patchInstance(idx, { text: e.target.value })}
            />
          </LabeledControl>
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
          <KineticKnob knob={k} comp={comp} idx={idx} palette={palette} onComp={writeComp} />
        </Fragment>
      ))}

      {tab === 'anim' && anyMorph && (
        <MorphBlendKnob layer={layer} setProp={setProp} insts={insts} renderAnimate={renderAnimate} />
      )}

      {tab === 'anim' && <p className="kol-helper-12 text-meta">{ANIM_HINT}</p>}
    </>
  )
}

/**
 * KineticPicker — the LoopPicker dropdown stack (TYPE > CATEGORY > PRESET,
 * docs/documentation/01-hierarchy.md) over the kinetic preset catalog:
 * Type = Type · Kinetic (KINETIC_TREE), Category = the type's subs, Preset =
 * plain names. Type/category hops land on their first preset.
 */
function KineticPicker({ layer, onPreset }) {
  const current = KINETIC_PRESETS.find((p) => p.id === layer.presetId) ?? KINETIC_PRESETS[0]
  const type = KINETIC_TREE.find((t) => t.subs.includes(current.sub)) ?? KINETIC_TREE[0]
  const subPresets = KINETIC_PRESETS.filter((p) => p.sub === current.sub)
  const firstOf = (sub) => KINETIC_PRESETS.find((p) => p.sub === sub)

  return (
    <>
      <LabeledControl label="Type">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={KINETIC_TREE.map((t) => ({ value: t.label, label: t.label }))}
          value={type.label}
          onChange={(label) => {
            const t = KINETIC_TREE.find((x) => x.label === label)
            if (t) onPreset(firstOf(t.subs[0]))
          }}
        />
      </LabeledControl>
      <LabeledControl label="Category">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={type.subs.map((s) => ({ value: s, label: s }))}
          value={current.sub}
          onChange={(s) => onPreset(firstOf(s))}
        />
      </LabeledControl>
      <LabeledControl label="Preset">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={subPresets.map((p) => ({ value: p.id, label: p.label }))}
          value={current.id}
          onChange={(id) => onPreset(KINETIC_PRESETS.find((p) => p.id === id))}
        />
      </LabeledControl>
    </>
  )
}

/**
 * ElementList — the comp's instances as selectable rows (the labs Layout tab's
 * interaction model in editor chrome): click selects, per-row duplicate/remove,
 * footer Add + up/down move the selection. Selected row takes the layers-panel
 * accent. The last element can't be removed (labs rule).
 */
function ElementList({ insts, idx, onSelect, onWrite }) {
  const uid = () => {
    let n = insts.length
    while (insts.some((x) => x.id === `i${n}`)) n++
    return `i${n}`
  }
  const add = () => {
    const seed = { id: uid(), text: 'Text' }
    if (insts[idx]?.fill) seed.fill = insts[idx].fill
    onWrite([...insts, mergeInstance(seed, insts.length)])
    onSelect(insts.length)
  }
  const duplicate = (i) => {
    const clone = { ...structuredClone(insts[i]), id: uid() }
    const next = [...insts]
    next.splice(i + 1, 0, clone)
    onWrite(next)
    onSelect(i + 1)
  }
  const remove = (i) => {
    if (insts.length <= 1) return
    onWrite(insts.filter((_, j) => j !== i))
    onSelect(Math.min(i, insts.length - 2))
  }
  const move = (d) => {
    const to = idx + d
    if (to < 0 || to >= insts.length) return
    const next = [...insts]
    const [m] = next.splice(idx, 1)
    next.splice(to, 0, m)
    onWrite(next)
    onSelect(to)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        {insts.map((ins, i) => (
          <div
            key={ins.id ?? i}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded cursor-pointer kol-helper-12 ${
              i === idx
                ? 'bg-[color-mix(in_srgb,var(--kol-accent-primary)_26%,transparent)] text-emphasis'
                : 'text-body hover:bg-fg-04 hover:text-emphasis'
            }`}
          >
            <span className="kol-helper-10 text-meta shrink-0">{i + 1}</span>
            <span className="truncate flex-1 min-w-0">{ins.text || '—'}</span>
            <EditorButton
              variant="ghost" size="sm" quiet iconOnly="duplicate" iconSize={12}
              aria-label="Duplicate element" title="Duplicate element"
              onClick={(e) => { e.stopPropagation(); duplicate(i) }}
            />
            <EditorButton
              variant="ghost" size="sm" quiet iconOnly="close" iconSize={10}
              aria-label="Remove element" title="Remove element"
              disabled={insts.length <= 1}
              onClick={(e) => { e.stopPropagation(); remove(i) }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <EditorButton variant="secondary" size="sm" className="flex-1" iconLeft="plus" iconSize={12} onClick={add}>
          Add element
        </EditorButton>
        <EditorButton
          variant="ghost" size="sm" quiet style={iconBtnStyle}
          aria-label="Move element up" title="Move element up"
          disabled={idx <= 0} onClick={() => move(-1)}
        >
          <EditorIcon name="chevron-down" size={12} style={{ transform: 'rotate(180deg)' }} />
        </EditorButton>
        <EditorButton
          variant="ghost" size="sm" quiet style={iconBtnStyle}
          aria-label="Move element down" title="Move element down"
          disabled={idx >= insts.length - 1} onClick={() => move(1)}
        >
          <EditorIcon name="chevron-down" size={12} />
        </EditorButton>
      </div>
    </>
  )
}

/* One kinetic knob → the matching KOL control, targeting the selected
 * element. Writes go through the knob's pure comp transform; palette refs
 * resolve to literal hex at write time — the SVG engine paints raw fill
 * strings (same trade-off as "Edit in Pattern mode"). */
function KineticKnob({ knob: k, comp, idx, palette, onComp }) {
  const value = k.get(comp, idx)
  const write = (v) => onComp(k.set(comp, v, idx))
  if (k.type === 'color') {
    return <ColorField label={k.label} value={value} onChange={(v) => write(resolveColor(v, palette) ?? v)} palette={palette} />
  }
  if (k.type === 'select') {
    return (
      <LabeledControl label={k.label}>
        <Dropdown variant="subtle" size="sm" className="w-full" options={knobOptions(k, comp, idx)} value={value} onChange={write} />
      </LabeledControl>
    )
  }
  return (
    <LabeledControl label={k.label}>
      <Slider min={k.min} max={k.max} step={k.step ?? 1} value={typeof value === 'number' ? value : k.min} onChange={write} />
    </LabeledControl>
  )
}

/* The morphBlend bridge knob — the kinetic layer's one FLAT bindable prop.
 * Reads/writes `layer.morphBlend` (falling back to the first morph-on
 * element's stored blend for display); the BindDot beside it binds the flat
 * prop exactly like any schema range param. A bound prop is graph-driven —
 * read-only here (the AutoControls convention). */
function MorphBlendKnob({ layer, setProp, insts, renderAnimate }) {
  const p = MORPH_BLEND_PARAM
  const raw = layer[p.key]
  const bound = isBinding(raw)
  const fallback = insts.find((x) => x?.morph?.on)?.morph?.blend ?? p.default
  const value = typeof raw === 'number' ? raw : fallback
  const control = bound
    ? <div className="kol-helper-12 text-meta italic px-1">animated</div>
    : <Slider min={p.min} max={p.max} step={p.step} value={value} onChange={(v) => setProp(p.key, v)} />
  return (
    <LabeledControl label={p.label}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{control}</div>
        {renderAnimate(p)}
      </div>
    </LabeledControl>
  )
}
