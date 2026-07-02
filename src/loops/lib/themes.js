// themes — one canonical theme set for the experiment pages (math, loops, 3D
// scene, penrose). Themes are PLAIN JS COLOR VALUES (not CSS vars) because
// WebGL/three pages can't read CSS vars into shaders/materials; DOM/canvas pages
// read the same values directly. `invert` flips light<->dark on top of any theme.
//
// Each theme: { id, label, bg, fg, accent, dim, warm, grid, gridOpacity }
//   bg  — background / clear colour
//   fg  — primary stroke / line / text colour (bright structure)
//   accent — secondary highlight colour (mid structure)
//   dim — muted / recessive stroke colour (dark structure)
//   warm — warm highlight colour (peach / amber accents)
//   grid — axis/grid colour (drawn at gridOpacity)
//
// dim/warm round the set out to a full five-role palette so a multi-hue tint
// (penrose) reads as a real scheme, not one accent repeated. Pages that only
// need bg/fg/accent/grid (math/loops/3D) simply ignore the extra two.
//
// The first five ids (dark/paper/blueprint/mono/amber) match the legacy
// math `mathStyle` themes so re-exporting from here doesn't change any defaults.

export const THEMES = [
  { id: 'dark',      label: 'Dark',      bg: '#050506', fg: '#9ec1ff', accent: '#9ec1ff', dim: '#4a4d60', warm: '#f3c9c4', grid: '#ffffff', gridOpacity: 0.10 },
  { id: 'paper',     label: 'Paper',     bg: '#f4f1ea', fg: '#16202e', accent: '#3b5b8a', dim: '#6b7280', warm: '#b0623a', grid: '#16202e', gridOpacity: 0.14 },
  { id: 'blueprint', label: 'Blueprint', bg: '#0b1d3a', fg: '#8fd3ff', accent: '#8fd3ff', dim: '#3f5a78', warm: '#e3a054', grid: '#8fd3ff', gridOpacity: 0.20 },
  { id: 'mono',      label: 'Mono',      bg: '#0a0a0a', fg: '#ededed', accent: '#ededed', dim: '#8a8a8a', warm: '#d8c4a0', grid: '#ffffff', gridOpacity: 0.08 },
  { id: 'amber',     label: 'Amber',     bg: '#0c0a06', fg: '#ffb35c', accent: '#ffcf8a', dim: '#8a6a3a', warm: '#ffd8a0', grid: '#ffcf8a', gridOpacity: 0.12 },
  { id: 'ink',       label: 'Ink',       bg: '#0a0b14', fg: '#f0ead8', accent: '#8b8fd6', dim: '#4a4d60', warm: '#f3c9c4', grid: '#f0ead8', gridOpacity: 0.07 },
  { id: 'slate',     label: 'Slate',     bg: '#12161d', fg: '#e7eef5', accent: '#7fb0d8', dim: '#566273', warm: '#cfe0ee', grid: '#e7eef5', gridOpacity: 0.07 },
  { id: 'plum',      label: 'Plum',      bg: '#120a17', fg: '#f0e6f3', accent: '#c08bd6', dim: '#5e4a66', warm: '#f3c9e8', grid: '#f0e6f3', gridOpacity: 0.07 },
  // KOL DS schema — real brand tokens (cream-100 fg · yellow-300 accent ·
  // blue-200 dim · orange-200 warm), not the accent yellow repeated.
  { id: 'kol',       label: 'KOL',       bg: '#121215', fg: '#FAF7F0', accent: '#FFCF33', dim: '#3F6485', warm: '#E3A054', grid: '#FAF7F0', gridOpacity: 0.10 },
]

export const THEME_OPTIONS = THEMES.map((t) => ({ value: t.id, label: t.label }))

export const DEFAULT_THEME = 'kol'

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

/**
 * Resolve a theme id (+ invert flag) to a concrete colour set. Invert swaps
 * bg<->fg and re-points grid for contrast — its own inverse on the colours, so
 * toggling twice restores the original look.
 */
export function resolveTheme(id, inverted = false) {
  const t = themeById(id)
  if (!inverted) return { ...t }
  return { ...t, bg: t.fg, fg: t.bg, grid: t.bg }
}
