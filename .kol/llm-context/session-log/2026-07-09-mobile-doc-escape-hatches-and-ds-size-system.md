# Session: mobile doc + tablet/desktop escape hatches + DS size-system bumps (0.5.0 → 0.6.0)

**Date:** 2026-07-09
**Agent:** Grim (Opus 4.8)
**Summary:** Finished the mobile chrome — wrote its doc section, wired the tablet↔desktop escape hatches and a desktop "Simple mode" entry, and drove two DS bumps (0.5.0 SegmentedToggle `lg` + 0.6.0 sticky-hover fix) that grew a real `sm/md/lg` size system across Button/SegmentedToggle/Input. UI now user-approved; 12-mobile doc graduated draft → active.

## Changes Made

### Files Modified
- `docs/documentation/12-mobile/INDEX.md` — **NEW → active.** Full reference: capability gate + route table + flag lifecycle, three screens + insert path, tabbed overlay, touch-size control system, aspect/Fill, ephemeral persistDraft.
- `docs/documentation/INDEX.md` — row 12 added, then de-drafted.
- `src/App.jsx` — `?view=desktop` / `?view=mobile` branches (mobile clears the tablet desktop flag).
- `src/editor/mobile/device.js` — `goDesktop()` (sets flag + `?view=desktop`) and `goMobile()` (`?view=mobile`); navigate by URL, not flag+reload — a forced `?view=mobile` would survive reload and loop the old "Use desktop editor".
- `src/editor/mobile/MobileView.jsx` — "Use desktop editor" → `goDesktop`; entry/category buttons → `lg`.
- `src/editor/shell/MenuTop.jsx` — **Settings → Simple mode** (`goMobile`) — the desktop entry into the generative chrome.
- `src/editor/mobile/MobileOverlay.jsx` — swapped the SegmentedToggle specificity hack (`SEG_FIX`) for real `size="lg"` on all three toggles once 0.5.0 shipped; all buttons `lg`.
- `src/editor/params/TransportBar.jsx` — new `size` prop (`sm` default = desktop byte-identical; `lg` = 40px cells, 20px icons, `Input size="lg"`); mobile passes `size="lg"`.
- `package.json` — kol-component + kol-theme `0.4.0/0.3.0 → 0.5.0 → 0.6.0`.

### The two DS bumps (authored in kol-design-system, consumed here)
- **0.5.0** — `SegmentedToggle` gained `sm/md/lg` mirroring Button; retired the mobile CSS hack. (Also changed size *semantics* app-wide: sm 16→26, md 26→32 — desktop footer toggles may have shifted, unverified.)
- **0.6.0** — every `.kol-btn-*:hover` wrapped in `@media (hover: hover)`. Root cause of the "one button transparent" mystery: `kol-btn-primary:hover` → translucent `--kol-fg-08`, and `:hover` *sticks after a tap* on touch, so the last-pressed button read see-through. Verified the guard shipped (`kol-components-atoms.css:188+`).

## Current State

### Working
- Mobile chrome **user-approved on device** — tabs, lg controls all lined up, solid buttons (no stuck-hover), transport strip at touch scale, aspect + Fill.
- Desktop↔mobile round-trip browser-verified: Settings → Simple mode → `?view=mobile` → Use desktop editor → `?view=desktop`, no loop.
- Both builds green throughout. Docs current (12-mobile active, all wikilinks resolve).

### Known Issues / process notes
- **Two invisible layers cost ~4h:** the hover bug lived in the DS CSS (not the editor), and every fix *looked* broken because the running dev server kept serving stale pre-bundled 0.4.0 until a restart re-optimized. Lesson reinforced: after a dep bump, the dev server must restart before any runtime check means anything; touch bugs can't be seen from desktop.
- **Stale `peerDependencies`** — still `kol-component ^0.1.2` / `kol-theme ^0.1.1`; the published `@kolkrabbi/design-editor` lib contract excludes even 0.4.0. Needs a range bump — user's call on how wide. Untouched this session.
- **0.5.0 size-semantics shift** unverified on the desktop footer SegmentedToggles (sm/md heights changed).
- `pnpm-workspace.yaml` `minimumReleaseAgeExclude` auto-grew 0.5.0/0.6.0 entries on install (pnpm 11 behaviour) — cosmetic.

## Next Steps
1. Bump the stale `peerDependencies` ranges to match (publish-contract decision).
2. Glance at the desktop footer SegmentedToggles after the 0.5.0 size shift.
3. Mobile video-insert retest on device (unverified since the full-bleed fix).
