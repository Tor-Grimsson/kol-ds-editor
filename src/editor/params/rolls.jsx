import { useState } from 'react'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { NumberField } from '../compose/inspectors/NumberField'
import { mulberry32, randomSeed, randomizeSchema, mergeRoll } from '../lib/rng'
import { visibleParams } from './schema'

/**
 * rolls — the scoped, seeded Randomize surface shared by the inspector
 * panels (labs LoopsShell Generate-section model, kol-labs-single
 * LoopsShell.jsx:160-216 + SettingsPanel seed flow).
 *
 * Scopes are SCHEMA FILTERS: Colour = the type:'color' params; every other
 * scope is a distinct `section` present in the layer's visible params.
 * Rolls go through the shared rng lib — randomizeSchema (honours noRandom)
 * seeded with mulberry32, merged via mergeRoll so bound params keep their
 * bindings — and land as ONE layer patch per press.
 *
 * The seed that produced a roll persists on the layer (`_rollSeed`) so it
 * survives save/load; typing a seed into the field reproduces that roll on
 * the next press, after which presses mint fresh seeds again.
 */

/** Sections that hold motion params — "Randomize all" preserves them (labs
 * scanline convention: 'all' rolls the look, never the motion). */
export const MOTION_SECTIONS = new Set(['Motion', 'Frame', 'Form'])

/** Curation keys — picked, never rolled (the theme select + invert are
 * choices, not randomness; labs colour scopes roll hex colors only). */
const NEVER_ROLL = new Set(['theme', 'invert'])

const COLOR_SCOPE = '__color'
const SCOPE_LABELS = { [COLOR_SCOPE]: 'Colour', Frame: 'Motion Frame', Form: 'Motion Form' }

/**
 * Scope buttons for a layer's schema: one per distinct section in schema
 * order; the type-based Colour scope stands in for the color params at their
 * first occurrence (so a pure-color 'Color' section collapses into it).
 * Returns [{ id, label, motion, params }].
 */
export function deriveScopes(schema, layer) {
  const scopes = []
  const byId = new Map()
  for (const p of visibleParams(schema ?? [], layer)) {
    if (NEVER_ROLL.has(p.key)) continue
    const id = p.type === 'color' ? COLOR_SCOPE : p.section
    if (!id) continue
    let scope = byId.get(id)
    if (!scope) {
      scope = { id, label: SCOPE_LABELS[id] ?? id, motion: MOTION_SECTIONS.has(id), params: [] }
      byId.set(id, scope)
      scopes.push(scope)
    }
    scope.params.push(p)
  }
  return scopes
}

/** The "Randomize all" param set: every visible param EXCEPT the motion
 * sections and Camera (framing + motion stay curated) and curation keys.
 * Per-param noRandom is still honoured downstream by randomizeSchema. */
export function allScopeParams(schema, layer) {
  return visibleParams(schema ?? [], layer).filter((p) =>
    !NEVER_ROLL.has(p.key) && !MOTION_SECTIONS.has(p.section) && p.section !== 'Camera')
}

/**
 * Roll `params` with a seeded rng → the layer patch: rolled values merged
 * via mergeRoll (bound params survive) + the seed under `_rollSeed`.
 * `stripNoRandom` is the explicit-motion-press escape hatch: a schema flags
 * its motion params noRandom to keep the all-roll off them, but pressing
 * the motion scope itself must roll them (labs randFrame/randForm).
 */
export function computeRoll(layer, params, seed, { stripNoRandom = false } = {}) {
  const src = stripNoRandom ? params.map((p) => (p.noRandom ? { ...p, noRandom: false } : p)) : params
  const rolled = randomizeSchema(src, mulberry32(seed >>> 0))
  const current = {}
  for (const k of Object.keys(rolled)) current[k] = layer[k]
  return { ...mergeRoll(current, rolled), _rollSeed: seed }
}

/**
 * Seed state for one Randomize surface (labs SettingsPanel.jsx:83-87 flow).
 * `value` shows the manual draft or the layer's persisted seed; `take()`
 * consumes a manually-committed seed exactly once, else mints a fresh one.
 */
export function useRollSeed(layer) {
  const [draft, setDraft] = useState(null)
  const take = () => {
    if (draft != null) {
      setDraft(null)
      return draft
    }
    return randomSeed()
  }
  return { value: draft ?? layer?._rollSeed ?? 0, commit: setDraft, take }
}

/** The editable seed field — commit (Enter/blur) arms the seed for the next
 * roll press. Draft/commit via the shared NumberField idiom. */
export function SeedField({ seed }) {
  return (
    <LabeledControl label="Seed">
      <NumberField
        variant="filled" size="sm" chars={10}
        value={seed.value}
        onCommit={(raw) => {
          const n = Math.floor(Number(raw))
          if (Number.isFinite(n) && n >= 0) seed.commit(n)
        }}
      />
    </LabeledControl>
  )
}
