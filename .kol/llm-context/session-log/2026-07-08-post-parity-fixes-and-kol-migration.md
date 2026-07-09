# Session: Post-parity UI fixes + `.kol/` migration + docs vault

**Date:** 2026-07-08
**Agent:** Grim (Opus 4.8) + 11 doc-buildout agents
**Summary:** After the parity waves (prior log), a live-check round fixed real UI defects (panel-header swap, layer-size defaults, a scrollbar jerk root-caused in-browser) and shipped the Orbit tool for 2D + 3D loops; then the repo was converged onto the `.kol/` convention with a full `docs/` documentation vault. A cross-repo side-arc cleaned up the dotfiles skill ecosystem that governs this structure.

## Changes Made

### Post-parity UI fixes (source)
- **Shared panel header** — `SelectionPalettePanel.jsx` now renders ONE header (title + trash) above the tab body; the per-panel headers were removed from InspectorRail / ParametersPanel / EffectsPanel / PatternPanel / TextPanel. Kills the Inspector↔Parameters "menubar changes" swap.
- **Layer creation defaults → full-frame** — `layerDefaults` in `state.jsx`: loop / misc / kinetic / pattern / photo / background come in **filling the frame** (labs parity — one generator per frame); shape / text / path stay **placed boxes**. The old arbitrary 480×480 (and 600×600 kinetic) were unapproved port-time defaults, removed.
- **Default aspect 4:5** — `lib/appSettings.js` default + `state.jsx` initial state (was 1:1).
- **File → New** — `MenuTop.jsx`: confirm-guarded, clears the localStorage draft, reloads to a clean default. (There was only "Clear" = empty-layers-only.)
- **Scrollbar jerk — root-caused in-browser + fixed.** The real rail scroller is `.kol-compose-inspector-body` (+ the SelectionPalettePanel `flex-1` body), clamped to ~397px with `scrollbar-gutter: auto` — NOT the `.kol-editor-rail-body` an earlier audit gutter'd (674px, never scrolls). Added `scrollbar-gutter: stable` to the real scrollers; proven with Playwright (forced classic 14px scrollbar → content width constant 305px with/without the bar). Only bites users with "always show scrollbars".

### Orbit tool (source)
- New viewport **MODE** (shortcut **C**, camera icon in the tool bar; `state/tools.jsx`, `state/keymap.js`), replacing the per-layer "Camera drag" toggle — a mode can't fight layer-move (CanvasArea no-ops the stage in orbit).
- Rig re-keyed from `layer.cameraDrag` → the active tool in `LayerRenderer.jsx` (`useCameraKeysDrag`, all 4 camera components).
- **Works on 2D loops too** via `resolveCameraKeys(def)` in `loops/registry.js`: 3D → explicit `cameraKeys`; field/pattern → `{drag→camAngle, wheel→camZoom}`; shape/simple → `{wheel→vpZoom}` (no static angle to rotate). Rig guards the no-pitch case + reads schema from `.params` and `.camera`. Verified against real defs via Playwright.

### `.kol/` migration + docs vault (`/kol-migrate-structure`)
- **Structure:** `docs/llm-context/` → `.kol/llm-context/`; `docs/_framework/` retired for the **canon `kol-docs-{fm,md,lib}` packages** in `.kol/docs-framework/`; `plan.md`/`history.md` → `.kol/llm-context/`.
- **`LLM_RULES.md` → symlink** to the generic dotfiles boot file (`~/.dotfiles/.../03-scaffold-llm-context/LLM_RULES.md`), gitignored. (First authored a repo copy — corrected after reading `scaffold-llm-context`; the boot file is generic, repo facts live in `.kol/llm-context/`.)
- **Docs vault** (`docs/documentation/`, 11 agents, 35 md files, all wikilinks resolve): 00-overview · 01-hierarchy · 02-layers · 03-generative · 04-effects · 05-parameters-binding · 06-camera-motion · 07-type-family · 08-export · 09-media · 10-research; each a folder with INDEX.md (+ sub-docs for the big ones). Plus `docs/operations/` (build/deploy/packaging machinery sibling), `docs/INDEX.md`, `docs/documentation/INDEX.md`, `.obsidian/` (kol-vault shape, gitignored).
- Section links normalized to `[[NN-section/INDEX|…]]`; cross-vault refs fixed; all `project/kol-design-editor` tags.
- Removed stale repo-local `.claude/` (two old skill copies; everything's dotfiles-backed).

### Cross-repo side-arc — `~/.dotfiles` skill ecosystem
- `kol-migrate-structure` rewritten to **delegate** (boot symlink → `scaffold-llm-context`, framework/docs → `scaffold-docs-system`) instead of reimplementing them — the source of the boot-file symlink-vs-author contradiction.
- `kol-docs-overview` broadened into the whole-structure front door (`.kol/` + `docs/` + who-owns-what).
- Ownership cross-refs added to both scaffolders; `docs/16-claude-agents/{01,02}` updated (LLM_RULES-is-a-symlink fact, delegation note).

## Current State
### Working
- `pnpm build` + `pnpm build:lib` GREEN after the source fixes. Docs are markdown (no build).
- Repo fully on the `.kol/` convention; boot symlink + docs vault + framework all conformant.

### Known Issues / owed
- **▶ User visual check** still owed on the parity surfaces + these fixes (orbit on 2D/3D, full-frame layers, the panel header, scrollbar with classic scrollbars).
- Dotfiles edits are cross-repo — user owns that git.
- KOL package bumps still deferred (component 0.1.2→0.4.0, etc.).

## Next Steps
1. Live visual check across the new surfaces.
2. Deferred parity nice-to-haves (distort path persistence, gamepad button-actions, seed-field unify).
3. Deferred pool: multi-canvas/frame proposal, Interfaces→Misc, Tools→Layouts/Assets.
