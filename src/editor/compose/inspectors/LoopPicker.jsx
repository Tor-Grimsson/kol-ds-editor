import { Dropdown, LabeledControl } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { groupById, presetsInGroup, presetParams } from '../../../loops/registry'
import { PICKER_TREE } from '../../../loops/taxonomy'

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
 */
export function LoopPicker({ layer }) {
  const { updateLayer } = useComposeState()
  const group = layer.loopGroup ?? 'shape'
  const parent = PICKER_TREE.find((t) => t.groups.includes(group)) ?? PICKER_TREE[0]
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
      ...presetParams(preset),
    })
  }
  const onParent = (label) => {
    const t = PICKER_TREE.find((x) => x.label === label)
    if (t) applyPreset(presetsInGroup(t.groups[0])[0], t.groups[0])
  }
  const onGroup = (g) => applyPreset(presetsInGroup(g)[0], g)
  const onSub = (s) => applyPreset(presets.find((p) => p.sub === s))

  return (
    <>
      <LabeledControl label="Type">
        <div className="flex flex-col gap-1">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={PICKER_TREE.map((t) => ({ value: t.label, label: t.label }))}
            value={parent.label}
            onChange={onParent}
          />
          {parent.groups.length > 1 && (
            <Dropdown
              variant="subtle" size="sm" className="w-full"
              options={parent.groups.map((gid) => ({ value: gid, label: parent.labels?.[gid] ?? groupById(gid).label }))}
              value={group}
              onChange={onGroup}
            />
          )}
        </div>
      </LabeledControl>
      {subs.length > 1 && (
        <LabeledControl label="Category">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={subs.map((s) => ({ value: s, label: s }))}
            value={sub}
            onChange={onSub}
          />
        </LabeledControl>
      )}
      <LabeledControl label="Preset">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={subPresets.map((p) => ({ value: p.id, label: p.label }))}
          value={layer.presetId}
          onChange={(id) => applyPreset(presets.find((p) => p.id === id))}
        />
      </LabeledControl>
    </>
  )
}
