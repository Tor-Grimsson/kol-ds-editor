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

// Live per-role opacity multipliers. The prototypes draw most elements at low
// authored alpha; these scale each role's alpha (1 = as authored). The editor
// exposes no Edit-tab opacity controls, so these stay at 1 — kept because
// pc() and the tint read them.
export const OPACITY = { fg: 1, accent: 1, dim: 1, warm: 1 }
export const setOpacity = (o) => Object.assign(OPACITY, o)
