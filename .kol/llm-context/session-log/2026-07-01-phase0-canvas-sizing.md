# Session: Phase 0 — canvas sizing + grid toggle

**Date:** 2026-07-01
**Agent:** Grim (Claude Opus)
**Summary:** First build of the future roadmap (`../plan.md` Phase 0). Real pixel canvas dimensions (presets + custom W×H) and a show/hide grid toggle. `pnpm build` green.

## Design
- **1080-virtual coordinate space is unchanged** — layers, snap, rulers, overlays all still author in 1080-wide space (zero ripple). `canvasW`/`canvasH` are real output pixels that drive only the frame RATIO (`canvasW/canvasH`) and the export resolution.
- **One write path, no ratio drift:** presets (`setAspect`) set aspect label + W/H from `PRESET_SIZES`; custom `setCanvasSize(w,h)` writes W/H + flips aspect to `custom`. `canvasRatio` is derived.

## Changes Made
- `shell/aspects.js` — `PRESET_SIZES` (px per preset: 1:1 1080², 4:5 1080×1350, 9:16 1080×1920, 5:4 1350×1080, 16:9 1920×1080).
- `compose/state.jsx` — `canvasW`/`canvasH`/`canvasRatio`, smart `setAspect` (preset→dims) + `setCanvasSize`, `showGrid`/`toggleGrid`. Persisted in draft + presets; load uses raw setters so saved custom dims survive (don't snap to preset table).
- `compose/CanvasArea.jsx` — `viewH` from `canvasRatio` (was ASPECTS lookup); passes `customRatio` + `showGrid` to `<Canvas>`. Dropped now-unused ASPECTS import.
- `shell/Canvas.jsx` — `showGrid` prop threaded to `PanZoomViewport`; grid `<div>` gated on it.
- `compose/inspectors/CanvasInspector.jsx` — rewrote: Size preset dropdown, W×H fields (commit on blur/Enter, not per-keystroke), Grid visible/hidden toggle, + existing background/opacity.
- `compose/build.js` — `buildLayersSvg` takes `canvasW`/`canvasH`: viewBox stays virtual (1080×virtualH), SVG width/height = real px, so export scales geometry without touching coords.
- `shell/MenuTop.jsx` — export/save carry `canvasW`/`canvasH`; **PNG export scale 2→1** (canvas now carries real px; user bumps dimensions for higher res instead of a hidden 2×). Filename uses dims.

## Notes / follow-ups
- Aspect presets now live in BOTH the topbar Canvas menu and the inspector Size dropdown — acceptable (shared single-write-path state, no drift), but it's two surfaces if a future cleanup wants one.
- Custom W/H uses the 1080-virtual space internally regardless of set size (e.g. a 400×400 canvas still authors at 1080 and downscales on export) — fine for now; a fully-variable virtual space is the bigger refactor the plan flagged.

## Next Steps
1. Per user: read the effects repo to evaluate implementation (render-fork RFC audit — per-layer vs full-frame).
2. Phase 1 spine (param schema + registry seam) is the next real build; resolve the param-graph RFC open questions first.
