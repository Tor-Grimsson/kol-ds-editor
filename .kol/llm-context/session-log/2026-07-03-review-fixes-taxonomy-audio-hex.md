# Session: review blockers — loop picker hierarchy, audio→File, hex-none

**Date:** 2026-07-03 (sixteenth run)
**Agent:** Grim (Fable 5)
**Summary:** Three review blockers fixed. The big one: the previous run's taxonomy fix landed on the wrong dropdown (ParametersPanel) and left LayerInspector's flat Category list untouched — and neither matched the labs picker model. Both now share one `LoopPicker` with the real labs hierarchy.

## Changes made

- **`inspectors/LoopPicker.jsx`** — NEW shared picker, replaces duplicated pickers in LayerInspector (`LoopPickerRows` deleted) + ParametersPanel: **Category** = labs page (Scanline · Pattern · Loops · … · Para Type, from GENERATIVE_TREE) + group dropdown when the page spans registry groups (Loops, 3D Scene); **Preset** = sub-category dropdown (Scanline → Spaced/Glyph/Lattice/Vortex/Rings/Spiral) over plain-name presets (Drift/Fine/…) — the labs ScanlineEditor rail model verbatim. Self-sources `updateLayer` from compose state.
- **Audio row → File tab** (`shell/panels/EditorFooter.jsx`): moved out of Transport per labs; third option relabeled **Track → File** (`params/AudioInputRow.jsx`, behavior already file-picker).
- **ColorField None state** (`inspectors/ColorField.jsx`): hex input shows `# –` (placeholder) instead of the resolved `#FFFFFF` fallback when value is null — fixes the "disabled but says white" contradiction on canvas Background and every other None-able color field.

`pnpm build` green.

## Next steps

1. Layers panel TLC — proposal sent (panel chrome: header + into tab row, slim footer, empty-state hint); awaiting go.
2. User resumes review.
