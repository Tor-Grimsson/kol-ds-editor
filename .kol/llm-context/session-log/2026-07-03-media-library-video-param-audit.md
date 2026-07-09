# Session: Phase 8 (bucket library + video sources) + full param-connectivity audit

**Date:** 2026-07-03 (seventh run)
**Agent:** Grim (Claude Fable) + 1 scout + 2 builder agents
**Summary:** The bucket is the internal media library (labs model: admin-API listing + `/media/` same-origin proxy — the CDN sends no CORS headers, the proxy is what keeps filter canvases untainted). Video is a first-class photo source (`srcType:'video'`) through all three render paths. And a full parameter-connectivity audit: every schema param traced to its consumer — real bugs fixed, ~60 dependent params `when`-gated, dead ones removed. `pnpm build` green.

## Phase 8 — media library + video
- `src/editor/library/mediaLibrary.js` (listMedia via `admin.kolkrabbi.io/api/list`, `mediaUrl`, `proxied()` → `/media/`) + `MediaPicker.jsx` (library-only modal grid, 160px lazy thumbs, prefix filter). Vite dev+preview proxy added; prod needs the equivalent rewrite (comment in config).
- Video: plain layers = positioned `<video muted loop>` (no canvas cost); canvas-filtered = fitted source redrawn per transport tick (fresh canvas — fxCore caches key on identity); GL-filtered = in-place redraw + `touchSource()` per drive (CanvasTexture needsUpdate). Export bakes the current frame. Crop gated off for video (4 entry points). Object-URL uploads don't survive reload (labs parity).
- Entry points: File tab (photo) = Upload image / Upload video / From library / Clear; inspector ImageSource gains Library.

## Param audit (the "dud controls" mandate)
Real fixes, beyond the scene3d count-gating that triggered it:
- **ribbon `background`** — host never delivered it (engine.update ignores it); host now calls `setBackground()`.
- **iridescent `palette`** — 100% dead (engine pinned uSpectral=1); exposed the engine's `spectral` toggle + gated palette on it (judgment call, approved: deleting palette would have killed a working engine feature).
- **iridescent/softforms `gloss`** — wrong scale entirely (0–1.5 slider into a 4–90 specular exponent); remapped to labs ranges.
- **Removed** (never read): drift-water/cloth `warp`, lens `bg`, paratype `contrast`.
- **~60 `when`-gates** added so conditionally-consumed params hide until they act (drift per-style, iridescent per-cat/type, scene3d material/camera dependents, forms per-form, ribbon per-material, GL-filter mode dependents, scanline/moire/math/paratype dependents, glass `phase`, scanline-filter look dependents).
- Export parity fixes found en route: text `case:'sentence'` and photo `fit:'fill'` had no build.js branch.
- Rule-d notes (engine-known, schema-unexposed knobs — candidates for future exposure): iridescent relief/angle/winds/…, softforms rimPow/sss/bulge/…, PrimitiveEngine rounding/tube/p/q/detail.

## Next Steps
1. User review round 3 (library picker, video flows, and spot-check formerly-dud params).
2. Phase 9 — modulation sources v2 (scoped in plan.md).
3. Later: prod `/media/` rewrite when deploying; video persistence (library URLs survive, object URLs don't).
