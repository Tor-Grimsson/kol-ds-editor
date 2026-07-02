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

export const GROUPS = [
  { id: 'shape', label: 'Simple' },
  { id: 'field', label: 'Field' },
]
export const groupById = (id) => GROUPS.find((g) => g.id === id) || GROUPS[0]

const LOOPS = [...SHAPE_LOOPS, ...FIELD_LOOPS]
const PRESETS_BY_GROUP = { shape: SHAPE_PRESETS, field: FIELD_PRESETS }
export const PRESETS = [...SHAPE_PRESETS, ...FIELD_PRESETS]

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
