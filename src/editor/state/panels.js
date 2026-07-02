/**
 * Panel registry helpers.
 *
 * A mode registry is `{ canvas: ReactComponent, panels: PanelEntry[] }`
 * where PanelEntry is `{ slot, order, Component }`. Valid slots are
 * 'left.header' | 'left.body' | 'left.footer' | 'right.header' |
 * 'right.body' | 'right.footer' | 'canvas.header'. `*.footer` pins to the
 * bottom of its rail, outside the scrolling body (used for the transport).
 * `canvas.header` renders as a sub-bar above the main canvas — the tool
 * palette. `canvas.footer` renders below the canvas — the timeline dock.
 *
 * Future: state-level overrides (drag-to-rearrange UI) will live in this
 * module. For v1, the registry is the only source of truth — defaults
 * ship as-is.
 */

export const SLOTS = ['left.header', 'left.body', 'left.footer', 'right.header', 'right.body', 'right.footer', 'canvas.header', 'canvas.footer']

export function panelsForSlot(panels, slot) {
  return (panels ?? [])
    .filter((p) => p.slot === slot)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
