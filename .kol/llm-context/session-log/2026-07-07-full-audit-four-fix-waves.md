# Session: Full editor audit + four consecutive fix waves

**Date:** 2026-07-07
**Agent:** Grim (Fable 5) + 6 audit agents + 13 builder agents
**Summary:** Six-agent audit of all 49k lines (logic, consistency, improvements) produced 15 P1 bugs, ~25 P2s in six clusters, and a verified dead-code inventory — then four consecutive fix waves executed everything: all P1s, all P2 clusters, a 4,900-line dead-code sweep + packaging overhaul, and consolidation/perf. Both builds green.

## The audit (deduped highlights)

- Two findings independently confirmed by separate auditors: nested-child delete no-op, pattern-tile export phase shift.
- Verified clean: coordinate math, catalog referential integrity (435 presets validated mechanically), RAF/audio teardown, LayerStack drag math, morph contour handling.

## Wave 1 — 15 P1 bugs

- **state.jsx:** removeLayer now deep (junk-undo guarded); history restructured out of setState updaters (StrictMode-safe, via pastRef/futureRef + eager layersRef — bonus: multi-delete became undoable); draft autosave gated until restore prompt resolves (draft-loss window closed); boxFromAnchor/fullCanvas use live canvas height via virtualHRef (9:16 insert bug).
- **CanvasArea:** canvas-selected Backspace no-ops (matches trash guard); create tools exit crop/node-edit; lock enforced in keyboard paths (nudge/opacity/delete/duplicate, deep-resolved).
- **Small files:** Space keyup input-guarded (transport); WheelTriangle hue ring `from 90deg` (was 90° off); tooltip `--kol-fg-1`→`--kol-fg-emphasis` (light mode readable); expr bindings shadow dangerous globals (ponytail ceiling: not a real sandbox — SES/worker if it matters).
- **Export:** webm bake paced to real time (duration ≈ loopSeconds; WebCodecs = upgrade path); double-rAF frame sync; bindings resolved at click time (was stale hook-body ctx); pattern `<pattern>` anchored at layer origin (matches DOM); filtered text warms fonts before raster; kinetic `warmFontCss` awaited when kinetic layers present.

## Wave 2 — P2 clusters

- **Nested layers now first-class (state.jsx):** flip/align/flatten/duplicate/moveLayer resolve deep (patchLayerDeep/locateLayer; no-op = identical ref = no junk undo); groupLayers accepts groups + nested children, z-order preserved; ungroup/releaseBoolean compose container flip/rotation into children (verified against renderer+export math — visually a no-op now); newId 8 random chars; booleanGroup/flatten topIdx guard; undo/redo bail during open transaction; loadPreset comment truthful (layers-only undo).
- **Panels:** ColorField + AxisField draft/commit-on-blur (hex validated; negatives typeable); ColourPanel opacity coalesces; MenuTop confirm gated on `currentPresetId && !canUndo`; EffectsPanel category syncs to active filter; saved-pattern apply includes scale; image inputs reset value (same-file re-pick); MediaPicker debounced 250ms; ToolPalette resolves selection deep.
- **Export parity:** @Nx PNG threads `rasterScale` into snapshots (2d loops/video at k×; live-canvas engine/filtered snapshots capped at backing store ≤2× — noted in build.js comment); filtered layers now dpr-backed (retina half-res fixed); smooth EMA gets private per-bake store + warm-up lap (deterministic; seam ceiling commented); viewBox exact quotient (gutter gone); buildTypeSvg rewritten to mirror textOutline math (multiline, tracking, baseline/flex-center); visibility truthiness unified (`visible === false` hides, undefined visible) in renderer + export.
- **GL lifecycle:** Drift/Iridescent/SoftForms/SoftForms3D dispose material+geometry; `forceContextLoss()` at both host bridges (covers all 15 engines); presetParams clears off-schema preset keys (stale-param leak across preset switches; engines map cleared keys → defaults); `noir` palette → `spectrum` (noir look ≡ spectrum + the values the scenes already set).
- **Multi-drag + tree:** multi-selection drags as a unit (one undo entry; click-without-drag collapses to single); LayerStack renders/reparents at any depth (recursive, 16px/level, cycle-guard via isIntoOwnSubtree); guide border/aspect label themed (`--kol-fg-24`/`--kol-fg-64`); rings/scrims tokenized or hoisted.

## Wave 3 — dead code + packaging

- **Deleted 38 files / ~4,900 lines** (registry/, 16 mode bodies incl. TypeFrame.jsx, PaletteInspector cluster, color *Ref set, decks/molecules, kol-typography-fonts-full.css, bbox.js, viewport.js, ColorRamp→`src/editor/color/cssVar.js` extraction, orphan CSS rules). `modes/*/state.jsx` + 14 support files verified load-bearing and kept.
- **package.json:** react/react-dom/@kolkrabbi/* out of `dependencies` (peers aligned + devDeps added); **react-router-dom and embla-carousel-react removed entirely** — App.jsx renders `<Editor/>` directly, no router anywhere; lockfile synced.
- **Lib no longer restyles host pages:** new `src/index.lib.css` (Tailwind theme+utilities only, no preflight; kol-framework.css dropped — verified unused by editor), scoped preflight substitute under new `.kol-design-editor` root class (PaletteModal portal gets the class too); dist css verified zero bare html/body/* selectors.
- **Theme boot:** DesignEditor applies persisted mode on mount only when one is stored (`hasStoredThemeMode()`), so embedded Settings menu is truthful without stomping host defaults.

## Wave 4 — consolidation + perf

- **Perf:** compose context value + closures memoized (paint tweaks no longer re-render every consumer); useLayerEdit/useColorTarget returns memoized (keymap listener no longer rebinds 60×/s in drags); transport mouse/stage notifies gated on actual pointer bindings (deep-scanned from layers); rasterize sourceKey drops self-cancelling x/y (no re-raster while dragging filtered layers).
- **Dedupe:** clamp/lerp/TAU → loops/lib/util (divergent ones kept with why-comments); morph.js exports its serialization helpers, buildTypeSvg imports them (~75 copied lines gone); mulberry32 → gl/rng.js only (math/rng.js, penrose/prng.js deleted; bit-identical verified); downloadBlob → `src/editor/lib/download.js`; pixel caches → fxCore `buffersFor`; sin-hashes → fxCore (byte-identical only); rgbToHex → cssVar.js.
- **Idioms:** shared `NumberField` (draft/commit) in CanvasInspector/LayerInspector/StrokePanel; shared `TreePicker` + `PickerRow`/`PickerDropdown` (KineticPanel full, LoopPicker/EffectsPanel primitives — their hierarchies genuinely diverge); drift `period` removed from 18 presets (dead); dead softforms registry exports deleted.
- **Retina filter params normalized** (follow-up of the dpr fix): blur/pixelate/halftone-dither cell/ascii cell/chromatic offsets scale by src.width/w (bit-identical at dpr 1); %-based and normalized-space filters verified unaffected; GL filter path separate, untouched.

## Current State

### Working
- `pnpm build` green (7.9 MB chunk warning pre-existing); `pnpm build:lib` green (1.8 MB js / 141 kB css, down from full-Tailwind).
- All four waves applied; every builder verified syntax (babel/esbuild/node --check) and traced callers before changing shared signatures.

### Known Issues / new caveats
- **▶ User visual check owed** — biggest risk areas: lib CSS preflight scoping (embedded contexts), NumberField conversions (StrokePanel weight now type=number), dpr-scaled filters on retina, ungroup transform composition, LayerStack deep nesting.
- @3x engine/filtered-photo snapshots stay ≤2× (live-canvas backing store cap — re-render at k× architecturally rejected).
- Coordinate machinery still ignores ancestor ROTATION for nested absolute coords (pre-existing, shared with reparentLayer).
- Emboss/enhance kernels + fx-noise grain are per-device-pixel by nature (sub-pixel look change on retina accepted).
- Flagged for a future pass: consumer-free registry exports (catRoute/categoryById/presetsForCat), fxAscii's 4th pixel cache, glass scratch-canvas dupe, downloadSvg exports (zero importers), escapeXml pair (buildTypeSvg/build.js), scanline sin-hash.
- KOL packages still at old versions (kol-component 0.1.2→0.4.0, kol-framework 0.1.2→0.2.1, kol-loader 0.2.0→0.3.0, kol-theme 0.1.1→0.3.0) — user deferred updates.

## Next Steps
1. User visual check across the risk areas above (light/dark, retina, an embed if handy).
2. Decide on the deferred KOL package bumps (0.4.0 component is a big jump — likely breaking).
3. Deferred pool unchanged: Interfaces→Misc, multi-canvas/frame proposal, Tools→Layouts/Assets, kinetic depth tier 2, parity stragglers G6/G11/G12, code-split backlog.
