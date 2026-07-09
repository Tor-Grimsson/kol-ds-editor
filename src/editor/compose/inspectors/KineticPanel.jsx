import { Fragment, useEffect, useRef, useState } from 'react'
import EditorButton from '../../components/EditorButton'
import EditorIcon from '../../icons/EditorIcon'
import {
  Dropdown, LabeledControl, Slider, Textarea, SegmentedToggle, ViewToggle,
  ToggleCheckbox, usePopover, PopoverPanel, MenuDropdownItem,
} from '@kolkrabbi/kol-component'
import { ColorField } from './ColorField'
import { TreePicker } from './TreePicker'
import { resolveColor } from '../state'
import { isBinding } from '../../params/resolve'
import { mulberry32 } from '../../lib/rng'
import { useRollSeed, SeedField } from '../../params/rolls'
import { KINETIC_PRESETS, KINETIC_TREE, presetComp, mergeInstance } from '../../../kinetic/presets'
import { KINETIC_KNOBS, knobOptions, knobRange, randomiseComp } from '../../../kinetic/knobs'
import { OPENTYPE_FEATURES } from '../../../kinetic/features'
import { DEFAULT_POINTS, buildPath } from '../../../kinetic/paths'
import { THEME_OPTIONS, DEFAULT_THEME, resolveTheme } from '../../../loops/lib/themes'

/**
 * KineticPanel — the kinetic-type layer's control surface (extracted from
 * ParametersPanel's KineticFields when the layer graduated from preset player
 * to type tool). Three pieces:
 *
 *   Picker    — the LoopPicker-style TYPE > CATEGORY > PRESET stack over
 *               KINETIC_TREE (presets.js). Always above the sub-tab strip,
 *               like the loop picker. Picking resets the whole comp.
 *   Elements  — the comp's instances (user-facing word: "Element"): select /
 *               add / duplicate / remove / reorder, plus GROUPING (labs
 *               TypeEditor): tick rows → Group/Ungroup; grouped elements
 *               move/scale/align/weight/italic/fill as one (writeKnob fans
 *               the GROUP_KEYS out across members). The selected index is
 *               local UI state; every Style/Animation knob targets it.
 *               "Edit on canvas" flips CanvasArea into element-edit mode
 *               (kol:kinetic-edit); element selection syncs both ways via
 *               kol:kinetic-element.
 *   Knobs     — KINETIC_KNOBS (src/kinetic/knobs.js), pure comp transforms
 *               parameterized by the selected instance index, rendered here
 *               rather than via AutoControls because the comp is the layer's
 *               single source of truth (flat mirrors would desync on preset
 *               switches). Every edit writes a fresh comp through setProp
 *               (coalesced history); structural edits (preset, add/remove/
 *               reorder/duplicate, group, motion add/remove, randomise) go
 *               through updateLayer (discrete history).
 *
 * Motion stack (labs MotionControls): the engine composes `motion` plus the
 * `motions` array per element. The Animation tab shows a motion-layer
 * selector — the single-motion knobs edit the SELECTED motion layer via a
 * swap-in/swap-out view over the comp (MOTION_KEYS below).
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

/* Knobs that address a motion layer — retargeted to the selected stack entry
 * (0 = primary `motion`, n = `motions[n-1]`) via the swap-in view. */
const MOTION_KEYS = new Set(['mode', 'cycles', 'motionAmp', 'motionPhase', 'axis', 'field'])
/* Fresh extra-motion defaults (labs MotionControls NEW_LAYER). */
const NEW_MOTION = { mode: 'glyphwave', cycles: 1, phase: 0.5, amp: 0.3, axis: 'wght', field: 'x' }

/* Knob writes that fan out across a group's members (labs group-aware
 * setters: move / scale / align / set-weight / italic / fill as one).
 * fontSize scales proportionally; offset moves by delta; the rest copy. */
const GROUP_KEYS = new Set(['align', 'italic', 'fill', 'fontSize', 'vfWght', 'offsetX', 'offsetY'])

const iconBtnStyle = { lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

/* short group tag (a·b·c…) so grouped rows read as a set (labs groupTag) */
const groupTag = (gid, groups) => (gid ? String.fromCharCode(97 + (groups.indexOf(gid) % 26)) : null)

export default function KineticPanel({ layer, setProp, updateLayer, palette, renderAnimate, tab, tabStrip }) {
  const comp = layer.comp ?? { bg: '#0b0d12', instances: [] }
  const insts = comp.instances ?? []

  /* Selected element — local UI state, clamped so removals never point past
   * the end. Preset picks reset it to the first element. Canvas element-edit
   * mode mirrors it via kol:kinetic-element (both directions). */
  const [sel, setSel] = useState(0)
  const idx = Math.min(sel, Math.max(0, insts.length - 1))
  const selectElement = (i) => {
    setSel(i)
    window.dispatchEvent(new CustomEvent('kol:kinetic-element', { detail: { id: layer.id, index: i, from: 'panel' } }))
  }
  useEffect(() => {
    const onEl = (e) => {
      if (e.detail?.id === layer.id && e.detail.from === 'canvas') setSel(e.detail.index)
    }
    window.addEventListener('kol:kinetic-element', onEl)
    return () => window.removeEventListener('kol:kinetic-element', onEl)
  }, [layer.id])

  /* Grouping — rows ticked for Group/Ungroup (labs TypeEditor marked). */
  const [marked, setMarked] = useState([])
  const toggleMark = (id) => setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
  const groupMembers = (i) => {
    const g = insts[i]?.group
    if (!g) return [i]
    return insts.reduce((acc, x, j) => (x.group === g ? [...acc, j] : acc), [])
  }

  /* Motion stack — which motion layer the Animation knobs edit. 0 = the
   * primary `motion`; n = `motions[n-1]`. Clamped per element. */
  const [motionSel, setMotionSel] = useState(0)
  const motions = insts[idx]?.motions ?? []
  const mIdx = Math.min(motionSel, motions.length)
  /* View with the selected extra motion swapped into inst.motion, so the
   * single-motion knobs (get/set/when) read and patch it unchanged. */
  const motionView = (c) => ({
    ...c,
    instances: (c.instances ?? []).map((x, j) => (j === idx ? { ...x, motion: { ...(x.motions?.[mIdx - 1] ?? {}) } } : x)),
  })
  const viewFor = (k) => (MOTION_KEYS.has(k.key) && mIdx > 0 ? motionView(comp) : comp)

  /* Picking a preset resets the whole composition (loop preset semantics —
   * a curated starting point, not a patch). Discrete history entry. */
  const applyPreset = (preset) => {
    if (!preset) return
    updateLayer(layer.id, { presetId: preset.id, presetLabel: preset.label, comp: presetComp(preset) })
    setSel(0)
    setMotionSel(0)
  }

  /* Immutable comp writes — knobs return fresh objects all the way down so
   * the renderer's identity check re-applies the composition. */
  const writeComp = (next) => setProp('comp', next)
  const writeInstances = (instances) => updateLayer(layer.id, { comp: { ...comp, instances } })
  const patchInstance = (i, partial) =>
    writeComp({ ...comp, instances: insts.map((x, j) => (j === i ? { ...x, ...partial } : x)) })

  /* Group / Ungroup the ticked rows — a shared group id per Group press.
   * Structural → discrete history. */
  const groupMarked = () => {
    if (marked.length < 2) return
    const existing = new Set(insts.map((x) => x.group).filter(Boolean))
    let n = 1
    while (existing.has(`g${n}`)) n++
    writeInstances(insts.map((x) => (marked.includes(x.id) ? { ...x, group: `g${n}` } : x)))
    setMarked([])
  }
  const ungroupMarked = () => {
    if (!marked.length) return
    writeInstances(insts.map((x) => (marked.includes(x.id) ? { ...x, group: null } : x)))
    setMarked([])
  }

  /* ONE write path for every knob:
   *   - motion knobs with an extra layer selected → swap-out into `motions`
   *   - GROUP_KEYS on a grouped element → fan out across members
   *   - everything else → the knob's plain per-instance transform */
  const writeKnob = (k, v) => {
    if (MOTION_KEYS.has(k.key) && mIdx > 0) {
      const nextView = k.set(motionView(comp), v, idx)
      const m = nextView.instances?.[idx]?.motion ?? {}
      patchInstance(idx, { motions: motions.map((mm, j) => (j === mIdx - 1 ? m : mm)) })
      return
    }
    const members = groupMembers(idx)
    if (members.length > 1 && GROUP_KEYS.has(k.key)) {
      let next = comp
      if (k.key === 'fontSize') {
        /* labs group-aware corner scale — proportional font-size across members */
        const base = Number(k.get(comp, idx)) || 1
        const factor = v / base
        for (const j of members) {
          const cur = Number(k.get(comp, j)) || base
          next = k.set(next, Math.max(8, Math.min(1200, Math.round(cur * factor))), j)
        }
      } else if (k.key === 'offsetX' || k.key === 'offsetY') {
        /* move as one — every member shifts by the primary's delta */
        const delta = v - (Number(k.get(comp, idx)) || 0)
        for (const j of members) next = k.set(next, (Number(k.get(comp, j)) || 0) + delta, j)
      } else {
        for (const j of members) next = k.set(next, v, j)
      }
      writeComp(next)
      return
    }
    writeComp(k.set(comp, v, idx))
  }

  /* Randomise — seeded rolls of the tractable knobs (noRandom/when honored
   * in randomiseComp), per selected element or across ALL elements (labs
   * KineticPage rolled every instance). One mulberry32 stream per press;
   * the seed persists on the layer (`_rollSeed`) and a manually-typed seed
   * reproduces the roll once. Discrete history entry, like a preset pick. */
  const seed = useRollSeed(layer)
  const onRandomise = () => {
    const s = seed.take()
    updateLayer(layer.id, { comp: randomiseComp(comp, idx, mulberry32(s >>> 0)), _rollSeed: s })
  }
  const onRandomiseAll = () => {
    const s = seed.take()
    const rng = mulberry32(s >>> 0)
    let next = comp
    insts.forEach((_, i) => { next = randomiseComp(next, i, rng) })
    updateLayer(layer.id, { comp: next, _rollSeed: s })
  }

  /* Theme / invert quick-set (ParametersPanel's loop-theme semantics, applied
   * comp-natively): resolveTheme → frame bg + every element's fill. Discrete. */
  const applyTheme = (id, inv) => {
    const t = resolveTheme(id, inv)
    updateLayer(layer.id, {
      themeId: id, themeInvert: inv,
      comp: { ...comp, bg: t.bg, instances: insts.map((x) => ({ ...x, fill: t.fg })) },
    })
  }
  /* "Text colour" — every element's fill in one write (labs onAllFill). */
  const onAllFill = (hex) => writeComp({ ...comp, instances: insts.map((x) => ({ ...x, fill: hex })) })

  const knobs = KINETIC_KNOBS.filter((k) => k.tab === tab && (!k.when || k.when(viewFor(k), idx)))
  const anyMorph = insts.some((x) => x?.morph?.on)
  const selInst = insts[idx]

  return (
    <>
      <KineticPicker layer={layer} onPreset={applyPreset} />

      <div className="flex flex-col gap-1">
        <span className="kol-helper-10 text-meta">Elements</span>
        <ElementList
          insts={insts} idx={idx} onSelect={selectElement} onWrite={writeInstances}
          marked={marked} onMark={toggleMark} onGroup={groupMarked} onUngroup={ungroupMarked}
        />
        <EditorButton
          variant="secondary" size="sm" className="w-full"
          title="Edit elements on the canvas (click to select, drag to move, corners to scale)"
          onClick={() => window.dispatchEvent(new CustomEvent('kol:kinetic-edit', { detail: { id: layer.id, index: idx } }))}
        >
          Edit on canvas
        </EditorButton>
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
          <div className="grid grid-cols-2 gap-2">
            <LabeledControl label="Theme">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={THEME_OPTIONS}
                value={layer.themeId ?? DEFAULT_THEME}
                onChange={(id) => applyTheme(id, !!layer.themeInvert)}
              />
            </LabeledControl>
            <LabeledControl label="Invert">
              <ViewToggle
                options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                viewMode={layer.themeInvert ? 'on' : 'off'}
                onViewChange={(v) => applyTheme(layer.themeId ?? DEFAULT_THEME, v === 'on')}
              />
            </LabeledControl>
          </div>
          <ColorField
            label="Text colour"
            value={insts[0]?.fill}
            onChange={(v) => onAllFill(resolveColor(v, palette) ?? v)}
            palette={palette}
          />
          <div className="grid grid-cols-2 gap-2">
            <EditorButton variant="primary" size="sm" onClick={onRandomise}>
              Randomise
            </EditorButton>
            <EditorButton variant="primary" size="sm" onClick={onRandomiseAll}>
              All elements
            </EditorButton>
          </div>
          <SeedField seed={seed} />
        </>
      )}

      {tab === 'anim' && (
        <MotionStack
          motions={motions} mIdx={mIdx} onSelect={setMotionSel}
          onAdd={() => {
            writeInstances(insts.map((x, j) => (j === idx ? { ...x, motions: [...motions, { ...NEW_MOTION }] } : x)))
            setMotionSel(motions.length + 1)
          }}
          onRemove={() => {
            if (mIdx === 0) return
            writeInstances(insts.map((x, j) => (j === idx ? { ...x, motions: motions.filter((_, m) => m !== mIdx - 1) } : x)))
            setMotionSel(mIdx - 1)
          }}
        />
      )}

      {tab !== 'generate' && knobs.map((k, i) => (
        <Fragment key={k.key}>
          {/* OpenType features sit between the Axes and Arrangement sections
              (labs EditControls order) — injected at the arrangement anchor. */}
          {k.key === 'arrangement' && (
            <>
              <span className="kol-helper-10 text-meta">OpenType</span>
              <OpenTypeMenu
                value={selInst?.opentype ?? {}}
                onToggle={(tag, on) => patchInstance(idx, { opentype: { ...(selInst?.opentype ?? {}), [tag]: on } })}
              />
            </>
          )}
          {k.section && k.section !== knobs[i - 1]?.section && (
            <span className="kol-helper-10 text-meta">{k.section}</span>
          )}
          <KineticKnob knob={k} comp={viewFor(k)} idx={idx} palette={palette} onWrite={writeKnob} />
          {/* custom-arrangement point editor — the labs CustomPathEditor as a
              rail mini editor, anchored under the arrangement toggles. */}
          {k.key === 'showPath' && selInst?.path?.type === 'custom' && (
            <CustomPathPoints
              inst={selInst} layer={layer}
              onPoints={(pts) => patchInstance(idx, { path: { ...(selInst?.path ?? {}), points: pts } })}
            />
          )}
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
 * KineticPicker — the shared TreePicker stack (TYPE > CATEGORY > PRESET,
 * docs/documentation/01-hierarchy.md) over the kinetic preset catalog:
 * Type = Type · Kinetic (KINETIC_TREE), Category = the type's subs, Preset =
 * plain names. Type/category hops land on their first preset.
 */
function KineticPicker({ layer, onPreset }) {
  const current = KINETIC_PRESETS.find((p) => p.id === layer.presetId) ?? KINETIC_PRESETS[0]
  return <TreePicker tree={KINETIC_TREE} presets={KINETIC_PRESETS} current={current} onPick={onPreset} />
}

/**
 * ElementList — the comp's instances as selectable rows (the labs Layout tab's
 * interaction model in editor chrome): click selects, per-row duplicate/remove,
 * footer Add + up/down move the selection. Selected row takes the layers-panel
 * accent. The last element can't be removed (labs rule). Tick checkboxes mark
 * rows for Group/Ungroup (labs LayoutControls); grouped rows show a tag chip.
 */
function ElementList({ insts, idx, onSelect, onWrite, marked, onMark, onGroup, onUngroup }) {
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

  const groupIds = [...new Set(insts.map((x) => x.group).filter(Boolean))]

  return (
    <>
      <div className="flex flex-col gap-1">
        {insts.map((ins, i) => {
          const tag = groupTag(ins.group, groupIds)
          return (
            <div
              key={ins.id ?? i}
              onClick={() => onSelect(i)}
              className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded cursor-pointer kol-helper-12 ${
                i === idx
                  ? 'bg-[color-mix(in_srgb,var(--kol-accent-primary)_26%,transparent)] text-emphasis'
                  : 'text-body hover:bg-fg-04 hover:text-emphasis'
              }`}
            >
              <span onClick={(e) => e.stopPropagation()} className="shrink-0" style={{ lineHeight: 0 }}>
                <ToggleCheckbox checked={marked.includes(ins.id)} onChange={() => onMark(ins.id)} />
              </span>
              <span className="kol-helper-10 text-meta shrink-0">{i + 1}</span>
              <span className="truncate flex-1 min-w-0">{ins.text || '—'}</span>
              {tag && <span className="shrink-0 kol-helper-10 text-meta">grp {tag}</span>}
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
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <EditorButton variant="secondary" size="sm" disabled={marked.length < 2} onClick={onGroup}>
          Group
        </EditorButton>
        <EditorButton variant="secondary" size="sm" disabled={!marked.length} onClick={onUngroup}>
          Ungroup
        </EditorButton>
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
 * element. Writes go through the panel's writeKnob (motion-stack retarget +
 * group fan-out + the knob's pure comp transform); palette refs resolve to
 * literal hex at write time — the SVG engine paints raw fill strings (same
 * trade-off as "Edit in Pattern mode"). min/max resolve via knobRange (the
 * VF axis knobs track the instance font's real fvar range). */
function KineticKnob({ knob: k, comp, idx, palette, onWrite }) {
  const value = k.get(comp, idx)
  const write = (v) => onWrite(k, v)
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
  const { min, max } = knobRange(k, comp, idx)
  return (
    <LabeledControl label={k.label}>
      <Slider min={min} max={max} step={k.step ?? 1} value={typeof value === 'number' ? value : min} onChange={write} />
    </LabeledControl>
  )
}

/* MotionStack — the motion-layer selector (labs MotionControls' stack model):
 * segment per layer (1 = the primary `motion`, 2.. = the `motions` extras),
 * plus add/remove. The single-motion knobs below edit the selected layer. */
function MotionStack({ motions, mIdx, onSelect, onAdd, onRemove }) {
  const options = [
    { value: '0', label: '1' },
    ...motions.map((_, i) => ({ value: String(i + 1), label: String(i + 2) })),
  ]
  return (
    <div className="flex flex-col gap-1">
      <span className="kol-helper-10 text-meta">Motion layers</span>
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <SegmentedToggle value={String(mIdx)} onChange={(v) => onSelect(Number(v))} options={options} />
        </div>
        <EditorButton
          variant="ghost" size="sm" quiet iconOnly="plus" iconSize={12}
          aria-label="Add motion layer" title="Add motion layer" onClick={onAdd}
        />
        <EditorButton
          variant="ghost" size="sm" quiet iconOnly="close" iconSize={10}
          aria-label="Remove motion layer" title="Remove motion layer (the primary can only be set to None)"
          disabled={mIdx === 0} onClick={onRemove}
        />
      </div>
    </div>
  )
}

/* OpenTypeMenu — multi-select stay-open popover over OPENTYPE_FEATURES (the
 * labs OpenTypeMenu, ported onto the editor's kol-component Popover). One row
 * per feature with a check when on; clicking toggles and keeps the menu open
 * (no single-pick close); the trigger shows the active count. */
function OpenTypeMenu({ value = {}, onToggle }) {
  const [open, setOpen] = useState(false)
  const popover = usePopover({
    open, onOpenChange: setOpen,
    placement: 'bottom-start', offset: -1, flip: false, matchReferenceWidth: true, role: 'listbox',
  })
  const count = OPENTYPE_FEATURES.filter((f) => value[f.tag]).length

  return (
    <div className="relative w-full">
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        type="button"
        className="w-full flex items-center justify-between kol-helper-12 rounded"
        style={{
          border: '1px solid transparent',
          borderRadius: open ? '4px 4px 0 0' : '4px',
          backgroundColor: 'var(--kol-surface-secondary)',
          color: 'var(--kol-surface-on-primary)',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{count ? `${count} feature${count > 1 ? 's' : ''}` : 'None'}</span>
        <EditorIcon
          name="chevron-down" size={10} className="ml-auto"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms' }}
        />
      </button>
      <PopoverPanel
        popover={popover}
        panel={false}
        focus={false}
        style={{ backgroundColor: 'var(--kol-surface-secondary)', color: 'var(--kol-surface-on-primary)', borderRadius: '0 0 4px 4px', zIndex: 200 }}
      >
        <div className="flex max-h-[300px] flex-col items-stretch overflow-y-auto" role="listbox">
          {OPENTYPE_FEATURES.map((f) => (
            <MenuDropdownItem
              key={f.tag}
              onClick={() => onToggle(f.tag, !value[f.tag])}
              shortcut={value[f.tag] ? <EditorIcon name="check" size={11} /> : undefined}
            >
              {f.label}
            </MenuDropdownItem>
          ))}
        </div>
      </PopoverPanel>
    </div>
  )
}

/* CustomPathPoints — the labs CustomPathEditor as a rail mini editor: the
 * custom arrangement's normalized control points in a frame-proportioned box
 * (aspect = the layer's w:h), draggable handles + add/remove (labs
 * PathControls' Points actions). The preview curve is the same Catmull-Rom
 * build the engine walks (buildPath 'custom'). */
function CustomPathPoints({ inst, layer, onPoints }) {
  const boxRef = useRef(null)
  const drag = useRef(null)
  const stored = inst?.path?.points
  const points = Array.isArray(stored) && stored.length >= 2 ? stored : DEFAULT_POINTS
  const ratio = layer.w > 0 && layer.h > 0 ? layer.w / layer.h : 1
  const d = buildPath('custom', 100, 100, { points }).d

  const onDown = (i) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { i }
  }
  const onMove = (e) => {
    const dg = drag.current
    const box = boxRef.current
    if (!dg || !box) return
    const r = box.getBoundingClientRect()
    if (!r.width || !r.height) return
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    const ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
    onPoints(points.map((p, k) => (k === dg.i ? [Number(nx.toFixed(3)), Number(ny.toFixed(3))] : p)))
  }
  const onUp = (e) => { drag.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ } }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={boxRef}
        className="relative w-full rounded border border-fg-08 overflow-hidden"
        style={{ aspectRatio: `${ratio}` }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={d} fill="none" stroke="var(--kol-accent-primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <div
            key={i}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="absolute cursor-grab rounded-full"
            style={{
              left: `${p[0] * 100}%`, top: `${p[1] * 100}%`,
              width: 12, height: 12, marginLeft: -6, marginTop: -6,
              background: 'var(--kol-accent-primary)',
              border: '2px solid white',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <EditorButton variant="secondary" size="sm" onClick={() => onPoints([...points, [0.5, 0.5]])}>
          Add point
        </EditorButton>
        <EditorButton variant="secondary" size="sm" disabled={points.length <= 2} onClick={() => onPoints(points.slice(0, -1))}>
          Remove point
        </EditorButton>
      </div>
    </div>
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
