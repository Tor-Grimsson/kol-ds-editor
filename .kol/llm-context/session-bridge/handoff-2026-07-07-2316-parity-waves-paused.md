# Handoff — 2026-07-07 23:16

## Goal of the current arc
Close the full labs→editor parity backlog (user: "fix all of it") in consecutive waves, after a 6-agent parity audit against `kol-labs-single` mapped ~200 missing-feature rows (9 systemic gaps + 11 big-ticket). Earlier today (same session, already logged): full internal audit + 4 fix waves — see `session-log/2026-07-07-full-audit-four-fix-waves.md`.

## Last actions taken (causal trail, newest first)
- **PAUSED by user to switch models to Opus.** Four Wave-C builder agents were mid-flight and were left to finish; their results are UNREVIEWED: PC1 pattern authoring (rules editor on loop layers, ProfileEditor, glyph/custom-SVG tiles), PC2 kinetic tier-2 (VF axes, OpenType menu, motion stack, custom-path editor, grouping, on-canvas suite), PC4 math authoring (mathfn free-text exprs, curve editor, BindDot expr plot, axes overlays), PC6 para-type (specimen grid, guides, flatten-to-vector, XY pad). PC4/PC6 hand back MOUNT SPECS for ParametersPanel/state.jsx instead of editing them.
- Applied 4 cross-agent hand-offs inline: build.js loop export via `drawLoopFrame`; LoopPicker `_lookPreset:'custom'` on preset apply; penrose host COLOR_PARAMS + role-opacity params (dim default 5) + `syncOpacity(p)` in draw; ParametersPanel camera-drag gate `loop?.orbit || loop?.cameraKeys`.
- Wave B done (3 agents): PB1 ~30 schema exposures (iridescent form ×8, softforms shading, primitive shape/axis/flat, disco/trails/scan/distort/lens, pattern sections + offsets, RD/MSTP sliders, glass full-look preset patches via new `setStageParams`, NEW `editor/params/lookPresets.js`); PB2 viewport motion port (NEW `loops/lib/viewport.js`, contract fold, vp presets; transport `resetEpoch` on stop/rewind → reaction/spinner/orbits/penrose reset; video governed by transport + playbackRate/videoLoop/videoMuted params; generic `cameraKeys` drag-orbit rig); PB3 gl/host unpinning (keyframes/wireframe/grid-of-9/duration integer-cycles via NEW `loops/gl/phase.js`; NEW KeyframeEditor.jsx + CameraPoseSlots.jsx; `hostAction(layerId,'resetCamera')`; meshgradient theme→setBackground; penrose generate-tab renders).
- Wave A done (2 agents): PA1 scoped seeded randomize (NEW `editor/params/rolls.jsx`, NEW `editor/params/motionPresets.js`; ParametersPanel Randomize-all + scope grid + Seed; Kinetic/Pattern panels seeded); PA2 filter chains (NEW `compose/filterChain.js`; `layer.filters` array cap 8, engine terminal; EffectsPanel rewritten — chain rows, per-stage randomize, sweep stacks + 5 presets; engine filters on loop layers via EngineLoopFilterLayer).
- Inline foundations: NEW `src/editor/lib/rng.js` (mulberry32/randomSeed/randomizeSchema/mergeRoll — the shared contract every randomize surface imports); scrollbar fix `scrollbar-gutter: stable` on `.kol-editor-rail-body` (kol-editor.css:136).

## Current state / open decision points
- **NO BUILD RUN since parity waves began** — waves A+B+inline are unverified beyond per-agent parse checks. First post-resume build may surface cross-agent breakage (biggest risk: EffectsPanel rewrite × PB1's setStageParams edit landed on the same rewritten file, sequentially but unbuilt).
- Wave C results must be read from the four task notifications; PC4/PC6 mount/patch specs must be applied to ParametersPanel.jsx / state.jsx by the orchestrator (files were deliberately kept out of those agents' ownership).
- Remaining planned waves — **D**: softforms per-form Layers tab + on-canvas SDF handles (CanvasArea owner); video trim in/out + IndexedDB clip persistence + video crop; batch multi-size export matrix (8 social presets × @Nx, store-only zip) + 3:5/5:3 aspect presets + live real-time webm record; gamepad learn/buttons/shaping + binding response curves. **E**: OS-file drag-drop onto stage, webcam source, MediaPicker drill-down/lightbox/copy-URL; pixi GPU filter tier (~33 fx) as LAZY chunk (new dep — needs pnpm add); stragglers (scanline live filter surface, distort cursor record/replay, appSettings global defaults). Then: pnpm build + build:lib, fix breakage, **/log-work** (user asked "log when done"), final report.
- Flagged OUT of scope (told user, accepted silently): Interfaces composer, Radar 3D Lens scene, server-backed ffmpeg/poster pipelines (app-sized / backend-dependent).
- Known seam to polish: PA2 built its own seed-field row in EffectsPanel before PA1's `SeedField` (rolls.jsx) existed — two styles, unify later.
- KOL package bumps still deferred (component 0.1.2→0.4.0 etc.).

## Next intended action
1. Read the four Wave-C completion notifications; apply PC4/PC6 mount/patch specs to ParametersPanel.jsx + state.jsx.
2. Run `pnpm build` — fix what breaks (waves A–C all unbuilt).
3. Launch Wave D (4 agents per the task list — tasks #10/#11/#12 in the tracker), then E, then final builds + /log-work + report.

## Working memory not yet in AGENT-CONTEXT
- Agent-fleet convention that worked all session: disjoint file ownership per parallel agent; contracts (exact keys/exports) fixed in prompts; anything cross-owned becomes a "patch spec" the orchestrator applies inline.
- ParametersPanel.jsx is the contention hotspot — every wave wants it; assign exactly one owner per wave.
- Scanline geometry/mark selects roll within their scopes (generic model) vs labs' pinned-category randomize.js — user may want them pinned; flagged in PA1 report.
- Ribbon `duration` default set to 12 (labs value) not the 8 in my prompt — PB1 flagged; fine.
- PB3: layers carry `_camSlots`, `_rollSeed`, `_framePreset/_formPreset/_lookPreset` meta fields — all survive JSON save/load, none render as controls.
