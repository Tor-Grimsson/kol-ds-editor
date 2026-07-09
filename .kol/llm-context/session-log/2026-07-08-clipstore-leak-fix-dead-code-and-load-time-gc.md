# Session: clipStore leak fix + dead-code removal + load-time clip GC

**Date:** 2026-07-08
**Agent:** Grim (Opus 4.8)
**Summary:** Closed the IndexedDB video-clip leak two ways — per-delete cleanup in `removeLayer` plus a load-time `gcClips` that reclaims every orphan vector — and removed the two dead `downloadSvg` exports after confirming the real SVG-download path.

## Changes Made

### Files Modified
- `src/editor/lib/clipStore.js` — added `gcClips(layers)`: `getAllKeys()` over the store, keep the ids owned by `blob:`-video layers in the tree (reuses `deadClipIds`), delete the rest in one txn; silent no-op on storage failure. Gated behind `indexedDB.databases()` so it returns before `open()` when the clips DB doesn't exist — no empty-DB creation for never-video users (old Firefox lacks the API and falls through to prior behavior).
- `src/editor/compose/state.jsx` — (1) `removeLayer` now collects video-layer ids in the removed subtree (`collectVideoClipIds`, reads `layersRef.current`) and calls `deleteClip` on each, so deleting a video — or a group/bool wrapping one — frees its Blob; (2) the draft-restore effect routes every branch through one `resolve(finalLayers)` helper that opens autosave **and** runs `gcClips(finalLayers)`, keyed to the settled layer set. Branch 1 (localStorage `getItem` throws) deliberately skips the GC.
- `src/editor/modes/pattern/render.js` + `src/editor/modes/type/buildTypeSvg.js` — removed the dead `downloadSvg` exports (zero call sites) and their now-orphaned `downloadBlob` imports; both files keep their live exports (`buildPatternSvg` / `computeFrameGlyphs`).
- `docs/documentation/09-media/INDEX.md` — clip-function table now lists `deleteClip` (wired on delete) + `gcClips` (load-time reclaim).
- `docs/documentation/11-persistence/01-draft-autosave.md` — restore section documents the `resolve()`/`gcClips` reclaim and the localStorage-unreachable exception.

### Features Added/Removed
- **Video-clip leak closed.** Per-delete `deleteClip` (immediate, common path) + load-time `gcClips` (backstop) together reclaim clips orphaned by delete, File→New, Clear, a crash, or a declined restore. The earlier delete→undo→reload edge is also covered (on reload the draft holds the undone-back layer → the accepted branch keeps its clip).
- **Removed** two dead `downloadSvg` helpers. Confirmed SVG vector downloads via `onExportSvg` → `build.js` `downloadComposeSvg` (whole-frame serialize), fired from Export SVG in the top menu.

## Current State

### Working
- All delete paths route through `removeLayer`; all restore branches (accepted/declined/no/bad/empty draft) route through `resolve` → GC. `downloadSvg` grep-clean, no orphaned `downloadBlob` imports.
- Label-only + additive-cleanup edits; not build-tested (HMR/Vite catches).

### Known Issues
- **Empty-DB churn — gated.** `gcClips` checks `indexedDB.databases()` and returns before `open()` when the clips DB is absent, so no empty DB is created. Residual: old Firefox lacks the API and still churns there; any pre-gate empty DB persists (harmless).
- GC deletes data and is **not unit-tested** (no IndexedDB harness); the keep-set (`deadClipIds`) is already exercised by `hydrateVideoClips`, and the orphan step is a plain set difference — verified by branch reasoning.
- Internal names `onSaveSettings`/`onLoadSettings`/`SettingsFileTab` still say "settings" (user labels fixed last session; internal rename still deferred as cosmetic).

## Next Steps
1. User live-check: delete a video layer, reload — confirm it's gone from IndexedDB; upload+reload still hydrates.
2. Optional cosmetic: rename the `onSaveSettings`/`SettingsFileTab` internals to match the "Save to file" labels.
</content>
