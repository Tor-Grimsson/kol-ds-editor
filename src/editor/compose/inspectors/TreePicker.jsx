import { Dropdown, LabeledControl } from '@kolkrabbi/kol-component'

/* PickerDropdown — the picker stack's dropdown styling (subtle / sm /
 * full-width), shared so every level of every picker renders identically. */
export function PickerDropdown(props) {
  return <Dropdown variant="subtle" size="sm" className="w-full" {...props} />
}

/* PickerRow — one labeled level of a picker stack. `children` replaces the
 * default dropdown for rows with custom content (LoopPicker's grouped Type
 * row, read-only legacy labels). */
export function PickerRow({ label, options, value, onChange, children }) {
  return (
    <LabeledControl label={label}>
      {children ?? <PickerDropdown options={options} value={value} onChange={onChange} />}
    </LabeledControl>
  )
}

/**
 * TreePicker — the generic TYPE > CATEGORY > PRESET dropdown stack
 * (docs/documentation/01-hierarchy.md) over a flat preset catalog:
 *
 *   tree    — [{ label, subs }] types; the Type dropdown uses the label as
 *             its value (the taxonomies carry no separate type ids)
 *   presets — flat [{ id, label, sub }] catalog
 *   current — the active preset object
 *   onPick  — (preset) => void; type/category hops land on the target's
 *             first preset (preset semantics: a curated starting point,
 *             not a patch)
 *
 * LoopPicker's registry-backed picker shares PickerRow / PickerDropdown but
 * keeps its own logic — its hierarchy has an extra registry-group level plus
 * a read-only legacy fallback that don't fit this flat shape.
 */
export function TreePicker({ tree, presets, current, onPick }) {
  const type = tree.find((t) => t.subs.includes(current.sub)) ?? tree[0]
  const subPresets = presets.filter((p) => p.sub === current.sub)
  const firstOf = (sub) => presets.find((p) => p.sub === sub)

  return (
    <>
      <PickerRow
        label="Type"
        options={tree.map((t) => ({ value: t.label, label: t.label }))}
        value={type.label}
        onChange={(label) => {
          const t = tree.find((x) => x.label === label)
          if (t) onPick(firstOf(t.subs[0]))
        }}
      />
      <PickerRow
        label="Category"
        options={type.subs.map((s) => ({ value: s, label: s }))}
        value={current.sub}
        onChange={(s) => onPick(firstOf(s))}
      />
      <PickerRow
        label="Preset"
        options={subPresets.map((p) => ({ value: p.id, label: p.label }))}
        value={current.id}
        onChange={(id) => onPick(presets.find((p) => p.id === id))}
      />
    </>
  )
}
