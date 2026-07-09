# Session: mobile generative chrome + persistDraft opt-out + KOL package bump

**Date:** 2026-07-08
**Agent:** Grim (Fable 5)
**Summary:** Built the mobile/tablet generative chrome (device-gated, randomize-only playground over the same engine), root-caused the persistent 1:1 bug to the provider-level draft restore (new `persistDraft={false}` opt-out, also applied to OutputView), and bumped the four KOL packages. Aspect 4:5 user-confirmed on device; UI to be reworked fresh next session.

## Changes Made

### Files Modified
- `package.json` / `pnpm-lock.yaml` — KOL bump: kol-component 0.4.0, kol-framework 0.2.1, kol-loader 0.3.0, kol-theme 0.3.0. Both builds green.
- `src/App.jsx` — view gate: `?view=output` → OutputView · `?view=desktop`/`?view=mobile` force a chrome (mobile clears the tablet flag) · touch-primary (coarse pointer + touch) → MobileView · else Editor.
- `src/editor/mobile/device.js` — NEW. Coarse-pointer/touch detection, tablet line (shortest screen side ≥600px), persisted "use desktop" opt-in (`kol-editor:mobile-use-desktop`).
- `src/editor/mobile/MobileView.jsx` — NEW. `EditorProviders persistDraft={false}` + `OutputStage`; screens: entry (Insert media / Generate / tablet desktop link) → category (`GENERATIVE_TREE` buttons) → live. Boot effect `setAspect('4:5')` (provider inits aspect '4:5' but W/H 1080×1080 — desktop reconciles in EditorBody; mobile must too). Insert = full-bleed cover photo/video layer (video via clipStore); Start over frees clips per-layer via `removeLayer`.
- `src/editor/mobile/MobileOverlay.jsx` — NEW. One floating translucent modal (DS color-mix surface idiom, `var(--kol-radius-sm)`, hairlines `--kol-fg-16`), collapsible to a single pill. Sections: transport (Play/Pause + tempo = `transport.setLoopSeconds` halve/double 0.5–32s) · randomize (inspector's exact `computeRoll` plumbing, "Randomize all" + 2-col scope grid) · Preset ⚄ / Generator · Download (@2x PNG) / Hide UI (blank-all for screen-record, tap to reshow) / Start over. All `EditorButton variant="primary"` — one family.
- `src/editor/compose/state.jsx` — **`ComposeStateProvider` gets `persistDraft = true` prop.** `false` opts out of the whole draft surface: no restore prompt, no `kol.editor.draft` read/write/delete, no load-time `gcClips` (autosave gate `restoreResolvedRef` never opens).
- `src/editor/Editor.jsx` — `EditorProviders` passes `persistDraft` through.
- `src/editor/OutputView.jsx` — `OutputStage` exported (mobile reuses it); OutputView mounts with `persistDraft={false}` (same latent bug: the output tab could prompt-restore/autosave over the live draft); passes `gutter={0}`.
- `src/editor/shell/Canvas.jsx` — new `gutter = 48` prop on the letterbox (was hard-coded); OutputStage passes 0 → frame edge-to-edge.
- `docs/documentation/00-overview/INDEX.md` — App.jsx gate rows + `src/editor/mobile/` key-files row.
- `docs/documentation/11-persistence/01-draft-autosave.md` — new "Ephemeral sessions — persistDraft" section.

### Features Added/Removed
- **Mobile generative chrome** — phones locked to it; tablets get a persisted "Use desktop editor" opt-in (`?view=mobile` is the way back).
- **persistDraft opt-out** — ephemeral mounts can no longer restore/delete/overwrite the desktop draft or mis-GC clips.

## Current State

### Working
- **4:5 user-confirmed on device.** Frame measured 0.800 exact via driven browser (Playwright, 390×844); layer fills frame; no restore prompt on mobile.
- Both builds green. Desktop untouched behaviorally (persistDraft defaults true).

### Known Issues
- **The 1:1 saga's real root cause** (for the record): provider-level draft restore re-applied the old square doc over mobile's `setAspect` boot every load. Fixed via persistDraft. Two earlier wrong theories (stale HMR state, phone cache) cost the session real time — the lesson: drive the browser before claiming.
- **kol-theme 0.3.0 dropped `kol-helper-11`** (only `kol-helper-12` ships). Desktop inspector (ParametersPanel a.o.) still uses it — those labels silently render at 16px default since the bump. Needs a user call: repo-wide sweep to `kol-helper-12` vs DS-side restore of the class.
- **Mobile UI itself is disliked** — user verdict after live check: layout/hierarchy a mess even on DS atoms (mixed light/dark reads, 11-button wall). Full fresh rework queued as the immediate next task; treat current MobileOverlay as scaffolding, not a keeper.
- Mobile video insert unverified on device (geometry says full-bleed cover works post-fix; user hasn't retested).
- Tempo readout formats as raw number (`0.5s`); fine for now.

## Next Steps
1. **UI rework of the mobile chrome, fresh** — user-led; expect a proper design pass over the modal (grouping, sizing, theme) rather than more patching.
2. User decision on the `kol-helper-11` regression (sweep vs DS fix).
3. Mobile video retest on device once the UI settles.
