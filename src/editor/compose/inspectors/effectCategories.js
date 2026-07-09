/**
 * Effect category taxonomy (labs nav model: Halftone · Scanline · CRT ·
 * Refraction · FX rack · Pattern) — a presentation-layer mapping over the
 * filter registry, which stays category-free. Ids are listed defensively:
 * an id with no registered filter simply doesn't render, and any registered
 * filter no category claims lands in 'Other' so future filters never vanish
 * from the picker.
 */
import { filterById } from '../../../filters'

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

/* Pixi GPU tier (kind:'pixi') buckets — keyed on the def's own `group` field
 * (labs effect groups) so new pixi filters slot in without editing this list.
 * Labs' one Displacement effect folds into Distortion. */
const PIXI_GROUPS = [
  { id: 'color-adjustments', label: 'Color Adjustments' },
  { id: 'blur-sharpen',      label: 'Blur & Sharpen' },
  { id: 'distortion',        label: 'Distortion' },
  { id: 'artistic',          label: 'Artistic' },
  { id: 'lighting',          label: 'Lighting' },
  { id: 'stylize',           label: 'Stylize' },
  { id: 'utility',           label: 'Utility' },
]
const pixiCatId = (group) => `pixi-${group}`

/**
 * Ordered categories resolved against a filter list (the layer's allowed
 * catalog): [{ id, label, filters: FilterDef[] }]. Canvas/GL categories first
 * (hardcoded filterIds), then the pixi group buckets; unclaimed non-pixi
 * filters get an 'Other' bucket; empty categories drop out.
 */
export function effectCategories(filters) {
  const cats = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    filters: c.filterIds.map((id) => filters.find((f) => f.id === id)).filter(Boolean),
  }))
  for (const g of PIXI_GROUPS) {
    const fs = filters.filter((f) => f.kind === 'pixi' && f.group === g.id)
    if (fs.length) cats.push({ id: pixiCatId(g.id), label: g.label, filters: fs })
  }
  cats.push({ id: 'other', label: 'Other', filters: filters.filter((f) => f.kind !== 'pixi' && !CLAIMED.has(f.id)) })
  return cats.filter((c) => c.filters.length > 0)
}

/** Category id owning a filter id ('other' for unclaimed; null for none).
 * Pixi defs resolve to their `pixi-<group>` bucket (matches effectCategories). */
export function categoryOf(filterId) {
  if (!filterId) return null
  const hard = CATEGORIES.find((c) => c.filterIds.includes(filterId))
  if (hard) return hard.id
  const def = filterById(filterId)
  if (def?.kind === 'pixi' && def.group) return pixiCatId(def.group)
  return 'other'
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

/** The full params patch a preset pick applies: the preset key itself plus
 * any per-value recipe the filter def carries (`presetPatches` — glass ships
 * the labs registry's full look-configs; defs without one patch just the
 * preset key, the old single-key behavior). */
export const presetPatchFor = (def, value) => ({
  [presetParamOf(def.id)]: value,
  ...(def.presetPatches?.[value] ?? {}),
})
