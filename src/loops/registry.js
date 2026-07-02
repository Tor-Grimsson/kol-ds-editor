// The loop catalog — the single source of truth for the library (+ the future
// effect source-picker). Keep this module LIGHT: it imports loop DEFINITIONS
// (cheap draw fns + schema), so consumers can import it for the source list
// without dragging any heavy 3d/WebGL engine.
//
// Imported from kol-labs-single (plan.md Phase 3). Cut one is shape + field;
// the pattern group (opentype dep) is excluded per the plan — its imports and
// route-centric SUBGROUPS metadata were dropped with it (the editor picks
// loops via inspector dropdowns, not routes).

import { loopDefaults } from './contract.js'
import { SHAPE_LOOPS, SHAPE_PRESETS } from './shape/presets.js'
import { FIELD_LOOPS, FIELD_PRESETS } from './field/presets.js'
import { PATTERN_LOOPS, PATTERN_PRESETS } from './pattern/presets.js'
import { SCANLINE_LOOPS, SCANLINE_PRESETS } from './scanline/presets.js'
import { OPTIC_LOOPS, OPTIC_PRESETS } from './optic/presets.js'
import { ABSTRACT_LOOPS, ABSTRACT_PRESETS } from './abstract/presets.js'
import { MATH_LOOPS, MATH_PRESETS } from './math/presets.js'
import { PARATYPE_LOOPS, PARATYPE_PRESETS } from './paratype/presets.js'
/* GL catalog is DATA ONLY (groups/defs/presets/schemas) — the three.js
 * engines behind it load lazily via gl/host.js when a layer renders. */
import { GL_GROUPS, GL_LOOPS, GL_PRESETS_BY_GROUP } from './gl/catalog.js'

export const GROUPS = [
  { id: 'shape', label: 'Simple' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'field', label: 'Field' },
  { id: 'scanline', label: 'Scanline' },
  { id: 'optic', label: 'Optic' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'math', label: 'Math' },
  { id: 'paratype', label: 'Para-type' },
  ...GL_GROUPS,
]
export const groupById = (id) => GROUPS.find((g) => g.id === id) || GROUPS[0]

const LOOPS = [
  ...SHAPE_LOOPS, ...FIELD_LOOPS, ...PATTERN_LOOPS,
  ...SCANLINE_LOOPS, ...OPTIC_LOOPS, ...ABSTRACT_LOOPS,
  ...MATH_LOOPS, ...PARATYPE_LOOPS, ...GL_LOOPS,
]
const PRESETS_BY_GROUP = {
  shape: SHAPE_PRESETS,
  pattern: PATTERN_PRESETS,
  field: FIELD_PRESETS,
  scanline: SCANLINE_PRESETS,
  optic: OPTIC_PRESETS,
  abstract: ABSTRACT_PRESETS,
  math: MATH_PRESETS,
  paratype: PARATYPE_PRESETS,
  ...GL_PRESETS_BY_GROUP,
}
export const PRESETS = [
  ...SHAPE_PRESETS, ...PATTERN_PRESETS, ...FIELD_PRESETS,
  ...SCANLINE_PRESETS, ...OPTIC_PRESETS, ...ABSTRACT_PRESETS,
  ...MATH_PRESETS, ...PARATYPE_PRESETS,
  ...Object.values(GL_PRESETS_BY_GROUP).flat(),
]

export const loopById = (id) => LOOPS.find((l) => l.id === id) || LOOPS[0]
export const presetsInGroup = (group) => PRESETS_BY_GROUP[group] || []
export const presetsInSub = (group, sub) => presetsInGroup(group).filter((p) => p.sub === sub)
export const presetById = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0]

// A preset's full param object = the loop's defaults overlaid with the preset's
// overrides.
export const presetParams = (preset) => ({
  ...loopDefaults(loopById(preset.loop)),
  ...(preset.params || {}),
})

// ── Background toggle (Phase 6-C) ────────────────────────────────────────
// A loop layer can render transparent by suppressing its bg-roled colour
// param: the backdrop fill paints 'rgba(0,0,0,0)' — a no-op on a cleared
// canvas. Only valid where bg is JUST a backdrop fill. Loops that feed the
// bg colour into colour math (hexToRgb/mixHex pixel ramps — the field
// family's colA + optic moiré) or fade a persistent buffer toward it
// (spinner) are listed here and keep the toggle hidden. Engine (GL) loops
// are excluded wholesale — their bg is shader-internal.
const BG_MIX_IDS = new Set([
  'plasma', 'swirl', 'checker-field', 'contour', 'rings-field', 'moire',
  'gradient-field', 'stripes', 'interference',  // field: colA→colB pixel ramps
  'optic-moire',                                // hexToRgb(colA) colour math
  'math-spinner',                               // persistence fade fills bg
])
export const loopBgToggleable = (def) =>
  !!def && !BG_MIX_IDS.has(def.id) && (
    /* Scene-type GL engines opt in via `bgToggle` (alpha renderer + clear-
     * alpha swap in the host); fullscreen-quad engines can't (shader paints
     * every pixel). */
    def.kind === 'engine'
      ? !!def.bgToggle
      : (def.params ?? []).some((p) => p.type === 'color' && p.role === 'bg')
  )

// Params for a draw call honoring `layer.bgOn` — returns `layer` untouched
// unless suppression applies (callers identity-check to know they must
// clear the canvas themselves, since the loop's bg fill no longer does).
export const loopDrawParams = (def, layer) => {
  if (layer.bgOn !== false || !loopBgToggleable(def)) return layer
  const key = def.params.find((p) => p.type === 'color' && p.role === 'bg')?.key
  return key ? { ...layer, [key]: 'rgba(0,0,0,0)' } : layer
}
