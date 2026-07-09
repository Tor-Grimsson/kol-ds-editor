// Live palette + opacity singletons for the penrose prototypes — ported from
// kol-labs-single src/pages/penrose/settings.js, minus the page chrome
// (FONTS / FRAMES / THEMES): the editor's loop host resolves the theme and
// writes the five roles here each tick (host.js → syncPalette).
//
// The prototype draw helpers (common.js → pc / rampRGB / roleRGB) and the
// colour tint (tint.js) read these live, so all ~100 prototype files retint
// without editing any of them. Initial values are the labs 'ink' theme; the
// host overwrites them before the first step.

export const PALETTE = {
  bg: '#0a0b14',
  fg: '#f0ead8',
  dim: '#4a4d60',
  accent: '#8b8fd6',
  warm: '#f3c9c4',
  grid: 'rgba(240, 234, 216, 0.07)',
}
export const setPalette = (vars) => Object.assign(PALETTE, vars)

// Live per-role opacity multipliers (0–5; 1 = as authored). The prototypes
// draw most elements at low authored alpha; pc() and the tint scale each
// role's alpha by these. dim defaults to 5 — labs PenrosePage boots with
// { fg: 1, accent: 1, dim: 5, warm: 1 }, so dim at 1 rendered the editor's
// dim strokes 5× fainter than labs (the silent visual-parity bug).
export const OPACITY = { fg: 1, accent: 1, dim: 5, warm: 1 }
export const setOpacity = (o) => Object.assign(OPACITY, o)

// Layer params → the live singleton (labs setOpacity(opacity) parity). The
// penrose host calls this next to syncPalette once the four role-opacity
// schema entries land (fgOpacity/accentOpacity/dimOpacity/warmOpacity).
export const syncOpacity = (p) => setOpacity({
  fg: p.fgOpacity ?? 1,
  accent: p.accentOpacity ?? 1,
  dim: p.dimOpacity ?? 5,
  warm: p.warmOpacity ?? 1,
})
