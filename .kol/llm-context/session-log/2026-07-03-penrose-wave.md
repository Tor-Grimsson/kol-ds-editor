# Session: Penrose wave — all 55 presets ported

**Date:** 2026-07-03 (fourteenth run)
**Agent:** Grim (Fable 5)
**Summary:** The last big parity gap (G1) closed: the entire labs Penrose family — 15 foundations + 40 round2 territories — is now a loop category, via a scaffold-then-parallel port (1 scaffold agent, 2 batch agents, proto files byte-identical to labs except import lines). `pnpm build` green; 55/55 presets, unique ids, sub counts match labs exactly.

## Changes made

- **Deps:** `d3-delaunay@6.0.4`, `d3-force@3.0.0`, `simplex-noise@4.0.3` (labs versions; 5 of 55 protos use them).
- **`src/loops/penrose/` adapter:** `common.js` (labs helpers; `wrapLoop` = step-collector instead of self-driving rAF, so proto files port verbatim), `palette.js` (five-role PALETTE/OPACITY singletons fed from the editor themes — which already carried dim/warm for this), `tint.js` (authored hues remap to live palette by luminance/temperature), `sdf.js`/`shapes.js` (glyph + 7 vector masks, contain-fit, sim space baked at labs-logical 960 so params keep their meaning; glyph fonts = the three TG faces kinetic ships), `prng.js`, `knobs.js`, `host.js` (`protoLoop` factory: labs knobs → bindable schema; free-running MSTP idiom — init once per structural signature, step on u-advance, no scrub-rewind; per-proto `live` keys bind without re-init).
- **Protos:** `protos/` 15 foundations + `round2/` 40 territories — byte-identical to labs except two import lines each (diff-verified by both batch agents). Only `15-triggered` needed real change: click-to-plant → `autoSeeds` param (0 restores labs empty-until-clicked).
- **Presets:** Packing 4 · Growth 4 · Fields 4 · Layered 3 · Reaction & Life 10 · Flow & Dynamics 10 · Form & Geometry 10 · Pattern & Signal 10. Substrate masks follow labs `SUBSTRATE_POOL` by prototype position. act-*/phys-* subs verified against labs `categories.js` (act → Pattern & Signal, phys → Flow & Dynamics — the initial inventory had them swapped).
- Registry: group `penrose` after Pattern Loops; BG_MIX_IDS auto-derived.

## Known caveats (labs-faithful, unchanged)

- **Perf heavyweights:** lenia/smoothlife (O(G²·R²) JS convolutions), droste (~920k px conformal map/frame), apollonian (full gasket rebuild/frame), KS (16 FFTs/step), seashell. Same cost as labs at the same logical scale.
- **Untinted pixel paths:** `fluid-03-stam` dye, `geom-03-apollonius`, `hyp-03-droste` write authored ImageData hues — they don't re-theme (everything else does, via tint/rampRGB).
- `10-reaction-diffusion` seeds via `Math.random()` (labs code) — re-inits aren't seed-deterministic.
- Dead labs knobs kept verbatim: `geom-03-apollonius` `blur`, `frac-01-flame` `palette`.

## Next steps

1. **USER REVIEW** — the full catalog: round-3 items + backfill + Penrose (dial expectations on the heavyweights above).
2. Remaining audit stragglers, user-ordered: G6 primitives matrix, G11 gradient-field scene, G12 dither photo styles, G13 para-type styles/Skeleton.
