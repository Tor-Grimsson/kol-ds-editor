# Session: infinite canvas + bezier vector editor (on the DOM/SVG base)

**Date:** 2026-07-01
**Agent:** Grim (Claude Opus)
**Summary:** Resolved the OPEN engine decision (ARCHITECTURE §4) — **do NOT adopt kol-editor's Konva engine**; grew an infinite canvas (pan/zoom/ruler) and a real cubic-bezier vector editor (pen + node/handle editing) directly on the current DOM/SVG base, plus inspector fixes. All additive, no UI bulldoze. `pnpm build` green.

## Changes Made

### Engine decision (resolves §4 / roadmap #1)
Mapped both codebases before touching anything. Verdict: porting from kol-editor buys almost nothing — its "infinite canvas" is ~20 lines of Konva `stage.scale/position` (re-implement, not liftable onto DOM), and its "node editing" is anchor-drag on **linear** paths (no bezier at all). The bezier work had to be built from scratch either way, so adopting Konva would only re-trigger the 2026-07-01 UI-bulldoze for zero real gain. Chose to grow both features on the DOM/SVG base.

### Files Modified
- `src/editor/shell/Canvas.jsx` — `PanViewport` → `PanZoomViewport`: added zoom (Cmd/Ctrl+wheel & pinch at pointer, ⌘0 reset, ⌘±), two-finger pan, zoom-% readout, and `CanvasRuler` (top+left rulers in virtual px, reads the tagged `[data-canvas-frame]` rect so ticks track pan/zoom). Tagged the frame div.
- `src/editor/compose/CanvasArea.jsx` — pen tool gesture (click=corner, click-drag=curve, click-first=close, Enter=finish, Esc=cancel), node-edit entry (dbl-click / `A`), overlays + pen preview, keyboard cases.
- `src/editor/compose/LayerRenderer.jsx` — new `path` render branch (inline `<svg><path>`, overflow-visible, scales with canvas transform).
- `src/editor/compose/state.jsx` — `path` added to `COLOR_LAYER_TYPES` + `POSITIONED_TYPES` + `layerDefaults`.
- `src/editor/state/tools.jsx` + `state/keymap.js` — pen tool; shortcuts **P**=pen, **V**=shape-select (exits node mode), **A**=edit nodes. Pattern lost its `P` (toolbar-only now).
- `src/editor/shell/panels/ToolPalette.jsx` — pen button; `icons/svg/tool-pen.svg` (new nib glyph).
- `src/editor/compose/inspectors/LayerInspector.jsx` — X/Y/W/H labels moved **outside** the inputs (`AxisField`), lock toggle inline; `path` added to fill/stroke controls.
- `src/editor/compose/inspectors/CanvasInspector.jsx` + `InspectorRail.jsx` — canvas info (aspect + `1080×H`) + **Background** hex; canvas inspector is now the default empty-selection view.

### Files Added
- `src/editor/compose/path-math.js` — pure geometry (`pathD`, `pathBounds`, `normalizePath`, `dist`) + DEV self-check.
- `src/editor/compose/PathNodeOverlay.jsx` — node/handle editing chrome (drag anchor, drag handle w/ mirror, **Alt-drag anchor = extract handles on corners/endpoints**, Del removes node, Esc exits).

### Features Added
- Infinite canvas: pointer-anchored zoom, trackpad pan, zoom readout, live rulers.
- Vector `path` layer: pen authoring with real cubic handles + full node/handle editing — strictly more than kol-editor had.

## Current State

### Working
- Both features build clean (`pnpm build`, 2532 modules, 0 errors — only the pre-existing 7 MB-chunk warning). Chrome untouched; every existing tool/panel intact.
- Coordinate seam validated: `CanvasArea` reads a fresh post-transform rect, so all drag/select/create math stays 1:1 at any zoom with zero changes.

### Known Issues
- Pattern tool has no keyboard shortcut now (P reassigned to pen) — toolbar only.
- Node overlay chrome scales with zoom (matches existing `SelectionOverlay`, not screen-constant).
- Ruler labels lag ~120ms behind smooth keyboard-zoom (transform transition); instant on wheel/pinch.
- Pre-existing: not a git repo; palette swatches resolve to cream-500; 28 chevron-down icon warnings.

## Next Steps
1. **Shape-editor parity — remaining gaps:** mid-segment node insertion, corner↔smooth toggle, path bbox-resize (scales nodes), flatten, export-settings UI.
2. `git init` + initial commit (still no safety net).
3. Optional: rebind pattern to a free key; tighten path bbox to true curve extent.
