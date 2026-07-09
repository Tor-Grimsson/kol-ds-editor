# Session: Export docs split + new persistence section + File-tab rename

**Date:** 2026-07-08
**Agent:** Grim (Opus 4.8) + 2 Explore agents
**Summary:** Diagnosed the export docs as a spec-not-a-walkthrough, split `08-export` from a monolith INDEX into a proper index + 6 sub-docs (adding the click-to-file flow and the three-clocks model), created a new `11-persistence` section owning the previously-scattered document/storage surface, and renamed the misleading "Save/Load settings" footer buttons.

## Changes Made

### Investigation
- Two Explore agents mapped the full file-management I/O surface: (1) code inventory — every upload/drag-drop/webcam/fetch IN point, every download/clipboard/MediaRecorder OUT point, and all 5 localStorage keys + IndexedDB clip store; (2) doc-coverage audit across all 33 doc files. Findings: export-render + media-in were well covered; the **whole-document persistence axis** (draft autosave, `.json` project file, appSettings, theme) had no owner, and the saved-preset library was mis-housed inside `09-media`.

### Files Modified — source
- `src/editor/shell/panels/EditorFooter.jsx` — renamed the File-tab buttons **"Save settings" → "Save to file"**, **"Load settings" → "Load from file"** (they save/load the whole document as `.json`, not app settings); updated the lane comment `settings .json` → `document .json`. Handler names (`onSaveSettings`/`onLoadSettings`) and component (`SettingsFileTab`) left as internal names.

### Files Modified — docs
- `docs/documentation/08-export/` — INDEX rewritten to `type: index` (overview + one-line model + sections table + where-it-surfaces). Content moved into **6 new sub-docs**: `01-pipeline` (the no-live-canvas flow, `build.js` builder, `download.js`), `02-sizing` (aspect + `@Nx`), `03-formats` (PNG/SVG/webm bake), `04-batch-and-record`, `05-clocks` (the three clocks — animate vs. freeze, Export-loop-vs-Record), `06-parity`.
- `docs/documentation/11-persistence/` — **new section**: INDEX (`type: index`, the master storage-key map) + `01-draft-autosave`, `02-project-files` (the `.json` format, `buildSpec`, the `{page,version,spec}` envelope), `03-saved-library` (LibraryProvider, rehomed from 09-media), `04-app-settings` (`kol-editor-settings` + `kol-editor-theme`, the loop-palette-vs-UI-theme gotcha).
- `docs/documentation/INDEX.md` — added section 11 row + description.
- `docs/documentation/09-media/INDEX.md` — saved-preset section reduced to a stub → `11-persistence/03`; frontmatter covers/related updated; clip + source-map cross-links.
- `docs/documentation/02-layers/INDEX.md` — draft paragraph points to the persistence owner; `related` += persistence.
- `docs/documentation/06-camera-motion/INDEX.md` — reciprocal `related` → export.

### Features
- New docs answer "how does export actually work" (the 6-step flow) and "why does my video/sim freeze on export but a keyframed loop doesn't" (the three-clocks model), which the old spec-shaped INDEX never surfaced.

## Current State

### Working
- All wikilinks in authored/edited docs resolve (validated across 16 files via script). Numbering contiguous 00–11; every folder has an INDEX; both new INDEXes are `type: index`.
- Source rename is label-only (2 strings + 1 comment) — no behavior change. Not build-tested (trivial JSX text edit; HMR catches).

### Known Issues (discovered, NOT fixed)
- `deleteClip` (`lib/clipStore.js`) is exported but never called → uploaded/dropped video Blobs accumulate in IndexedDB forever, even after their layer is deleted (storage leak).
- `downloadSvg` in `modes/pattern/render.js` and `modes/type/buildTypeSvg.js` — dead exports, no call sites.
- `onSaveSettings`/`onLoadSettings`/`SettingsFileTab` still carry the "settings" name internally (user-facing labels fixed; internal rename deferred as cosmetic).
- Docs deliberately NOT split for: clipboard writes (copy CSS / copy URL) and audio ingest (mic + audio-file) — too thin to earn files.

## Next Steps
1. User visual check of the renamed File-tab buttons.
2. If desired, fix the two code smells (wire `deleteClip` on layer-delete; remove dead `downloadSvg` exports).
3. Optional: rename the internal `onSaveSettings`/`SettingsFileTab` handlers/component for code-level coherence.
</content>
