# Session: non-destructive booleans, Figma panel model, mode removal

**Date:** 2026-07-03 (twentieth run)
**Agent:** Grim (Fable 5)
**Summary:** Three waves since the de-indent log: the layers panel now follows the Figma container/state model; booleans are non-destructive with flatten/release; the mode architecture is gone — one editor at `/`, palette as a Tools modal, pattern/text as selection-driven rail tabs.

## Changes made

- **Layers panel (Figma model):** layers nest one 16px step inside Canvas (top row, container); chevrons paint on panel-hover only, containers only; hover grey / selected accent, selected containers tint their children; eye/lock visible on selected rows; + in the tab row; trash dropped (Del covers it); drag-reorder everywhere — within a parent, child → top level, top level → into group/bool — with the accent drop-line (`reparentLayer`).
- **Booleans non-destructive:** ops wrap operands into a `bool` layer (live recompute, cached; children edit from the panel; bounds auto-refit on child edits); **Vector menu**: Flatten shape (bake, ⌘E semantics) + Release boolean (un-boolean, ungroup scope); toolbar's four boolean buttons → one dropdown button (shape-tool fold pattern). Terminology: "boolean", never "group".
- **Mode removal:** editor at `/` (old `/editor/*` redirects); Mode menu gone; **Tools → Color** opens `PaletteModal` (harmony wheel w/ analogous/complementary/triadic re-hue, pool/mode, swatches, referential layout preview — no logo/aspect/send-to-compose); **Pattern**/**Text** rail tabs on selection carry the mode-grade control surfaces (one home per control — styling fields left Parameters; "Pattern mode"/"Type mode" buttons deleted); File → Open inserts pattern/type items as layers, palette items open the modal.
- **Fixed en route:** HMR context-identity crash (`composeContext.js` split); `GeneratorLibraryProvider` was mounted nowhere — all library saves/opens silently no-opped (now mounted in Editor); near-miss name collision (`ColorModal` = per-layer color panel, kept; new modal is `PaletteModal`).

`pnpm build` green.

## Known gaps / dead code

- Variable-axis type: saved axis items insert as static text; Text tab has no axis block (text layers render via TypeBlock, no axis-morph path).
- Dead after mode removal (left in place, deletion sweep on ask): `registry/` dir, mode bodies (`modes/palette|pattern|type` labs), `PaletteInspector.jsx`, `PalettePanel.jsx`.
- Bool: children's bound props don't animate the result; bool layers are top-level-release only.

## Next steps

1. **Text-tools audit** (user-ordered): all text-based layers/tools/types vs kol-labs-single — text layer, kinetic, Type loops, para-type, fonts; fix Para Type/Pattern(Effects) mis-homing in the loop picker.
2. Deferred pool: multi-canvas/frame model proposal; Tools → Layouts + Assets manager; dead-code sweep.
