# Session: Themed canvas fills, infinite backdrop, ruler theming, grid default

**Date:** 2026-07-03
**Agent:** Grim
**Summary:** Canvas frame + infinite backdrop + rulers now flip with light/dark via DS tokens; added infinite-bg swatch and a None/Theme disable path; grid defaults hidden. Also bumped `@kolkrabbi/kol-component` + `kol-framework` to 0.1.2.

## Changes Made

### Package update
- `@kolkrabbi/kol-component` 0.1.1→0.1.2, `@kolkrabbi/kol-framework` 0.1.1→0.1.2 (pnpm, clean).

### Value convention (canvas fills)
One model threaded through every fill consumer:
- `null` = **None** (transparent / disabled).
- `var(--kol-*)` = **themed auto** (flips light/dark).
- hex / `palette:*` = **explicit**.

### Files Modified
- `src/editor/compose/state.jsx` — `showGrid` default `true`→`false`; `canvasFill` default `null`→`var(--kol-surface-absolute-split)` (#fff light / #000 dark); new `infiniteFill` state default `var(--kol-surface-secondary)` (+ context export, draft persist/hydrate, deps); paint-sync now maps a `var(...)` fill → null so the picker doesn't choke.
- `src/editor/compose/CanvasArea.jsx` — consumes `infiniteFill`, resolves `infiniteColor`, paints it on the stage wrapper `background`.
- `src/editor/compose/inspectors/CanvasInspector.jsx` — new **Infinite** ColorField; `autoValue` on both Background + Infinite.
- `src/editor/compose/inspectors/ColorField.jsx` — var-aware display (swatch renders the token, hex field blanks, subtitle "Theme"); popover gained **None** (→null) + **Theme** (→autoValue) buttons; new `autoValue` prop.
- `src/editor/shell/Canvas.jsx` — CanvasRuler chrome → `--kol-fg-08` bar, `fg-48/64` ticks/labels, `fg-16` border (was hardcoded #666 / bg-0 mixes).
- `src/editor/styles/kol-editor.css` — `.kol-editor-canvas` backdrop `#0E0E11`→`var(--kol-surface-secondary)`.
- `src/editor/color/ColourPanel.jsx` — eyedropper skips a `var(...)` canvasFill (can't be a 2D `fillStyle`).

### Features Added/Removed
- Infinite-canvas background is now user-controllable + theme-aware.
- ColorField can be disabled (None) and reset to themed (Theme) from the popover — previously clear was keyboard-only.
- Grid starts hidden.

## Current State

### Working
- `pnpm` install clean on 0.1.2. All edits HMR-safe; no build run (localized changes, user validates live).
- Theme flip (Settings → Theme) now flips frame fill, infinite backdrop, and rulers together.

### Known Issues
- Fill-opacity only applies to an explicit hex — a themed `var(...)` fill has no single hex to alpha, so opacity no-ops on the default (set a concrete color to dim).
- In-flight drafts saved before this session carry `canvasFill:null`, so they restore as None (transparent), not themed. Fresh canvases get the themed default.
- Eyedropper over the themed-auto bg samples transparent (→#000000) instead of the resolved token — layers sample fine.
- SVG ruler chrome relies on `var()` resolving in presentation attributes (same mechanism the prior color-mix values used — unchanged risk).

## Next Steps
1. User visual check across light/dark (frame, backdrop, rulers, grid-off default).
2. Deferred pool unchanged: Interfaces→Misc, multi-canvas/frame proposal, Tools→Layouts/Assets, dead-code sweep (registry/, mode bodies, PaletteInspector/PalettePanel).
