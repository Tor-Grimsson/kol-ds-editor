# Session: vector/shape-builder audit + 6 fixes + flip feature

**Date:** 2026-07-01
**Agent:** Grim (Claude Fable)
**Summary:** Audited the whole vector path end to end (path-math, PathNodeOverlay, CanvasArea, LayerRenderer, SelectionOverlay, inspector, state/history). Core model is sound; fixed the 4 real bugs + 2 UX items found. Roadmap gaps confirmed, plus one new: no open↔close path toggle. Then: evaluated importing kol-editor's transform functions (verdict below) and built real flip-h/flip-v.

## Part 2 — kol-editor extraction verdict + flip

**Extraction verdict (extends ARCHITECTURE §4):** kol-editor's toolbar functions are one-liners on Konva's transform props — nothing liftable. Its `applyFlip` is a *fake* (rotation tweak, can't mirror asymmetric shapes), `applyCropRatio` is just aspect resize (we have aspect lock), zoom is worse than ours. Its two icon sets: `assets/icons/tui/` = third-party Toast UI glyphs (32×32 hairline, hardcoded #434343 — style-clashes with our 24×24/2.5px set); `loaders/icons/svg/18-editor/` = 24×24 currentColor Material-ish. Neither imported — glyphs get redrawn in house style as features land.

**Flip feature (real mirror, all layer types):**
- `state.jsx` — `flipLayer(id, 'h'|'v')` + `flipSelected(axis)` (transaction-wrapped). Paths bake the mirror into nodes (`scalePathNodes(-1)` + renormalize) so node-edit chrome stays true; other positioned layers toggle `flipX`/`flipY` flags. Cover types + locked + unbounded layers skipped.
- `LayerRenderer.jsx` — flags render as `transform: scale(±1, ±1)` in `layerStyle` (center origin).
- `build.js` — `wrap()` emits the equivalent SVG transform about the bbox center. **Also fixed: `path` layers were missing from the export dispatch entirely** — pen-drawn paths silently vanished from SVG/PNG downloads. New `pathLayerSvg` mirrors PathLayer semantics; groups recurse so grouped paths export too.
- Shortcuts `⇧H`/`⇧V` (Figma bindings) in keymap + CanvasArea dispatch; auto-appears in the shortcuts cheat sheet.
- Inspector: "Flip" row under Position, two icon buttons (active tint when flag set); new `flip-h.svg`/`flip-v.svg` drawn in house style (24×24, 2.5px, tui glyph as shape reference).

## Changes Made

- **Inspector W/H now scales path nodes** — `scalePathNodes` added to `path-math.js`; `PositionFields` (LayerInspector) patches scaled nodes with the box for `path` layers. Was writing w/h the renderer ignored.
- **Anchor clicks no longer pollute undo** — `PathNodeOverlay` only writes the normalize result if the drag actually moved (`movedRef`); bare select-clicks commit as no-ops.
- **Fixed-1080 `CANVAS_H` bugs on non-1:1 aspects** — CanvasArea now uses aspect-derived `viewH` for snap targets, create-drag clamping, pattern default size, and the line-preview viewBox (was Y-stretched on tall aspects).
- **Path hit target = painted geometry** — `PathLayer` svg root gets `pointerEvents: none`, the `<path>` re-enables via `visiblePainted`. Open stroke-only paths no longer steal clicks across their whole bbox.
- **Zoom-constant editing chrome** — new `CanvasZoomContext` exported from `Canvas.jsx` (provided by `PanZoomViewport`); `PathNodeOverlay` anchors/knobs and `SelectionOverlay` handles/outline/label divide by zoom. Also fixed `CanvasFrame`'s fit-scale to read `offsetWidth` instead of gbcr (gbcr folds in the zoom transform → double-scale on window-resize-while-zoomed).
- **Pen micro-drag dead zone** — ~3 screen px threshold before a click-drag pulls handles; a twitch leaves a true corner (null handles).

## Not fixed (known, deliberate)

- Marquee still selects hidden/locked layers; nudge floods history (no coalescing); paths inside groups can't be node-edited (updateLayer is top-level only); pen-preview node squares still scale with zoom; thin strokes are thin hit targets (no fat invisible hit path yet).

## Part 3 — rotation + crop + toolbar icon redraw

**Rotation (model-level, all positioned layers):**
- `rotation` (deg, clockwise) rendered as `rotate() scale()` about center in both DOM (`LayerRenderer`) and SVG export (`build.js wrap()`), composed with flip.
- Rotate handle (circle above top edge) on `SelectionOverlay` — new `showRotate` prop so paths (which hide resize handles) still rotate. Drag = `rotate` mode in CanvasArea, ⇧ snaps 15°.
- **Rotated resize**: pointer deltas rotate into the layer's local frame; x/y re-derived so the point opposite the dragged handle stays world-fixed (Figma behavior).
- Inspector: `R` field merged into "Rotate / flip" row.
- **Paths bake rotation on node-edit entry** (`rotatePathNodes` in path-math + `enterNodeEdit`) — node editing always operates rotation-free, same philosophy as flip-baking.

**Crop (photo layers):**
- Model: explicit crop window `{imgX,imgY,imgW,imgH}` (frame-local px); absent = legacy object-fit render. Init on first crop entry from the layer's fit (async via `Image()` natural size).
- Enter: double-click photo or inspector crop button (`kol:enter-crop` CustomEvent). Exit: Esc/Enter/deselect.
- `CropOverlay.jsx` (new): full-extent ghost image, pan-inside-frame (clamped, rotation-aware deltas), 8 crop handles that move the frame while the image stays world-fixed. Handles hidden on rotated photos (ponytail: pan-only).
- Normal frame resize scales the crop window proportionally (cropped photos resize like uncropped).
- Export: clipPath + explicit image rect in `photoLayerSvg`.

**Icons:** redrew the full toolbar set at consistent 2px stroke (was mixed 2.5/fills, pen read as an "arch" at 14px): cursor, text, **pen = real nib**, rect, ellipse, line, triangle, polygon, star, **pattern = 2×2 tile** (was 9-dot mush); flip-h/v re-weighted; new `crop.svg`.

**Toolbar rescale + action group (reference: editor.kolkrabbi.io toolbar):** buttons 28→36px, glyphs 14→22px, bar h-10→h-12 (`BTN`/`ICON` consts in ToolPalette). Added divider-separated actions wired to real functions: flip-h/v (`flipSelected`), rotate ∓90° (`rotation` prop, primary selection), crop (`kol:enter-crop`), duplicate — disabled states follow selection. New glyphs authored: `rotate-left/right`, `zoom`, `pencil`, `image`, `duplicate` (zoom/pencil/image are registry-only until their tools exist).

**Part 4 — zoom tool, image insert, toolbar tooltips:**
- **Zoom tool** (`Z`, magnifier in tool group): click = 2× in at pointer, Alt+click = ½ out. Handled on CanvasArea's outer wrapper (backdrop zooms too) → `kol:zoom-at` CustomEvent → `PanZoomViewport.zoomAt` (animated, pointer-anchored). Stage router short-circuits while armed — never creates/selects.
- **Image insert** (toolbar image button): hidden file input → FileReader data URL → photo layer fit within 720px, centered. First real photo-insert path in the editor.
- **Toolbar tooltips**: pure-CSS `[data-kol-tip]` hover labels in kol-editor.css (400ms hover-intent via animation-delay, no JS); replaced native `title` on all toolbar buttons, shortcut shown when one exists.

**Known simplifications:** flip on a rotated layer mirrors content in the local frame (Figma also negates the rotation); marquee/snap still use unrotated AABBs; crop handles pan-only when rotated; image insert centers against CANVAS_H (1080) regardless of aspect.

**Part 5 — path bbox-resize (roadmap item CLOSED):** paths now show the full 8-handle transform box like any shape. Resize drag snapshots the node list (`startBox.nodes`) and ratio-scales anchors + handles with the box (`scalePathNodes`) — works with aspect lock and rotated resize since it rides the same w/h pipeline. Node-edit (dbl-click / A) still swaps to node chrome.

**Part 6 — boolean operations (roadmap item CLOSED):** unite / subtract / intersect / exclude for closed vector layers via **paper.js** (paper-core, headless — new dep; curve-TRUE booleans, paper's segment model maps 1:1 to our `{x,y,in,out}` nodes; kol-editor's polygon-clipping would have flattened curves).
- `boolean-ops.js` (new): layer→paper conversion (closed paths incl. holes, rect/ellipse/triangle/polygon/star shapes; rotation/flip applied about box center), z-order bottom-first fold (subtract = bottom minus uppers, Figma semantics), result→rings.
- **Path model extended with `holes`** (hole rings from subtract/exclude), rendered/exported with `fill-rule: evenodd`. All geometry ops are holes-aware: `normalizePathRings` in path-math; flip, node-edit commit/delete, rotation bake, bbox-resize, inspector W/H all shift/scale/rotate holes in lockstep. Node editing edits the outer ring only (holes ride along).
- `state.booleanSelected(op)`: replaces inputs with one `path` layer at the topmost input's z-position, paint adopted from the bottom layer; empty results (disjoint intersect) no-op. Destructive v1 — no boolean groups.
- Toolbar: 4 boolean buttons (new `bool-*` icons) enabled at ≥2 eligible selected layers.
- Also fixed: shape dropdown rendered under the canvas rulers (`z-50` on the PopoverPanel; rulers are z-4).
- `pnpm build` green (7.39MB chunk — pre-existing warning, paper adds ~200KB).

## Next Steps

1. Shape-editor parity — remaining: mid-segment node insertion, corner↔smooth toggle, **open↔close path toggle**, flatten, export-settings UI. (bbox-resize now DONE — drag handles + typed W/H both scale nodes.)
2. `git init` + initial commit (still no safety net).
