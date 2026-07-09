import { useComposeState } from '../state'
import { groupById, presetsInGroup, presetParams } from '../../../loops/registry'
import { PICKER_TREE, LEGACY_GROUP_LABELS } from '../../../loops/taxonomy'
import { PickerRow, PickerDropdown } from './TreePicker'

/**
 * LoopPicker — the app hierarchy (METHOD > TYPE > CATEGORY > PRESET, see
 * docs/documentation/01-hierarchy.md) over the loop registry, shared by
 * the Inspector and Parameters panels so the two can't drift:
 *
 *   Type     — Scanline · Pattern · Loops · … · 3D Scene, plus a second
 *              dropdown when the type spans several registry groups
 *              (Loops → Simple/Field/Pattern Loops, 3D Scene →
 *              Primitive/Ribbon/Forms/Environment/Abstract)
 *   Category — the type's sub buckets (Scanline → Spaced/Glyph/…)
 *   Preset   — plain preset names (Drift/Fine/…)
 *
 * Picking at any level resets the loop's params to the target preset's
 * full set (labs semantic — a preset is a curated starting point, not a
 * patch); type/group/category hops land on their first preset.
 *
 * `tree` defaults to the Generative types; the misc layer passes MISC_TREE.
 * A layer whose group lives OUTSIDE the tree (legacy optic/paratype loop
 * layers) shows its identity read-only instead — those groups are not
 * pickable generative types (optic → EFFECTS > Pattern, paratype → misc).
 */
export function LoopPicker({ layer, tree = PICKER_TREE }) {
  const { updateLayer } = useComposeState()
  const group = layer.loopGroup ?? 'shape'
  const parent = tree.find((t) => t.groups.includes(group)) ?? null
  const presets = presetsInGroup(group)
  const current = presets.find((p) => p.id === layer.presetId)
  const subs = [...new Set(presets.map((p) => p.sub).filter(Boolean))]
  const sub = current?.sub ?? subs[0]
  const subPresets = subs.length ? presets.filter((p) => p.sub === sub) : presets

  const applyPreset = (preset, g = group) => {
    if (!preset) return
    updateLayer(layer.id, {
      loopGroup:   g,
      presetId:    preset.id,
      presetLabel: preset.label,
      loopId:      preset.loop,
      /* A preset is a full param reset — the motion Frame/Form quick-select
       * dropdowns (ParametersPanel) no longer describe it (labs applyPreset
       * convention). */
      _framePreset: 'custom',
      _formPreset:  'custom',
      _lookPreset:  'custom',
      ...presetParams(preset),
    })
  }
  const onParent = (label) => {
    const t = tree.find((x) => x.label === label)
    if (t) applyPreset(presetsInGroup(t.groups[0])[0], t.groups[0])
  }
  const onGroup = (g) => applyPreset(presetsInGroup(g)[0], g)
  const onSub = (s) => applyPreset(presets.find((p) => p.sub === s))

  return (
    <>
      {tree.length > 1 || !parent ? (
        <PickerRow label="Type">
          <div className="flex flex-col gap-1">
            {parent ? (
              <PickerDropdown
                options={tree.map((t) => ({ value: t.label, label: t.label }))}
                value={parent.label}
                onChange={onParent}
              />
            ) : (
              <span className="kol-helper-12 text-meta px-1">
                {LEGACY_GROUP_LABELS[group] ?? groupById(group).label}
              </span>
            )}
            {parent && parent.groups.length > 1 && (
              <PickerDropdown
                options={parent.groups.map((gid) => ({ value: gid, label: parent.labels?.[gid] ?? groupById(gid).label }))}
                value={group}
                onChange={onGroup}
              />
            )}
          </div>
        </PickerRow>
      ) : null}
      {subs.length > 1 && (
        <PickerRow
          label="Category"
          options={subs.map((s) => ({ value: s, label: s }))}
          value={sub}
          onChange={onSub}
        />
      )}
      <PickerRow
        label="Preset"
        options={subPresets.map((p) => ({ value: p.id, label: p.label }))}
        value={layer.presetId}
        onChange={(id) => applyPreset(presets.find((p) => p.id === id))}
      />
    </>
  )
}
