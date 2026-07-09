/**
 * filterChain — the layer's post-FX chain model (labs useCanvasFx port).
 *
 * A layer carries `filters: [{ id, key, enabled, params }]` (≤ MAX_FILTERS):
 *   id      — filter def id (src/filters registry)
 *   key     — per-stage uid (React list identity, sim-pool identity — the
 *             reaction-diffusion filter keys its engine pool on it, so a
 *             reorder doesn't reseed the sim)
 *   enabled — per-stage bypass (labs per-FX enable)
 *   params  — the stage's OWN param values (nested, NOT flat on the layer —
 *             two stages of the same filter, or a filter param named like a
 *             layer prop, can't collide)
 *
 * Chain rules (enforced in state.jsx's addFilter/moveFilter):
 *   - at most 8 stages
 *   - at most ONE `kind:'engine'` (GL) stage, always LAST — labs chained
 *     canvas fx only; a terminal GL stage matches EngineFilterLayer's shape
 *
 * TIER ORDERING (labs two-stage pipeline) — the render applies stages in tier
 * order regardless of array position: CANVAS stages (kind absent, Canvas-2D
 * `apply`) → PIXI batch (kind:'pixi', GPU pixi-filters on one persistent app)
 * → the single terminal GL ENGINE stage (kind:'engine'). Multiple pixi stages
 * are allowed (they batch); addFilter keeps the array in tier order.
 *
 * BACKWARD COMPAT — this is the one normalizer every legacy reader routes
 * through: the old model was a single `filterId` + the filter's params FLAT
 * on the layer (localStorage drafts, library presets, settings .json all
 * carry it). normalizeLayerFilters() hydrates that into a one-stage chain,
 * lifting the flat param values (and the old one-sweep flat rig into a
 * `params.sweeps` array). Old flat keys are left on the layer untouched —
 * deleting them could eat layer-owned props that share a name (a pattern
 * layer's `bg` vs fx-ascii's `bg`).
 */
import { filterById } from '../../filters'
import { schemaDefaults } from '../params/schema'
import { makeSweep } from '../../filters/sweeps'

export const MAX_FILTERS = 8

const newStageKey = () => `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/* Fresh stage for a filter id, params at schema defaults. */
export function makeStage(filterId) {
  const def = filterById(filterId)
  const params = def ? schemaDefaults(def.params) : {}
  if (def?.sweeps) params.sweeps = []
  return { id: filterId, key: newStageKey(), enabled: true, params }
}

/* Legacy sweep-rig flat keys (the old SWEEP_PARAMS fragment) → sweeps array. */
function legacySweepList(layer) {
  if (!layer.animate) return []
  return [makeSweep(layer.sweepShape ?? 'linear', {
    target: layer.sweepTarget ?? 'brightness',
    amount: layer.sweepAmount ?? 0.6,
    speed: layer.sweepSpeed ?? 1,
    width: layer.sweepWidth ?? 0.35,
    angle: layer.sweepAngle ?? 0,
  })]
}

/* One legacy layer (`filterId` + flat params) → a one-stage chain. Key is
 * DETERMINISTIC (not a fresh uid): bareChain() may synthesize this stage on
 * every call for a layer that slipped load-normalization — a churning key
 * would remint React rows and sim-pool identities each render. */
function stageFromLegacy(layer) {
  const def = filterById(layer.filterId)
  const params = {}
  if (def) {
    for (const p of def.params) {
      params[p.key] = layer[p.key] !== undefined ? layer[p.key] : p.default
    }
    if (def.sweeps) params.sweeps = legacySweepList(layer)
  }
  return { id: layer.filterId, key: `legacy-${layer.filterId}`, enabled: true, params }
}

/* Ensure a stage list entry has the full shape (older chain data / hand-
 * edited settings files may miss key/enabled/params). */
function normalizeStage(s) {
  if (!s || typeof s !== 'object' || !s.id) return null
  if (typeof s.key === 'string' && s.enabled !== undefined && s.params && typeof s.params === 'object') return s
  return {
    id: s.id,
    key: typeof s.key === 'string' ? s.key : newStageKey(),
    enabled: s.enabled !== false,
    params: s.params && typeof s.params === 'object' ? s.params : schemaDefaults(filterById(s.id)?.params ?? []),
  }
}

/**
 * THE normalizer — returns the layer with its filter state in chain form.
 * Identity-preserving: layers that are already normalized (or carry no
 * filter at all) return the SAME object, so render caches keyed on layer
 * identity don't churn at load.
 */
export function normalizeLayerFilters(layer) {
  if (!layer || typeof layer !== 'object') return layer
  if (Array.isArray(layer.filters)) {
    let changed = false
    const filters = []
    for (const s of layer.filters) {
      const n = normalizeStage(s)
      if (n === null) { changed = true; continue }
      if (n !== s) changed = true
      filters.push(n)
    }
    if (!changed && layer.filterId === undefined) return layer
    const out = { ...layer, filters }
    delete out.filterId
    return out
  }
  if (layer.filterId) {
    const out = { ...layer, filters: [stageFromLegacy(layer)] }
    delete out.filterId
    return out
  }
  return layer
}

/* Deep, identity-preserving normalize of a layer list (group/bool children
 * included) — the load-path entry point (drafts / presets / settings). */
export function normalizeLayersDeep(list) {
  if (!Array.isArray(list)) return list
  let changed = false
  const next = list.map((l) => {
    let n = normalizeLayerFilters(l)
    if (Array.isArray(n.children)) {
      const kids = normalizeLayersDeep(n.children)
      if (kids !== n.children) n = { ...n, children: kids }
    }
    if (n !== l) changed = true
    return n
  })
  return changed ? next : list
}

/* Normalized bare stage array for a layer (legacy-safe, non-mutating). */
export function bareChain(layer) {
  const n = normalizeLayerFilters(layer)
  return Array.isArray(n.filters) ? n.filters : []
}

/* Stage array with defs resolved: [{ id, key, enabled, params, def }].
 * Stages whose filter id no longer exists keep def:null (the panel shows
 * them; the renderer skips them). */
export function resolvedChain(layer) {
  return bareChain(layer).map((s) => ({ ...s, def: filterById(s.id) }))
}

/* Enabled CANVAS stages in chain order — the runChain input. Excludes pixi
 * (GPU batch) and engine (terminal GL) stages: those run in their own tiers. */
export function enabledCanvasStages(layer) {
  return resolvedChain(layer).filter((s) => s.enabled && s.def && s.def.kind !== 'engine' && s.def.kind !== 'pixi')
}

/* Enabled PIXI stages in chain order — the applyPixiStack batch (runs after the
 * canvas chain, before any terminal GL engine). More than one is allowed. */
export function pixiStages(layer) {
  return resolvedChain(layer).filter((s) => s.enabled && s.def?.kind === 'pixi')
}

/* The enabled engine (GL) stage, or null — at most one, always terminal. */
export function enabledEngineStage(layer) {
  const engines = resolvedChain(layer).filter((s) => s.enabled && s.def?.kind === 'engine')
  return engines.length ? engines[engines.length - 1] : null
}

/* Any enabled stage at all — gates the export paths' live-canvas snapshot. */
export function hasEnabledFilters(layer) {
  if (Array.isArray(layer?.filters)) return layer.filters.some((s) => s && s.enabled !== false && s.id)
  return !!layer?.filterId   /* un-normalized legacy layer */
}

/* First stage's def — inspector affordances ("Effect · X" row label). */
export function firstFilterDef(layer) {
  const chain = bareChain(layer)
  return chain.length ? filterById(chain[0].id) : null
}
