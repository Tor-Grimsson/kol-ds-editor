# Session: METHOD > TYPE > CATEGORY > PRESET — hierarchy enforced app-wide

**Date:** 2026-07-03 (seventeenth run)
**Agent:** Grim (Fable 5)
**Summary:** The user's four-level hierarchy (METHOD > TYPE > CATEGORY > PRESET) is now the enforced structure across every content surface, and documented as the first structural app doc in `docs/documentation/`.

## Changes made

- **Taxonomy (`src/loops/taxonomy.js`):** GENERATIVE_TREE = exactly the 10 labs types (Optic + Para Type REMOVED — Optic was my invention from the `/optic/*` route prefix; labs parks those four generator pages under EFFECTS > Pattern, Para Type is labs' Type Lab section). New: `TYPE_LAB_TREE`, `PICKER_TREE` (adds "Pattern (Effects)" / "Para Type (Type Lab)" so existing layers display truthfully).
- **LoopPicker:** dropdowns relabeled to the level names — **Type** (+group for Loops/3D Scene) → **Category** (sub buckets) → **Preset** (plain names).
- **Generative menu:** 10 types + separated "Type Lab" section (Para Type) at the bottom.
- **Effects menu:** restructured from flat filter list into **TYPE nests** (via `effectCategories`); **Pattern** nest = its filters + the four generator categories (Moiré / Mesh Gradient / Reaction / Halftone → insert loop layers, no fx target needed; Mesh Gradient pulls the `gradients` group's `Mesh` sub).
- **Effects panel:** dropdowns relabeled Type / Category; new **Preset** dropdown = the filter's designated preset param, surfaced above the tab strip and removed from the params list. Map `presetParamOf()` in `effectCategories.js`: fx-halftone-dither→mode, fx-ascii→algorithm, fx-bitmap→palette, glass→pattern, scanline→look, dither→palette, gl-lens→type(Surface).
- **Doc:** `docs/documentation/01-hierarchy.md` (type: reference, status: canonical) — the four levels, full type lists per method, UI surface map, parked sections, rules for new imports. First doc in the new structural-documentation home `docs/documentation/`.

`pnpm build` green.

## Notes

- Level names are fixed vocabulary now: Method, Type, Category, Preset — UI labels use exactly these words.
- Layers-panel TLC (approved plan: + into tab row, drop floating trash, empty-state hint, Canvas row density) still queued — next.
