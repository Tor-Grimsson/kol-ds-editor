# Session: waves 4b + 4c + 4d — the filter catalog is complete (24 filters)

**Date:** 2026-07-03 (fourth run)
**Agent:** Grim (Claude Fable) + 2 builder agents
**Summary:** The remaining image-filter waves shipped in one go. Photo layers now have **24 filters**: 18 canvas2d + 6 GL engine filters (the labs synth quartet, distortion, and the 2D lens). Every filter knob is bindable (keyframes / mouse / audio / gamepad). Lens 3D evaluated and skipped with a written verdict. `pnpm build` green; three.js core now a SHARED lazy chunk (524 KB) reused by both GL hosts (loops 116 KB + filters 40 KB).

## Wave 4b — canvas FX (agent)
- `fxRadar.js` (7): fx-chromatic / edge / posterize / pixelsort / mirror / kaleido / threshold — animated ones (chromatic wobble, pixelsort sweep, kaleido whole-turn spin) woven seamless.
- `fxAscii.js` (1): luma char grid, role-tagged fg/bg, static.
- `fxEffects.js` (7): hsl / brightness / blur / pixelate / solarize / emboss / noise (deterministic per-pixel hash, integer frames/loop). Effects-tier posterize skipped (radar's is cleaner).
- `fxCore.js` (orphan from the rate-limited first attempt) judged sound and kept: WeakMap ImageData buffers + shared scratch canvas + labs-exact amount dry/wet.

## Wave 4c — GL engine filters (agent + my wiring)
- `src/filters/gl/` — synthBase (SynthEngine: autoLoop-strip, `setSource(canvas)` via CanvasTexture, exprParam/audio stripped, preserveDrawingBuffer) + Trails / Rutt-Etra scan / Slitscan / Disco + DistortionEngine + RefractEngine. Shaders verbatim.
- **`gl/catalog.js`** (data-only defs `kind:'engine'`, schemas transcribed from the port report) + **`gl/host.js`** (the only engine importer; construction switches, drive is generic `frame(dt)` — all free-running).
- **`EngineFilterLayer`** in LayerRenderer: lazy host import, engine keyed to filterId, fitted-source push on identity change, dt drive while playing. Export snapshots the live canvas (already wired in 4a).
- **Distortion pointer** = `px`/`py` params 0..1 → bind Mouse X/Y for the labs cursor behavior; auto-paths (orbit/figure8/lissajous/sweep/spiral) ride accumulated time.
- **Pixi tier NOT ported** (deliberate): 18 pixi-filters effects would drag pixi@8 + a global-app lifecycle; canvas tier covers the daily-driver looks. Documented opt-in-later in plan.md.

## Wave 4d — Lens
- **Lens 2D (RefractEngine) shipped** as `gl-lens`: 6 surfaces (glass/ripple/ice/mirror/kaleido/waves), panel/circle shape, magnify/chromatic/frost/reflect/sheen — the "glass over photo" look.
- **Lens 3D (LensScene) skipped, verdict logged:** a real interactive 3D scene (TransformControls gizmo, ViewHelper, orbit view modes, Bloom composer, ~40 params incl. gizmo state) — its value is interactive depth inspection, which a params-driven filter can't express. Revisit only if an interactive-3D layer type ever lands.

## Notes / limits
- All 6 GL filters are free-running (feedback/accumulated time — labs parity, non-scrubbing). Canvas FX animated ones ARE seamless.
- Slitscan on a still converges to near-identity after the head sweep (noted in catalog) — shines on changing sources.
- Scan engine instantiates OrbitControls on the layer canvas; editor pointer routing may fight it (untested live) — check during review.

## Next Steps
1. USER REVIEW — everything from phases 1→5 is now built; nothing is queued behind it.
2. `git init`. Fifth session. The whole labs catalog is sitting unversioned.
3. Deferred pool: pixi filter tier, export motion-baking, engine camera drag, layer-as-filter-source seam.
