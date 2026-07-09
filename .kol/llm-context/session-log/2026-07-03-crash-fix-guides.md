# Session: delete-crash fix (live-verified) + ruler guides

**Date:** 2026-07-03 (ninth run)
**Agent:** Grim (Claude Fable) + 1 builder agent
**Summary:** The blocking blank-screen bug root-caused via Playwright repro and fixed at three layers; console input warnings fixed; Figma-style ruler guides shipped (live-verified, one real pointer-event bug caught before ship). `pnpm build` green.

## The crash
- **Repro (Playwright):** engine loop + Parameters tab open + delete from canvas → `PrimitiveEngine.dispose()` threw on `this.spot.dispose()` (spotlight stripped in the port; its dispose line survived) → throw inside React unmount cleanup kills the whole tree → blank screen; the localStorage draft then faithfully restored the crashing state ("too persistent").
- **Fixes:** dead dispose line removed; BOTH GL hosts wrap teardown in try/catch (engine teardown can never blank the editor again); **EditorErrorBoundary** around the editor root — crash screen offers "Reload (keep canvas)" / "Reset canvas and reload" (clears draft). Hard refresh deliberately keeps the draft; the boundary is the poisoned-draft escape hatch.
- Verified live: exact repro sequence now deletes cleanly, zero console errors.

## Console warnings
- CanvasInspector `SizeField` passed `defaultValue` into DS `Input` (which always sets `value` internally) → both React controlled-input warnings. Now a controlled draft committed on blur/Enter.

## Ruler guides (agent, live-verified)
- `guides: {h:[], v:[]}` in compose state (virtual px, draft-persisted, OUT of undo); drag from ruler creates (shell announces via `kol:guide-drag-start`, compose owns the drag), drag moves, release over the ruler/past the edge deletes; accent lines with screen-constant grab slop; move-drag snaps to guides (`computeSnapTargets` 5th param).
- Live verification caught a real bug pre-ship: ruler `preventDefault()` on pointerdown suppresses the compat mouse stream — guide drags moved to pointer events.
- Bonus fix: `showRulers` had gone dead in the shell (destructured, never consumed — lost in an edit collision); ⇧R now actually hides rulers.
- Known limits: guides can't be created while rulers hidden; guides on an empty canvas don't persist (draft only writes when layers exist — pre-existing behavior); move/delete/snap share verified machinery but weren't exercised live.

## Next Steps
1. User review resumes (was blocked on the crash).
2. Quick manual pass on guide move/delete/snap.
