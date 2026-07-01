/**
 * Panel registry helpers.
 *
 * A mode registry is `{ canvas: ReactComponent, panels: PanelEntry[] }`
 * where PanelEntry is `{ slot, order, Component }`. Valid slots are
 * 'left.header' | 'left.body' | 'right.header' | 'right.body' |
 * 'canvas.header'. The `canvas.header` slot renders as a sub-bar above
 * the main canvas area, between the rails — used for the tool palette.
 *
 * Future: state-level overrides (drag-to-rearrange UI) will live in this
 * module. For v1, the registry is the only source of truth — defaults
 * ship as-is.
 */

export const SLOTS = ['left.header', 'left.body', 'right.header', 'right.body', 'canvas.header']

export function panelsForSlot(panels, slot) {
  return (panels ?? [])
    .filter((p) => p.slot === slot)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
