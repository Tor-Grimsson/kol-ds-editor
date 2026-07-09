# Session: labs parity audit + silent-gap backfill

**Date:** 2026-07-03 (thirteenth run)
**Agent:** Grim (Fable 5)
**Summary:** Registry-level diff of kol-labs-single vs this editor (`docs/2026-07-03-labs-parity-audit.md`), then a 4-agent backfill that closed every "silent gap" except Penrose. Catalog grew by ~130 presets; `pnpm build` green.

## Changes made

- **Audit doc** — `docs/2026-07-03-labs-parity-audit.md`: full-parity families, 13 silent gaps (G1–G13), documented skips verified. Outcome section appended.
- **G5** — 7 missing FX-rack canvas2d filters (`fx-hsv/contrast/rgb/invert/sepia/grayscale/enhance`) in `src/filters/fxEffects.js`, exact labs math; added to the FX-rack bucket in `effectCategories.js`.
- **G10** — glass looks `slivers`, `prismatic`, `prism-ripple` (`src/filters/glass.js`); minimal `dispersion` flag on patterns, existing patterns byte-identical.
- **G2** — labs loops Pattern group: new **Pattern Loops** category (`src/loops/patternloop/`, 30 presets, 6 subs) driving the already-ported pattern-rules engine (presets only, no engine duplication).
- **G4** — Math grew 26 → 41: Waveforms 7 (`wave-*`), Fields 6 (`field-*`), Parametric 2 (`param-curves/orbits`) in `src/loops/math/`. Labs' free-text `f(t)` frozen to selects (surface-port precedent); advected particles re-derived as scrubbable closed forms; orbits stays free-running.
- **G9** — MSTP combos 8 → 20 (gold/ocean/mono color sets were already in the repo, only registration was sliced).
- **G8** — gradient types complete: `irid-conic/mesh/aurora/dome/ripple` (shader already had all 12 branches — catalog-only); 6 labs looks as a bindable `look` select on all 12 irid presets (knobs gate behind `look: custom`).
- **G7** — ribbon presets: 9 labs recipes (`ribbon-cascade/tower/plunge/braid/fan/arch/wave/knot/slab`) + Flatness/Corner knobs (engine already supported both). Editor's puddle/chrome/ember/coil untouched.
- **G3** — kinetic 24 → 84: all 60 portable labs presets (labs total is exactly 80 = 14 already ported + 6 morph-skipped + 60 new). 18 font substitutions → rot condensed, noted per-entry in `presets.js`.

## Known issues (new/flagged)

- **Bare preset-id collision (pre-existing):** `mesh` and `ripple` are each defined in both `src/loops/pattern/presets.js` and `src/loops/gl/catalog.js`; global `presetById` returns first match. Needs a rename decision (touches saved drafts) — parked.
- Glass `slivers` at default xShift/yShift displaces horizontally; labs' Tall Slivers look needs yShift raised (pattern fields can't carry per-pattern param defaults).
- Main chunk now 9.1 MB (was ~7; warning-only, pre-existing).

## Next steps

1. **USER REVIEW** — round-3 items + the backfilled catalog (Pattern Loops category, Math Waveforms/Fields, gradient looks, ribbon/kinetic presets, FX rack, glass looks).
2. Remaining gaps, user-ordered: **G1 Penrose (0/55, own import wave)**, G6 primitives matrix, G11 gradient-field scene, G12 dither photo styles, G13 para-type style presets/Skeleton engine.
