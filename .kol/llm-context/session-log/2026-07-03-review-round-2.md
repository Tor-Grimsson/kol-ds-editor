# Session: review round 2 — all nine items shipped

**Date:** 2026-07-03 (sixth run)
**Agent:** Grim (Claude Fable) + 2 builder agents
**Summary:** Second user-review sweep. Parameters tab rebuilt on the labs IA (Generate · Style · Animation + sections), layers panel overhauled, opacity digit shortcuts, engine bg toggles, ruler toggle + #666 trial, focus ring, locked-canvas-inert, swatch draft migration (the REAL fix). `pnpm build` green.

## Item-by-item
1. **Tab shift** — ParametersPanel now renders InspectorRail's exact skeleton (header row + `.kol-compose-inspector-body`); tabs no longer jump.
2. **Opacity** — value moved into the slider's own readout (%); **digit shortcuts**: 1–9 = 10–90%, 0 = 100%, 00 (within 500ms) = 0% — handled pre-keymap in CanvasArea (combos can't express ranges/chords); documented in the S overlay along with F and ⇧R.
3. **Loop bg + inspector exposure** — Background row now in the Inspector (and Parameters/Generate). **Engine loops joined**: scene3d/forms3d/environment/ribbon renderers are `alpha:true`, host swaps clear-alpha on `bgOn` (`def.bgToggle`); fullscreen-quad shaders (drift/iridescent/softforms/mesh) stay excluded — they paint every pixel. User's element-stack idea resolved to "effects as sections in one tab" (their own conclusion) — implemented as Generate/Style/Anim + effect tag-through.
4. **Parameters IA** — schema grammar gained `tab`/`section` metadata (labs' `tab:'color'` dialect honored); AutoControls filters by tab + renders section headers; every high-traffic schema tagged (shape/pattern/text, GL catalog, scanline exact-labs-parity, optic/math quick tags). Sub-tab strip Generate · Style · Animation, loop Category/Preset pinned above.
5. **Rulers** — ⇧R show/hide (persisted in draft, in S overlay); bar #666666 with darker ink (trial — easy to revert).
6. **Focus ring** — UA `:focus-visible` outline suppressed on editor inputs (Firefox double ring); DS border-reveal carries focus.
7. **Layers panel** — row = icon · name · hover-reveal eye/lock (forced visible when off/locked, accent lock); selected/hover states split; hidden dims name only; dbl-click inline rename → `layer.name` (undo-safe, survives save); deeper group indent. **Locked layers canvas-inert** (click falls through to stage; panel-only selection).
8. **Swatches** — real cause round 2: localStorage draft restored the collapsed (all-identical) palette saved under the phantom-token bug, overriding the fixed defaults. Restore now discards all-identical palettes → pool defaults (the six requested) show.
9. **Skip accountability** — two remaining honest gaps, now explicit scope items instead of buried: **File-tab "From library"** (needs an image-asset store; Assets tab is logo tiles only) and **Upload video** (needs video sources in the render/filter pipeline).

## Notes
- Group children can't be renamed yet (updateLayer is top-level only — state.jsx change, noted by the layers agent).
- Ruler #666 is a look-see; one-line revert to the light color-mix set.

## Next Steps
1. User review round 3.
2. Scoped-later: image-asset library + video sources, kinetic-type layer, pixi tier, GL-filter-on-any-layer.
