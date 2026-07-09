# Session: KINETIC presets port + framerate audit (context-clear handoff)

**Date:** 2026-07-03 (eleventh run — closes the round-3 arc)
**Agent:** Grim (Claude Fable) + 2 agents
**Summary:** The two remaining tasks ran to completion. Kinetic layer now carries 24 presets (Scenes + Elements added); framerate measured across the whole catalog with one surgical fix (paused-interaction jank 7.6→60fps) and an honest ranked perf backlog. `pnpm build` green.

## Kinetic Scenes/Elements presets (agent)
- **14 added** (`src/kinetic/presets.js` only): Scenes — Flood (big-statement), Ring (ring-and-word, multi-instance), Flow (custom-s Catmull-Rom), Morph (malromur-wave stand-in), Wave (flag), Reveal (sweep-grid) · Elements — Baseline, Arcs, Loops, Angular, Grid, Weight, Width, Cascade. 24 kinetic presets total.
- Font subs: jetbrains → rot condensed (wdth 90); ordspor avoided by representative choice.
- **Dropped:** the six morph-* presets (need the un-ported opentype morph render mode).
- Verified: 249 knob roundtrips OK across all 24 presets, ids unique, fonts/axes valid.

## Framerate audit (agent, Playwright-measured)
- **Most of the catalog runs 60fps** @480 (all shape loops, GL loops, GL filters, sims).
- **Fix applied** (`LayerRenderer.jsx` only): skip-identical-redraw guards in LoopLayer/EffectedLayer/FilteredPhotoLayer — **paused canvas + mousemove was 7.6fps, now 60** (transport notifies every subscriber per mousemove; hosts redrew with unchanged inputs). Video never skips. Side effect matching documented intent: free-running sims no longer advance from paused mouse events.
- **Ranked remaining (report-only, no code):**
  1. Field family (plasma/interference/swirl/moire/contour) — CPU per-pixel, 8fps @1080; real fix = GPU port (trivial frag shaders, GL host seam exists) or Worker+OffscreenCanvas interim.
  2. fx-ascii @1080 — 28fps; fillText-bound (11.6k glyphs); glyph-sprite atlas ≈ half day.
  3. math-spinner — 250ms first-draw hitch + shadowBlur cost; glow sprites.
  4. Architecture note: per-tick React re-render per animated layer is fine at current counts; a direct rAF draw registry decouples it if layer counts grow.
  5. Video+2d-filter combo defeats pixel caches (fresh canvas per tick) — revisit if the combo gets real use.
- Tried-and-reverted: raster.js allocation hoisting (not allocation-bound — profiled).

## STATE AT HANDOFF (context clear next)
- **Everything through review round 3 is shipped and green.** Right rail = Inspector · Parameters · Effects · Palette. Full catalog: 16 loop categories (~290 presets), 27 filters (HALFTONE trio full-depth + sweep rig), 24 kinetic presets, universal effects, media library + video, modulation (audio bands/LFO/MIDI/expr/pointer-over-layer + per-binding transforms), Space=play/pause, viewport guides, expression bindings.
- **Open pool (nothing in flight):** field-family GPU port (top perf item), fx-ascii atlas, spinner hitch, GL-loop effect source path, pixi tier, fills-as-paint-sources unification, video/audio persistence, prod /media rewrite (deploy blocker), rule-d engine knobs, timeline polish, group-children rename, morph render mode (kinetic), Penrose/Lens-3D skip-list stands.
- **User review of round 3 results not yet done** — that's the next session's likely opening.
