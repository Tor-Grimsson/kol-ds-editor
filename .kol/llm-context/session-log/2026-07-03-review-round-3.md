# Session: review round 3 — Effects tab, HALFTONE trio, expression source, Space transport, infinite guides

**Date:** 2026-07-03 (tenth run)
**Agent:** Grim (Claude Fable) + 5 builder agents
**Summary:** Third review sweep. Five of six workstreams landed and built green; kinetic depth (R3-E) wrapping as this is written. `pnpm build` green at every merge.

## Landed
- **A (me):** tab jolt root-caused (Inspector header 46px w/ trash vs Parameters 32px bare — both pinned to 46); loop **Category + Preset dropdowns in the Inspector**; **Space = play/pause** (tap) with Space+drag pan preserved (labs' "ultimate ruler" binding — previously Space only worked when the play button happened to have focus); engine-loop "Add effect" rows/menu gated off (they opened onto nothing).
- **B (agent):** dedicated **Effects tab** (Inspector · Parameters · Effects · Palette) — labs category taxonomy (Halftone/Scanline/CRT/Refraction/FX rack/Pattern + Other fallback so future filters never vanish), Effect | Motion sub-strip (anim params split out), photo extras (crop hint, camera drag) moved along; effect surfaces REMOVED from Parameters. Top-bar Effects menu + inspector rows dispatch `kol:open-effects` (me: MenuTop fix + engine-loop menu gate).
- **C (agent):** the real **HALFTONE trio** — fx-ascii replaced with the full labs port (18 params: Density/Edges/Braille/Custom-ramp algorithms, 8 charsets, amount, original-color), NEW fx-halftone-dither (18 params, 23 modes × 21 shapes), NEW fx-bitmap (14 params, photoBlend semantics). Shared **sweep rig** (`filters/sweeps.js`): 5 shapes × 3 targets (Brightness/Geometry/**Reveal**), ALL seamless (node-verified frame(0)===frame(1); labs' non-periodic noise scroll → circular orbit); labs' strobing Math.random modes → per-cell hash. NB: legacy ASCII layers now default to Original-color (labs default) — flip off for mono ink.
- **D (agent):** **Expression source** — labs exprParam evaluator ported (`params/expr.js`: compile-once cache, never throws/NaNs, `t` in SECONDS = labs parity + seamless at integer loop lengths, `max`≡1 in normalized space); usesLive detection keeps the paused-notify loop alive only while audio/rand expressions are bound; BindDot grows the expression input + 8 click-to-fill examples (the 0–100-space labs examples deliberately dropped).
- **F (agent, live-verified):** **guides span the full viewport** (Figma) — rendering + interaction moved to PanZoomViewport, positioned by the same `useFrameGeom` hook the rulers read (extracted; lines and labels cannot disagree); round-trip position check passed. Compose passes guides/setGuides down; other modes no-op.

## E — kinetic depth (landed after scope cut)
- **Per-string offset SHIPPED** (the #1 ask): labs had NO native per-instance phase — engine patched minimally: instance `phase` (u+phase wrap) + per-unit `stagger` (unit k of K offsets u by stagger·k/K); radial/rings staggered units additionally take up to two extra INTEGER turns (a phase offset on constant-rate spin reads as static twist — only a rate difference reads as movement); integer turns keep seamlessness. One Stagger knob drives both.
- **26 knobs** (`src/kinetic/knobs.js`, declarative get/set over the comp — NOT flat layer props, because presets reset the comp wholesale): Generate = preset + per-instance Text fields + Randomise; Style = bg/fill/font/size/letter-spacing/copies + when-gated Arrangement per path type; Animation = Motion mode (None/March/Orbit/Axis wave/Glyph wave/Cascade/Sweep×3 — makes static presets animatable) + cycles/amount/glyph-phase/axis/field/Stagger/Spin. All when-gated.
- **Scenes/Elements presets SKIPPED on my stop order** (lowest priority) — fully scoped for a next pass (14 comps; known drops: morph-mode presets need an un-ported render mode, ordspor/jetbrains fonts absent). The new Motion-mode knob already unlocks most of those looks on existing presets.

## Answered in review (no code)
- TYPE (10 comps) shipped; labs KINETIC section = same engine, being added in E.
- Photo layer vs shape-with-photo-fill: unified "fills as paint sources (color|image|video)" is the right end state — scoped later, not a merge-now.
- Snapping exists (edges/centers/layers/guides; File → Snap to guides).
- Framerate audit: parked per user (later).
- Labs' two dithers disambiguated: RD 'dither' (Pattern/Reaction bucket) vs the new HALFTONE Dither.

## Next Steps
1. Merge E; round-3 report to user.
2. Framerate audit (user-parked).
3. Deferred pool unchanged (+ GL-loop effect source path moved up after the engine-loop gating complaint).
