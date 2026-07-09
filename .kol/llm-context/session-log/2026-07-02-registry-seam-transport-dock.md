# Session: feature registry seam + transport docked in inspector

**Date:** 2026-07-02
**Agent:** Grim (Claude Opus)
**Summary:** Built the Phase 1 registry seam — the four modes now self-register a manifest that the shell reads instead of three hardcoded lists — and moved the motion transport out of the canvas corner into a pinned inspector footer with an `f`-toggled fps readout. `pnpm build` green.

## Registry seam (Phase 1 item 2)
- `src/editor/registry/features.js` — registry primitives (`registerFeature` / `getFeatures` / `getFeature`), a `Map` + manifest contract `{ id, title, Provider, Body, nav }`. Dev self-check.
- `src/editor/registry/modes.js` — the color modes packaged as the first features: importing it registers compose/palette/pattern/type (order = provider nesting order).
- **Editor.jsx** — killed `MODE_TITLES` + the `switch(mode)` dispatch + the hand-stacked provider tree. Provider stack is now `getFeatures().reduceRight(...)` (order-preserving), dispatch + title come from `getFeature(mode)`. Side-effect import of `./registry/modes`.
- **MenuTop.jsx** — dropped the hardcoded `MODES` const; Mode menu maps `getFeatures().filter(nav)` (computed at render, after registration).
- Net: one source of truth for modes; adding a feature = one `registerFeature({...})` call. The seam effects (Phase 3) plug into.

## Transport → inspector footer (labs EditorFooter port)
First attempt was a minimal chip — rejected against the labs reference; replaced with a faithful port of `kol-labs-single`'s `EditorFooter`/`RailFooterTabs`/`TransportBar`, built entirely from **published atoms** (no new SVGs, no new atoms):
- **`shell/panels/EditorFooter.jsx`** — tabbed footer `Transport · Output · File` (`SegmentedToggle` from kol-component), labs padding (16/20/24/20) + top divider. Transport stays mounted hidden on tab switch (labs pattern, keeps the `f` binding alive). Output = Export SVG/PNG; File = Save / Save as.
- **`params/TransportBar.jsx`** — labs layout: joined icon cells `[play|pause]` + centered ghost `Input` (`Loop / N s`) + `[stop|rewind]`. Icons = kol-loader's existing `play/pause/stop/rewind` (stroke/media). Stop = pause+seek(0), rewind = seek(0). `f` toggles a corner fps badge (`useFps` RAF, measures only while shown). Space NOT bound (Space = pan here, unlike labs).
- **`compose/useComposeFile.js`** — save/save-as/export handlers extracted OUT of MenuTop so topbar menu + footer share one implementation (MenuTop shrank ~40 lines).
- New **`right.footer` / `left.footer`** panel slots (`state/panels.js`; `EditorShell` Rail renders footer *outside* the scrolling `.kol-editor-rail-body`, so it pins). `.kol-editor-rail-footer { flex:0 0 auto }`. Compose registers `EditorFooter` at `right.footer` (compose-only). Removed the old floating `<TransportBar />` from CanvasArea.

## Notes / limits
- Transport is compose-only (motion is a compose feature); other modes' right rails have no footer.
- `f` toggle is self-contained (window keydown, input-guarded), not in the canvas keymap or ShortcutsOverlay yet.
- Footer Output tab is the natural future home of the roadmap's "export-settings UI" (aspect × scale panel like labs' ExportPanel).

## Next Steps
1. Phase 1 breadth: schema-ize pattern/text/photo inspectors (mechanical).
2. Phase 2: full timeline dock + per-field bind dots (the `renderAnimate` seam is ready).
3. Still no git repo.
