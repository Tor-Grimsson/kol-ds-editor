# Session: Phase 9 (modulation sources v2) + Phase 10 (kinetic-type layer)

**Date:** 2026-07-03 (eighth run)
**Agent:** Grim (Claude Fable) + 1 builder agent (Phase 10, parallel)
**Summary:** The last two scoped phases shipped in parallel. Every bindable knob in the editor can now ride audio bands, LFOs, MIDI knobs, or the pointer crossing its own layer — with per-binding range/invert/smoothing. And the labs TYPE compositions are a first-class `kinetic` layer type with vector export. `pnpm build` green.

## Phase 9 — modulation sources v2 (me)
- **`params/audioBands.js`** — labs `audioSource.js` port (FFT bin-fraction bands, asymmetric attack/release) + audio-FILE input (looping `<audio>` → MediaElementSource, audible). Sources `audio-level/bass/mid/high`; legacy `'audio'` aliases to level (hidden).
- **`params/midi.js`** — Web MIDI CC store (any channel, hot-plug aware) + one-shot **learnCC()** (10s timeout).
- **`params/sources.js`** — rework: sample(ctx, {transform, layer}); LFO sine/triangle/square (pure fns of loop t — scrub-safe, seamless at integer rates; rate/phase from the binding's transform); `layerX/layerY` pointer-over-layer (0..1 in the layer's own bounds); MIDI source reads transform.cc; gamepad kept.
- **`params/resolve.js`** — resolveMod threads binding+layer; transform grows **invert** + **smooth** (EMA keyed on the binding OBJECT via WeakMap — rewrites reset the smoother, which is correct).
- **`params/transport.js` + CanvasArea** — stage pointer in virtual px (`setStagePointer`, mouseleave clears) feeds the layer-local sources; notifies like mousemove so paused-but-bound layers track it.
- **`params/BindDot.jsx`** — bound-to-source popover grows the transform editor: range min/max, invert, smooth, LFO rate (0.25–16 cycles) + phase, MIDI learn button with live CC display.
- **`params/AudioInputRow.jsx`** in the footer Transport tab: Audio **Off · Mic · Track** (file picker).

## Phase 10 — kinetic-type layer (agent)
- **`src/kinetic/`** — KineticType SVG engine ported with **ZERO npm deps** (the old dep audit was stale on every count: mathjs never used — labs exprParam stripped to numerics; **flubber not even referenced** — morph mode stripped along with the opentype import; paper unused). Fonts = 3 TG variable faces as assets (`public/fonts/TG/`, ~190 KB), FontFace-registered on mount.
- Drive model = the loops treatment: `renderAt(u)` per transport tick from the KineticLayer host; engine SVG `pointer-events:none`, host div carries `data-layer-id`.
- **10 presets** (labs /type registry): Radial Sunburst/Dense burst/Double twirl/Pulse burst · Rings Vortex/Galaxy/Wide rings · Path Orbit/Spiral/Template. Comp opaque on `layer.comp`.
- **KineticFields** (honest preset player): Generate = preset picker + primary text field · Style = bg/fill (palette refs resolved to hex at write) / font / size / spokes · Animation = spin/cycles where the preset supports it.
- **Export is VECTOR** — live engine SVG serialized as a nested `<svg>` with used fonts inlined as base64 `@font-face` (pre-warmed async at mount; an export fired before warm-up falls back to system faces once).

## Notes / limits
- Kinetic excluded from effects v1 (same policy as engine loops); comp internals take no bind dots (opaque, by design).
- Not smoke-tested live — presets need a visual pass.
- MIDI is Chrome-first (Web MIDI feature-detect; Firefox behind flag).

## Next Steps
1. USER REVIEW — the scoped roadmap (Phases 0–10) is now fully built.
2. Remaining pool (unchanged): pixi tier, GL-filters-on-any-layer, prod /media rewrite, video persistence, rule-d engine knobs, group-children rename, timeline polish.
