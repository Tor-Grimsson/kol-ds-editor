# Session: layers panel TLC

**Date:** 2026-07-03 (eighteenth run)
**Agent:** Grim (Fable 5)
**Summary:** The approved four-point layers-panel plan, applied.

## Changes made

- **+ moved into the Layers/Assets tab row** (right-aligned, Layers tab only) — `AddLayerButton` exported from `LayerStack.jsx`, self-sources `addLayer`; rendered by `LayersAssetsPanel.jsx`.
- **Floating trash removed** — Del/Backspace (CanvasArea keymap) covers delete. The stack footer now renders ONLY while ≥2 layers are selected (the Group button); otherwise no footer bar at all.
- **Empty-state hint** under the Canvas row when the stack is empty: "Add a layer with + or the Generative menu."
- **Canvas row density** — `kol-mono-12` → `kol-helper-12`, matching every layer row.

`pnpm build` green.
