# Session: param-graph Phase 1 (schema) + Phase 2 motion slice

**Date:** 2026-07-02
**Agent:** Grim (Claude Opus)
**Summary:** Built the param-graph spine and a working motion vertical slice. Shape layer is now schema-driven; a layer's `rotation` can be keyframed (Spin) or mouse-modulated, live, via a transport clock. `pnpm build` green. Autonomous multi-phase run.

## Phase 1 — param schema + auto-render inspector (shape done)
- `src/editor/params/schema.js` — canonical descriptor grammar (adopted from kol-labs `loops/contract.js` so imported loops drop in): `{ key, label, type, default, min?, max?, step?, options?, format?, when?, animatable? }`. Helpers `schemaDefaults` / `visibleParams` / `isAnimatable`. Dev self-check.
- `src/editor/params/AutoControls.jsx` — renders a schema → controls (range→Slider, select→Dropdown, segmented/toggle→ViewToggle, color→ColorField). Conditional `when` hide/show. Writes through the caller's `setProp` (history/coalesce intact). `renderAnimate` seam for the timeline.
- `src/editor/params/schemas/shape.js` — SHAPE_SCHEMA (kind/variant/fit/sides/points/innerRatio/slope).
- **LayerInspector**: shape's ~70 lines of hand-wired per-kind JSX replaced with one `<AutoControls schema={SHAPE_SCHEMA}>`. Extracted **ColorField → `inspectors/ColorField.jsx`** (re-exported for back-compat) to break the AutoControls↔LayerInspector import cycle. Removed now-dead consts/imports.

## Phase 2 — transport + resolver + motion (vertical slice)
- `src/editor/params/easing.js` — cubic-bezier easing (RFC Q1: bezier tuple in data, `'hold'` sentinel), named presets, Newton-Raphson solve. Self-check.
- `src/editor/params/resolve.js` — value tagged-union resolver (RFC Q2: inline on layer). `<raw>`=constant (identity, free back-compat), `{bind:'track',keys}` (keyframes over `t`), `{bind:'mod',source,transform}` (live input). `hasBindings`/`resolveLayer`. Self-check.
- `src/editor/params/transport.js` — module-level clock singleton: `t∈[0,1]` wrapping at `loopSeconds`, live pointer, external store via `useSyncExternalStore`. `useTransportCtx(enabled)` — bound layers subscribe + re-render per tick; **static layers pass `false`, never subscribe, zero cost** (RAF idles when no play + no subs).
- **LayerRenderer** resolves bound props each frame (`hasBindings` gate → `useTransportCtx` → `resolveLayer`); static path unchanged.
- **MotionControl** (inspector): `Motion · rotation` segmented None/Spin/Mouse X — binds `layer.rotation` to a track or mouseX mod. **TransportBar** (bottom-left of canvas): play/pause + loop seconds.
- **Chrome guards**: rotation may now be a binding object → 5 `typeof === 'number'` guards (SelectionOverlay, CanvasArea rotate/resize/node-edit, build.js export) so animated props don't crash editing chrome. Editing chrome on animated props uses base rotation (v1 limitation).

## How to try
Select a shape → inspector **Motion · rotation** → **Spin** + press ▶ (bottom-left) → spins once per loop. Or **Mouse X** → follows the cursor live (no play needed — modulation is live).

## Not done (clearly-scoped next)
- Phase 1 breadth: pattern/text/photo still hand-wired (schema-ize their simple knobs — mechanical, left to avoid regressions in their bespoke rules/mode/upload UI).
- Phase 2 full: keyframe **timeline UI with tracks** (only the binding model + one demo prop exist); more sources (audio/time-expr lift from the repo); per-field animate dots (the `renderAnimate` seam is ready); color-track interpolation; export baking (still preview-only per RFC Q3).

## Next Steps
1. Extend AutoControls to pattern/text/photo simple params (Phase 1 breadth).
2. Full timeline dock + per-field bind affordance (Phase 2).
3. Still no git repo.
