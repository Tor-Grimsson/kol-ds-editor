# Session: mobile overlay tabbed rework — transparency, TransportBar, aspects, touch sizing

**Date:** 2026-07-08
**Agent:** Grim (Fable 5)
**Summary:** Reworked the mobile modal per user direction: see-through borderless panel, content split into SegmentedToggle tabs (Generate / Transport / Output), the established `TransportBar` reused verbatim, all export-spec aspects + Fill exposed in Output, everything sized to touch (lg buttons, 40px/16px toggles). Session ended with the user frustrated at the iteration count — treat the current UI as functional but NOT design-approved.

## Changes Made

### Files Modified
- `src/editor/mobile/MobileOverlay.jsx` — rebuilt as tabs: **Generate** (Preset ⚄ / Generator on top — answers "preset name top-left but preset control at bottom" — then Randomize all + 2-col scope grid) · **Transport** (`TransportBar` drop-in, the established ▶❚❚ · Loop/N s · ■◀◀) · **Output** (two 4-cell aspect rows `9:16 3:5 4:5 1:1` / `5:4 5:3 16:9 Fill` + Download / Hide UI / Start over). Panel: `color-mix(surface-primary 35%, transparent)` + blur-sm, **no borders anywhere**, radius token. Collapsed = `[Randomize all][title ▴]` (randomize left). All buttons `size="lg"`; toggles use the footer's TOGGLE_FIX recipe at touch scale (`h-10 border-fg-04 [&_.kol-seg-cell]:text-[16px]` — DS hardcodes `kol-mono-12` on cells, wrapper override by specificity; `size="sm"` on SegmentedToggle is 16px/no-type, unusable).
- `src/editor/mobile/MobileView.jsx` — entry/category buttons → `lg`; `stageFit` state ('contain'/'cover'); `setStageAspect(id)`: real `setAspect` + refit of the active full-frame layer (mobile invariant: the layer IS the composition), `'fill'` = display-only cover.
- `src/editor/shell/Canvas.jsx` — new `fit` prop ('contain' default | 'cover'): cover swaps the letterbox width formula to `max(100cqw, 100cqh×ratio)` + overflow-hidden — display-side crop only.
- `src/editor/OutputView.jsx` — `OutputStage` takes `fit`, passes through to Canvas.

### Features Added/Removed
- **Aspect switching on mobile** (all export-spec presets) — re-frames the composition, so Download exports at the chosen spec; **Fill** view for full-display cover (screen-record friendly).
- Removed the invented Slower/`N`s/Faster tempo row — `TransportBar` owns tempo now.

## Current State

### Working
- Verified via driven browser (390×844): tab switching, aspect 16:9 → frame 1.778, Fill → 1500×844 cover, back to 4:5 → 0.800; toggle tracks render with proper padding; transparency visible over art (user's phone screenshot confirmed see-through).
- `pnpm build` green throughout (last 2.76s).

### Known Issues
- **UI not design-approved.** User ended the session out of patience after repeated misses (sm-toggle bug, size sweep missing entry/category, toggle text lagging the button bump). Expect a fresh-eyes design pass, not incremental patches.
- Toggle cell text override is a specificity hack (`[&_.kol-seg-cell]:text-[16px]`) — a DS-side `size="lg"` SegmentedToggle variant would be the clean fix (kol-component candidate).
- Mobile video insert still unverified on device. `kol-helper-11` bump regression still awaiting the user's call (desktop inspector labels render 16px).
- Aspect change mid-session refits only the ACTIVE layer (mobile is single-layer by flow, fine today).

## Next Steps
1. User design review of the mobile chrome on device — collect verdicts in one batch before touching code again.
2. `kol-helper-11` decision (repo sweep vs DS restore).
3. Consider DS-side SegmentedToggle `lg` variant to retire the specificity hack.
