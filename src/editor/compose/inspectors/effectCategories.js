/**
 * Effect category taxonomy (labs nav model: Halftone · Scanline · CRT ·
 * Refraction · FX rack · Pattern) — a presentation-layer mapping over the
 * filter registry, which stays category-free. Ids are listed defensively:
 * an id with no registered filter simply doesn't render, and any registered
 * filter no category claims lands in 'Other' so future filters never vanish
 * from the picker.
 */
const CATEGORIES = [
  { id: 'halftone',   label: 'Halftone',   filterIds: ['fx-ascii', 'fx-halftone-dither', 'fx-bitmap'] },
  { id: 'scanline',   label: 'Scanline',   filterIds: ['scanline'] },
  /* gl-trails joins the CRT family — phosphor-persistence feedback. */
  { id: 'crt',        label: 'CRT',        filterIds: ['gl-disco', 'gl-slitscan', 'gl-scan', 'gl-trails', 'fx-kaleido', 'fx-mirror'] },
  /* glass is a refracting sheet — Refraction, not Pattern. */
  { id: 'refraction', label: 'Refraction', filterIds: ['gl-lens', 'gl-distort', 'fx-chromatic', 'glass'] },
  { id: 'fx-rack',    label: 'FX rack',    filterIds: ['fx-hsl', 'fx-hsv', 'fx-brightness', 'fx-contrast', 'fx-rgb', 'fx-blur', 'fx-sharpen', 'fx-posterize', 'fx-solarize', 'fx-invert', 'fx-sepia', 'fx-grayscale', 'fx-enhance', 'fx-emboss', 'fx-noise', 'fx-edge', 'fx-threshold', 'fx-pixelate', 'fx-pixelsort'] },
  /* dither is reaction-diffusion — labs Pattern's 'Reaction' bucket. */
  { id: 'pattern',    label: 'Pattern',    filterIds: ['dither'] },
]

const CLAIMED = new Set(CATEGORIES.flatMap((c) => c.filterIds))

/**
 * Ordered categories resolved against a filter list (the layer's allowed
 * catalog): [{ id, label, filters: FilterDef[] }]. Unclaimed filters get an
 * 'Other' bucket; empty categories drop out.
 */
export function effectCategories(filters) {
  const cats = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    filters: c.filterIds.map((id) => filters.find((f) => f.id === id)).filter(Boolean),
  }))
  cats.push({ id: 'other', label: 'Other', filters: filters.filter((f) => !CLAIMED.has(f.id)) })
  return cats.filter((c) => c.filters.length > 0)
}

/** Category id owning a filter id ('other' for unclaimed; null for none). */
export function categoryOf(filterId) {
  if (!filterId) return null
  return CATEGORIES.find((c) => c.filterIds.includes(filterId))?.id ?? 'other'
}

/* The filter param that IS the filter's preset list (hierarchy level 4 —
 * METHOD > TYPE > CATEGORY > PRESET, docs/documentation/01-hierarchy.md).
 * Surfaced as the "Preset" dropdown in the Effects panel; filters without
 * an entry have no preset level (purely parametric). */
const PRESET_PARAM = {
  'fx-halftone-dither': 'mode',
  'fx-ascii':           'algorithm',
  'fx-bitmap':          'palette',
  glass:                'pattern',
  scanline:             'look',
  dither:               'palette',
  'gl-lens':            'type',
}
export const presetParamOf = (filterId) => PRESET_PARAM[filterId] ?? null
