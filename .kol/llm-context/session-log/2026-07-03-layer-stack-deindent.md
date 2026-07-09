# Session: layer stack de-indent (Figma model)

**Date:** 2026-07-03 (nineteenth run)
**Agent:** Grim (Fable 5)
**Summary:** The stack's ~68px left inset (vs Figma's ~24px) came from Canvas acting as a root folder — every top-level layer paid a 26px nest tax on top of container padding. Fixed per the approved plan.

## Changes made

- **Canvas is no longer a tree parent** — top-level layers render flush (no `kol-compose-layer-nest` on their `<li>`); the collapse-everything chevron and `canvasCollapsed` state are gone (groups own collapsing).
- **Canvas row stays at the TOP** (plain row, empty gutter for icon alignment). A bottom placement was shipped first — an unrequested extra bundled into the plan — and reverted on user correction; the lesson is now persistent memory (`no-plan-smuggling`).
- **Nest step 26px → 16px** (`kol-editor.css`) — one chevron slot per real nesting level; a group child's icon aligns under its parent's icon.
- **Container padding px-4 → px-2.**
- Net: top-level icon inset ~68px → ~34px; empty-state hint sits above the Canvas row.

`pnpm build` green.
