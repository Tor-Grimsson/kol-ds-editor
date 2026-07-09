# Session: Phase 4 scoped + wave 2 GL generators shipped + shape-editor parity complete

**Date:** 2026-07-03 (overnight autonomous run)
**Agent:** Grim (Claude Fable) + 3 Explore scouts + 1 builder agent
**Summary:** Scoped every remaining generative family from labs into `docs/plan.md` Phase 4 (one consolidated scope), then shipped wave 2 — the four named three.js generators (Drift / Gradients / Soft Forms / 3D Scene) as engine loops behind a lazy GL host — and closed all five shape-editor parity gaps. `pnpm build` green; three.js isolated in its own 580 KB lazy chunk (base bundle unchanged).

## Scope (docs/plan.md → Phase 4)
3-agent audit of kol-labs-single. Verdicts: wave 2 (the four named families) all trivial-to-small ports — Drift ships `renderAtPhase(u)`; SoftForms/Iridescent are caller-driven `frame(dt)`; Primitive small shim. Wave 2b = remaining gradient/* engines (Forms/Environments/Ribbon/RD; GradientEngine is the one free-running non-seamless engine — last-or-never). Wave 3 canvas2d one-offs by presets-per-effort: Scanlines (41, trivial) → Pattern (57) → Optic (22) → Math subset → Para-type. Skip documented: Kinetic/Type (composition-model misfit), Penrose (restructure).

## Wave 2 — GL engine loops (`src/loops/gl/`)
- **Copied engines** (+ data): DriftEngine (+palettes+registry), IridescentEngine (palette/backdrop enums extracted to data-only `gradEnums.js`), SoftFormsEngine + SoftForms3DEngine (+2d/3d scene registries), PrimitiveEngine (+primitives/keyframes/composition/easing). **PrimitiveEngine surgically stripped** per scope: audio, spotlight, expression params; self-RAF now opt-in (`autoLoop`), external `frame(dt)`/`step(dt)` added.
- **`catalog.js`** — DATA ONLY (no three import): 5 new groups (Drift / Gradients / Soft forms / Soft forms 3D / 3D scene), 7 engine loop defs with hand-written editor schemas (ranges from the labs PARAM dicts), ~40 presets mapped from the labs registries (drift SUBPAGES, softforms SCENES/SCENES_3D, curated iridescent cat×type + 3D-scene sets).
- **`host.js`** — the ONLY module importing engines; adapts each to `createEngine/applyParams/driveEngine/destroyEngine`. Drive modes: `phase` (Drift, deterministic), `seek` (3D scene: seek(u)+frame(0), paused:false+speed:0 so orbit still updates), `dt` (Iridescent/SoftForms free-run; dt=0 while paused repaints held frame).
- **Registry merge** — `loops/registry.js` spreads GL groups/loops/presets in; LoopFields inspector (Category → Preset → params → Randomise) works on engine loops with ZERO changes.
- **`EngineLoopLayer`** in LayerRenderer — same positioned-canvas host; `import('gl/host.js')` on first mount (lazy chunk), engine lifecycle keyed to loopId, params re-apply + one drive per render, resize guarded, dispose on unmount. Bindings on engine params work (parent resolves before the child draws).
- **Export** — engine loops snapshot the LIVE layer canvas (all engines render `preserveDrawingBuffer:true`) → `<image>`; 2d loops keep the offscreen 2× redraw.

## Shape-editor parity — ALL FIVE GAPS CLOSED (builder agent)
1. **Mid-segment node insertion** — dbl-click a segment in node-edit; de Casteljau split (shape-preserving <1e-9), fat invisible hit path, one undo entry. (`path-math.js` `nearestSegmentT`/`splitSegment`, PathNodeOverlay)
2. **Corner↔smooth** — dbl-click an anchor toggles; smooth = mirrored collinear handles at 1/3 chord. (`smoothNode`)
3. **Open↔close** — inspector Path row (Open/Closed toggle) + clicking first anchor closes an open path in node-edit.
4. **Convert to path (flatten)** — rect/ellipse(kappa)/triangle/polygon/star/line → editable bezier path in place, same id, flips+rotation baked, stroke inset matched. (`shape-math.js shapeToPathNodes`, `state.jsx convertShapeToPath`)
5. **Export-settings UI** — footer Output tab: 1×/2×/3× PNG scale segmented + live W×H px readout; scale threaded through `useComposeFile.onExportPng`.

## Notes / limits
- Engine-loop camera interaction (orbit drag) not wired — camera rides schema params (softforms3d camTheta/Phi/Dist; scene fov/orbit). Labs' OrbitControls exist inside the engines but pointer routing belongs to the editor canvas — later.
- `dt`-driven engines (Iridescent/SoftForms) don't scrub deterministically (free-running by design); Drift and 3D scene do.
- Iridescent presets pin `cat`/`type` as shader ints — curated 7; ranges on its schema are conservative guesses (labs page bounds weren't lifted).
- Roadmap remaining: wave 2b engines, wave 3 canvas2d one-offs, dbl-click-anchor-0-on-open-path = close-then-smooth two-step (known, acceptable).

## Next Steps
1. Visual pass (user validates live): GL loop layers, timeline, parity gestures.
2. Wave 3 cut one: Scanlines (41 presets, trivial — the biggest preset win left).
3. STILL no git repo — after tonight's volume this is genuinely reckless.
