# Session: effects-repo audit (render-fork + param-graph RFCs)

**Date:** 2026-07-01
**Agent:** Grim (Claude Opus)
**Summary:** Audited `/Users/biskup/dev/projects/kol-apparat/kol-labs-single` (3 parallel read-only agents) to resolve the two open RFCs. Both RFCs updated with findings; render fork RESOLVED to hybrid. Docs-only.

## Findings — render fork → HYBRID (Option A), C not needed, B ruled out
- **~90% of effects self-contained** (~40 families / ~125 effects+presets): all `src/loops/` (29), math (15), gradient/softforms/drift three.js (~11), penrose (~45), optic (4), pattern, kinetic/type/para-type, 16 p5 widgets. Drop into a per-layer host with zero compositing plumbing.
- **~12 scene-samplers** (Effects filter-stack, Glass, Live, Radar ×8, Abstract-Dither, dual Scanlines) — **each samples its OWN uploaded image/video asset (ImageContext/file input), none reads the composited layers below.** The hybrid's one weakness (scene-as-texture) is a capability nothing in the repo uses → Option C deferred-maybe-never.
- **Heterogeneous renderers** (canvas2d bulk, three.js ~17, p5 ×16, pixi ×1) → host must host arbitrary offscreen canvases → **rules out Option B** (single GL scene).
- **No 3D effect ships** (three is a dep, but no generic 3D-scene primitive) → 3D layer is new work, not an import.

## Findings — param graph → ~75% already exists, work is consolidation
- Declarative param schema exists (`src/loops/contract.js` `{key,type,min,max,step,default}`) but **two grammars** (loops array vs effects object) + **3–4 duplicate auto-render panels** → unify to one schema + one inspector.
- Pure-time animation exists (`u∈[0,1]` + transport-aware `LoopPlayer2D`) = the evaluator/transport, minus keyframe tracks.
- Live modulation exists: Web Audio bands (`audioSource.js`), expression params (`exprParam.js`, `t`+oscillators+audio as free vars), sweeps; `Slider.liveGet` + `LiveClock` are the injection seams. Seeded PRNG + schema randomizer present.
- **Genuinely new:** keyframe timeline w/ tracks (repo uses expressions instead — deliberately anti-keyframe); pointer/mouse as a modulation source (only audio+time first-class today).

## First-cut import target
`src/loops/` shape+field loops — pure `draw(ctx,u,w,h,params)` data modules, ~5-file zero-npm runtime, already an extension seam. Loops paint an opaque frame + never auto-clear → patch to skip bg fill for transparent-overlay hosting. Exclude pattern loop (opentype) + effects pixi tier (pixi.js) from cut one.

## Changes Made (docs only)
- `docs/rfc/2026-07-01-render-fork.md` — Audit section; recommendation → commit to A, C deferred, B off; acceptance reframed (spike validates the seam, not the model).
- `docs/rfc/2026-07-01-param-graph.md` — Audit section; phases revised to consolidate the existing model.
- `docs/plan.md` — fork marked RESOLVED; Phase 3 rewritten around importing `src/loops/`.

## Next Steps
1. The sequencing tightened: `src/loops/` effects are pure-time modules that can't run without the param-graph schema + transport — so **Phase 1 (unify schema + inspector) and Phase 2 (transport + timeline) are hard prerequisites** before the first effect import. Motion-before-effects is now a dependency, not just a preference.
2. Resolve the param-graph RFC's remaining open questions (keyframe interpolation model; bindings-on-layer serialization; export baking) before starting Phase 1.
3. Still no git repo.
