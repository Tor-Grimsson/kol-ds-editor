# Session: text-tools restructure — all four waves

**Date:** 2026-07-03 (twenty-first run)
**Agent:** Grim (Fable 5)
**Summary:** The text-tools audit executed end-to-end: para-type re-homed onto a new `misc` layer, the kinetic morph mode ported (the "type variable morpher"), text export made real vectors, and the kinetic layer grown from preset-player into a per-element type tool.

## Changes made

- **Wave 1 — homes:** new **`misc` layer** (add menu) — placeholder home for rule-driven generators that are neither Generative nor Effects; rides the loop render vehicle. Para Type = its first tree entry (Glyphs 13 · **Styles 9** — labs presets ported; Classic/Skeleton engines). Para Type + Pattern (Effects) removed from the Generative menu and the picker's Type dropdown (`PICKER_TREE` = generative only; legacy layers show read-only identity via `LEGACY_GROUP_LABELS`). Docs corrected (parity audit's "Skeleton missing" claim was wrong — it was ported all along; hierarchy doc updated).
- **Wave 2 — fixes:** JetBrains Mono `@font-face` declared (woff2s shipped but never loaded — the text layer's Mono cut silently rendered a system fallback).
- **Wave 3 — morph:** labs `morph.js` ported byte-faithful into `src/kinetic/` — outline-interpolation render mode (morph / fade / per-letter random; Cut B = same-VF axes or cross-face; 8 named curves), the **6 morph presets** restored (`Variable · Morph`, no font substitutions needed), morph knob section (labs MorphPanel gates). Kinetic SVG export handles morph `<path>` glyphs natively. **opentype.js pinned `^2.0.0`** — package.json said 1.x while node_modules held a 2.0.0 build; genuine 1.3.5 lacks `getPath` variation support and would have silently broken morph on any fresh install.
- **Wave 4a — kinetic depth:** `KineticPanel.jsx` (extracted from ParametersPanel) — picker on the app hierarchy (**Type** = Radial/Rings/Path · **Kinetic** = Scenes/Elements/16 more categories; `KINETIC_TREE` derives from preset subs), **Elements section** (select/add/remove/reorder/duplicate instances; knobs now target the selected element — `knobs.js` transforms take an instance index; added Italic/Case/Align/Arrangement knobs), and **`morphBlend`** — the kinetic layer's first bindable flat prop (BindDot on the Animation tab; KineticLayer resolves it into every morph-on element per frame, stored comp untouched).
- **Wave 4b — text vectors:** `textLayerSvg` emits real glyph outlines (new `modes/type/textOutline.js` over the existing fontLoader; exports pre-warm fonts async, sync builder renders from cache). Browser-fidelity layout: per-glyph tracking incl. trailing, half-leading baselines, greedy soft-wrap + char-break, ligature rules, stroke with `paint-order`. Fixes SVG + PNG + webm text in one. foreignObject kept strictly as fallback (mono cut, cold cache).

`pnpm build` green.

## Flags

- **Mono cut exports** still fall back to foreignObject (JetBrains ships woff2-only; opentype.js can't parse woff2). Render is now correct; export of mono text is not vector.
- **morphBlend overrides per-element Blend** for ALL morph-on elements when set (v1, by design).
- The 6 morph presets are static letter-gradients (labs animated blend via expression params, stripped to numerics per the port pattern) — animate via the morphBlend bind dot instead.
- Kinetic still without: on-canvas element positioning overlays, VF-axis sliders, OpenType feature menu, motion-stack editor, DnD row reorder (up/down buttons).
- Kern-heavy pairs may differ sub-pixel between live render (HarfBuzz) and vector export (opentype GPOS); Windows Chrome vertical metrics may differ a few px.

## Next steps

1. User review of the whole text family: Misc layer (Para Type glyphs/styles/engines), morph mode + presets + bindable blend, kinetic Elements editing, Type/Kinetic picker, text vector exports, Mono cut rendering.
2. Deferred: Interfaces → Misc categories; multi-canvas/frame proposal; Tools → Layouts/Assets; dead-code sweep (registry/, mode bodies, PaletteInspector/PalettePanel).
