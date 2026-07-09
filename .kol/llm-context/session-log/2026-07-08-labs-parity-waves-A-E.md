# Session: Labs parity — full backlog closed in 5 waves (A–E)

**Date:** 2026-07-08
**Agent:** Grim (Fable 5 → Opus 4.8) + 6 parity auditors + 21 builder agents
**Summary:** After a 6-agent parity audit against `kol-labs-single` surfaced ~200 missing-feature rows (9 systemic gaps + 11 big-ticket), five consecutive waves ported the missing curation + authoring layers into the editor. Everything client-feasible without a new heavyweight dependency is done; both builds green. (Same calendar arc as the 2026-07-07 internal audit + 4 fix waves — see that log.)

## Why this happened
The prior "labs parity" claim covered preset CATALOGS only (~380 presets), not per-tool CONTROL surfaces. The audit found the engines/catalogs were ported near-verbatim but the **curation layer** (scoped randomize, motion presets, seeds) and **authoring layer** (rules stacks, curve/keyframe editors, per-form scene editing) were skipped almost everywhere. Trigger: user's scanline example (6 scoped-randomize buttons missing).

## Waves (each = parallel agents, disjoint file ownership, fixed-key contracts, ParametersPanel/state.jsx orchestrator-only)

### Wave A — randomize architecture + filter stacking
- **Scoped seeded randomize** (NEW `params/rolls.jsx` + `lib/rng.js` mulberry32/randomizeSchema/mergeRoll): "Randomize all" + per-section scope buttons derived from schema `section` metadata, seeded + binding-safe + category-preserving, across loop/kinetic/pattern layers. Motion Frame/Form preset dropdowns (NEW `params/motionPresets.js`) for 6 families. Field-loop camera rail wired (was schema-present, never rendered).
- **Filter chains** (NEW `compose/filterChain.js`): `layer.filters[]` cap 8 (engine terminal), EffectsPanel rewritten (chain rows, per-stage randomize), sweep stacks + 5 presets, engine filters on loop layers.

### Wave B — schema exposures, transport, camera/keyframes
- ~30 engine-supported params unhidden (iridescent form ×8, softforms shading ×5, primitive shape/axis/flat, disco/trails/scan/distort/lens, pattern offsets+sections, RD/MSTP). Penrose generate-tab now renders + dim-opacity=5 fix (silent 5×-fainter bug).
- Viewport motion layer (NEW `loops/lib/viewport.js`); transport `resetEpoch` governs sims (reaction reseed / penrose retrigger / spinner-orbits clear) + video (playbackRate/videoLoop/videoMuted). Generic `cameraKeys` drag-orbit. host.js unpinned (keyframes/wireframe/grid-of-9/per-layer duration via NEW `loops/gl/phase.js`); NEW KeyframeEditor + CameraPoseSlots; meshgradient theme→setBackground; NEW `params/lookPresets.js`.

### Wave C — authoring sub-editors
- Pattern: NEW RulesEditor (rules stack on loop layers), ProfileEditor (organic bezier), glyph + custom-SVG tiles (opentype reused, SVG sanitized).
- Kinetic tier-2: VF axis sliders, OpenType feature menu, motion stack UI, custom-path point editor, grouping (group/ungroup + group transforms), on-canvas element overlay (NEW KineticElementOverlay, DOM-seam, zero LayerRenderer change), morph custom curve, range unclamps.
- Math: NEW `loops/math/mathfn.js` safe free-text expr compiler (f(x,y,t)/f(x,y)/f(t), hardened like expr.js) + NEW CurveEditor (kind/epicycle authoring) + BindDot expr plot + axes/grid overlays.
- Para-Type: NEW specimen.js (multi-glyph grid + filter sets), guides/anatomy overlays, NEW flatten.js (lossless flatten-to-vector), NEW XYPad.

### Wave D — scene editing / media / gamepad
- Softforms: NEW SoftformsLayers (per-form add/dup/reorder/transforms, forms-scoped randomizers) + NEW SoftformsHandleOverlay (2D SDF on-canvas handles).
- Video: trimIn/trimOut (all 3 paths, rewind→trimIn), per-frame video crop (CanvasArea enterCrop video branch + guard removals + CropOverlay ghost + build.js imgW branch), NEW `lib/clipStore.js` IndexedDB clip persistence.
- Export: batch multi-size PNG zip matrix (NEW `lib/zipStore.js` store-only zip, validated vs system unzip), 3:5/5:3 aspects, live real-time webm Record.
- Gamepad: 16 sources + stick angle/force, gamepad learn, binding response-shaping (invert→smooth→curve→remap, all sources).

### Wave E — input/media surfaces + stragglers
- OS-file drag-drop onto stage; webcam source + mirror (NEW `lib/webcam.js`, stream lifecycle); MediaPicker folder drill-down/breadcrumb/lightbox/copy-URL.
- Scanline live filter surface (full geometry/spacing/mark controls in filter mode); distort cursor record/replay (transport-synced); NEW `lib/appSettings.js` global defaults (defaultAspect/defaultTheme/autoplay/clipToFrame) + Settings-menu wiring + new-layer default-theme seeding.

### Wave F — Pixi GPU filter tier (user green-lit the dep install)
- Installed `pixi.js@8.19.0` + `pixi-filters@6.1.5`. Ported labs' 35-effect Pixi tier: NEW `src/filters/pixi/{adapter.js,pipeline.js,defs.js}` — `kind:'pixi'` filter defs (twist/bulge/shockwave/glitch/CRT/old-film/bloom/glow/godray/drop-shadow/outline/displacement/blurs/color-ops/…) across 7 groups.
- New async chain TIER: canvas stages → pixi batch → terminal GL engine. Pixi runs via **dynamic `import()`** (lazy 414 KB chunk, ~zero added to main bundle) and composites onto the layer canvas using the existing rasterizeLayer supersede pattern; cache-key excludes x/y so dragging doesn't re-run the GPU. Export free (live-canvas snapshot). Both builds green (3635 modules).

## Current State
### Working
- `pnpm build` GREEN (8 MB main chunk, pre-existing warning only) + `pnpm build:lib` GREEN (design-editor.js 2 MB / 524 KB gz). Built green on first try after every wave.
- ~30 new files, hundreds of edits; every agent parse-checked; disjoint-ownership discipline held across a model switch (Fable→Opus) and a tmux crash mid-Wave-D.

### Known Issues / deferred
- **Pixi tier SHIPPED** (Wave F). Caveats: `color-map`/`color-gradient`/`simple-lightmap`/`cross-hatch`/`backdrop-blur`/`convolution` construct with default/empty params (labs parity — color-map may want a runtime `colorMap` texture); webcam→pixi→engine 3-way stack caches at first frame (no per-frame token on that path; webcam→pixi alone is per-frame correct).
- Still out-of-scope (user-accepted, app-sized/backend): Interfaces composer, Radar 3D Lens scene, server ffmpeg/poster pipelines (client-side batch export DID ship).
- Distort cursor path is session-live only (persistence spec deferred — optional, risked the final build). appSettings `clipToFrame` stored but has no consumer yet. Gamepad button→action mapping deferred (needs shell-root wiring; design note in agent report). Seed-field styling differs between EffectsPanel and ParametersPanel (unify later). Scanline geometry/mark selects roll within scope vs labs' pinned category (user's call). clipStore: `deleteClip` unwired (minor leak), duplicated video layers share one objectURL.
- **▶ User visual check owed** — heaviest new surfaces: filter chains + sweep stacks, scoped randomize, kinetic on-canvas overlay, softforms per-form + SDF handles, video trim/crop, webcam, batch export/live record.

## Next Steps
1. User visual check across the new surfaces (light/dark, an embed for the lib CSS) — incl. the pixi tier (35 GPU effects, lazy-loaded on first use).
2. Deferred nice-to-haves above (distort persistence, gamepad actions, seed-field unify, clipToFrame consumer).
3. KOL package bumps still pending (component 0.1.2→0.4.0, framework 0.1.2→0.2.1, loader 0.2.0→0.3.0, theme 0.1.1→0.3.0).
