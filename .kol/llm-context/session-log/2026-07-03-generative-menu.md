# Session: Generative top menu — labs taxonomy restored

**Date:** 2026-07-03 (fifteenth run)
**Agent:** Grim (Fable 5)
**Summary:** User blocked reviewing: the labs Generative PARENT had been flattened into the loop layer's 18-item Category dropdown (taxonomy inversion — "Loops" is one labs category, not the family name). Fix per his proposal: a **Generative** menu in the top bar, labs hierarchy, leaf inserts the layer.

## Changes made

- `src/loops/taxonomy.js` — NEW, data-only: `GENERATIVE_TREE` mapping labs parents → registry group ids, labs sidebar order (Scanline · Pattern · Loops[Simple/Field/Pattern Loops] · Math · Penrose · Drift · Gradients · Soft Forms · Soft Forms 3D · 3D Scene[Primitive/Ribbon/Forms/Environment/Abstract] · Optic · Para Type). Per-group display override (`scene` → "Primitive" under 3D Scene).
- `MenuTop.jsx` — **Generative** MenuItem before Effects: parent nests → category nests (multi-group parents only) → sub-bucket headers + preset items. Picking a preset `addLayer('loop', …)` with the preset's full param set (same shape as the inspector's applyPreset), auto-selected; navigates to compose if in another mode.
- `ParametersPanel.jsx` — loop Category dropdown now taxonomy-ordered with parent prefixes (`Loops · Simple`, `3D Scene · Ribbon`), single-group parents read as themselves. Same flat-dropdown convention as the preset `sub · label` prefix.

`pnpm build` green.

## Notes

- Layer type stays `loop` internally and "Loop" in the add-menu — rename to "Generative" is a one-liner in `LAYER_TYPES` if wanted, not done (user-facing copy).
- "Primitives matrix" review path is now: Generative → 3D Scene → Primitive.

## Next steps

1. User continues the review with the Generative menu as the map.
