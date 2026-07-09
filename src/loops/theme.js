import { resolveTheme } from './lib/themes.js'

// Recolour a loop's params object by each colour-param's tagged `role`. A loop's
// `type:'color'` schema entries carry `role: 'bg' | 'fg' | 'accent' | 'dim' |
// 'warm'`; we resolve the chosen theme (+ invert) and patch every roled colour
// to the theme's slot. dim/warm complete the five-role penrose scheme (labs
// PenrosePage retints them per theme, accent-falling-back when a theme lacks
// them). Params without a role (or non-colour params) are left untouched, so
// structural values and any user edits to non-roled colours survive a switch.
export function themeParams(params, paramSchema, themeId, invert) {
  const t = resolveTheme(themeId, invert)
  const role = { bg: t.bg, fg: t.fg, accent: t.accent, dim: t.dim ?? t.accent, warm: t.warm ?? t.accent }
  const out = { ...params }
  for (const p of paramSchema || []) {
    if (p.type === 'color' && p.role && role[p.role]) out[p.key] = role[p.role]
  }
  return out
}
