import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Generator library — shared multi-asset store across the editor's modes.
 *
 * Each slot is an ARRAY of saved items. Save buttons append; clear can target
 * a single item or the whole slot. Items are versioned (`v: 1`) and carry an
 * `id` for stable React keys + targeted deletion.
 *
 *   library = {
 *     palette: [{ v:1, id, savedAt, ...spec }, ...],
 *     pattern: [...], type: [...], preset: [...]
 *   }
 *
 * Persisted to localStorage; cross-tab synced via the `storage` event.
 *
 * Migration history:
 *   v1 — single item per slot: `{ <slot>: { v:1, ...spec } | null }`
 *   v2 — multi-item slots: `{ palette, pattern, type, mark, layout, composition }`
 *   v3 — current. Slots collapse to `{ palette, pattern, type, preset }`.
 *        `preset` absorbs the legacy `layout` (Social-saved aspect+composition
 *        pointers) and `composition` (full-frame ComposeTopbar saves) slots.
 *        `mark` slot is dropped — logos are now a shape variant inside preset
 *        layer arrays. Layer-type strings within preset layers are renamed
 *        in the same pass: bg→background, image→photo, mark→shape (with
 *        kind: 'logo' added).
 */

const STORAGE_KEY = 'kol.editor.library.v3'

const SLOT_KEYS = ['palette', 'pattern', 'type', 'preset']

const EMPTY = SLOT_KEYS.reduce((acc, k) => { acc[k] = []; return acc }, {})

let nextItemId = 1
const newItemId = () => `i${Date.now().toString(36)}-${nextItemId++}`

const wrapItem = (raw) => ({
  ...raw,
  id:      raw.id ?? newItemId(),
  savedAt: raw.savedAt ?? Date.now(),
})

/* ── Per-slot validators ──────────────────────────────────────────────
 *
 * Save sites can drift — `library.pattern` historically held three
 * different shapes (pattern-mode, compose-pattern-layer save, type-lab
 * "Save SVG to library" sentinel). Validators normalize spec fields at
 * the `addItem` boundary AND filter on load so badly-shaped legacy
 * entries get dropped. Returning `null` rejects the spec entirely
 * (logged in dev). Envelope fields (`v`, `id`, `savedAt`, `updatedAt`,
 * `name`) are preserved separately by `addItem` / `sanitizeLoaded`.
 *
 * Type-lab's `shapeId: 'type-composition'` sentinel never resolved to a
 * renderable pattern shape (`getShapeSvg` returned null) — those
 * entries are explicitly rejected.
 */

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v)

function validatePalette(spec) {
  if (!spec || !Array.isArray(spec.colors) || spec.colors.length === 0) return null
  return {
    colors:    spec.colors,
    bgEnabled: !!spec.bgEnabled,
    poolId:    spec.poolId ?? 'brand',
    modeId:    spec.modeId ?? 'random',
  }
}

function validatePattern(spec) {
  if (!spec) return null
  if (typeof spec.shapeId !== 'string') return null
  if (spec.shapeId === 'type-composition') return null  /* legacy type-lab misuse */
  return {
    shapeId:   spec.shapeId,
    customSvg: typeof spec.customSvg === 'string' ? spec.customSvg : '',
    cols:      isFiniteNum(spec.cols)    ? spec.cols    : 4,
    rows:      isFiniteNum(spec.rows)    ? spec.rows    : 4,
    gap:       isFiniteNum(spec.gap)     ? spec.gap     : 0,
    padding:   isFiniteNum(spec.padding) ? spec.padding : 0,
    stretch:   !!spec.stretch,
    overflow:  !!spec.overflow,
    bg:        spec.bg    ?? null,
    color:     spec.color ?? 'palette:secondary',
    rules:     Array.isArray(spec.rules) ? spec.rules : [],
    scale:     isFiniteNum(spec.scale)   ? spec.scale  : 256,
  }
}

function validateType(spec) {
  if (!spec || typeof spec.text !== 'string') return null
  const out = {
    text:       spec.text,
    width:      spec.width      ?? 'Tight',
    weight:     isFiniteNum(spec.weight)     ? spec.weight     : 600,
    italic:     !!spec.italic,
    size:       isFiniteNum(spec.size)       ? spec.size       : 96,
    tracking:   isFiniteNum(spec.tracking)   ? spec.tracking   : -0.01,
    lineHeight: isFiniteNum(spec.lineHeight) ? spec.lineHeight : 1.05,
    case:       spec.case      ?? 'original',
    color:      spec.color     ?? 'palette:dark',
    textAlign:  spec.textAlign ?? 'center',
  }
  /* Type-Lab axis frames carry extra morph fields. Preserve when present. */
  if (spec.axisOn !== undefined) {
    out.axisOn  = spec.axisOn
    out.width2  = spec.width2
    out.weight2 = spec.weight2
    out.blend   = spec.blend
  }
  return out
}

function validatePreset(spec) {
  if (!spec || !Array.isArray(spec.layers)) return null
  return {
    intent:  spec.intent  ?? 'whole',
    aspect:  spec.aspect  ?? '1:1',
    layers:  spec.layers,
    palette: spec.palette ?? null,
  }
}

const VALIDATORS = {
  palette: validatePalette,
  pattern: validatePattern,
  type:    validateType,
  preset:  validatePreset,
}

/* Envelope fields are preserved separately so validators stay focused on
 * spec shape. `name` is a user-given label valid on every slot. */
const ENVELOPE_KEYS = ['id', 'savedAt', 'updatedAt', 'name']
function pickEnvelope(item) {
  const out = {}
  for (const k of ENVELOPE_KEYS) {
    if (item?.[k] !== undefined) out[k] = item[k]
  }
  return out
}

/* On load, run every entry through its validator. Rejected entries are
 * dropped. Survivors keep their envelope (id / savedAt / updatedAt /
 * name) so library-tab UIs and the loaded-preset tracking stay stable. */
function sanitizeLoaded(library) {
  const out = SLOT_KEYS.reduce((acc, k) => { acc[k] = []; return acc }, {})
  for (const slot of SLOT_KEYS) {
    const validate = VALIDATORS[slot]
    const arr = Array.isArray(library?.[slot]) ? library[slot] : []
    out[slot] = arr
      .map((item) => {
        const validated = validate ? validate(item) : item
        if (!validated) {
          if (typeof console !== 'undefined' && import.meta?.env?.DEV) {
            console.warn(`library.${slot}: dropped invalid entry on load`, item)
          }
          return null
        }
        return { v: 1, ...pickEnvelope(item), ...validated }
      })
      .filter(Boolean)
  }
  return out
}

/* Rename legacy layer-type strings inside a saved-composition's layer array.
 * Mark layers gain `kind: 'logo'` so the unified shape layer-type knows
 * which variant kind to render. */
function renameLayerTypes(layers) {
  if (!Array.isArray(layers)) return layers
  return layers.map((l) => {
    if (!l?.type) return l
    if (l.type === 'bg')    return { ...l, type: 'background' }
    if (l.type === 'image') return { ...l, type: 'photo' }
    if (l.type === 'mark')  return { ...l, type: 'shape', kind: 'logo' }
    return l
  })
}

function migrateV1toV2(parsed) {
  /* v1 had each slot as { v:1, ...spec } | null (single item). Wrap as array. */
  const out = {}
  for (const key of ['palette', 'pattern', 'type', 'mark', 'layout', 'composition']) {
    const raw = parsed?.[key]
    if (Array.isArray(raw)) out[key] = raw
    else if (raw && typeof raw === 'object') out[key] = [wrapItem(raw)]
    else out[key] = []
  }
  return out
}

function migrateV2toV3(parsed) {
  const out = SLOT_KEYS.reduce((acc, k) => { acc[k] = []; return acc }, {})

  const arrayOf = (raw) => {
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') return [wrapItem(raw)]
    return []
  }

  out.palette = arrayOf(parsed?.palette)
  out.pattern = arrayOf(parsed?.pattern)
  out.type    = arrayOf(parsed?.type)

  /* preset = legacy `layout` (aspect+compositionId pointers; no internal
   * layer-type rename needed) + legacy `composition` (with internal
   * layer-type rename in layers array). */
  const legacyLayout      = arrayOf(parsed?.layout)
  const legacyComposition = arrayOf(parsed?.composition).map((item) => ({
    ...item,
    layers: renameLayerTypes(item.layers),
  }))
  out.preset = [...legacyLayout, ...legacyComposition]

  /* `mark` slot dropped — items there were logo-variant configs not
   * load-bearing in the new vocabulary. */

  return out
}

function loadFromStorage() {
  if (typeof window === 'undefined') return EMPTY
  try {
    /* v3 (current) — sanitize through per-slot validators so legacy bad
     * entries (e.g. type-lab pattern-slot misuse) are silently dropped. */
    const v3 = window.localStorage.getItem(STORAGE_KEY)
    if (v3) return sanitizeLoaded(JSON.parse(v3))
    /* v2 → v3 migration. Snapshot v2 to backup key for rollback safety. */
    const v2 = window.localStorage.getItem('kol.generator.library.v2')
    if (v2) {
      window.localStorage.setItem('kol.generator.library.v2._backup', v2)
      return sanitizeLoaded(migrateV2toV3(JSON.parse(v2)))
    }
    /* v1 → v2 → v3 migration. */
    const v1 = window.localStorage.getItem('kol.generator.library.v1')
    if (v1) {
      return sanitizeLoaded(migrateV2toV3(migrateV1toV2(JSON.parse(v1))))
    }
    return EMPTY
  } catch {
    return EMPTY
  }
}

function saveToStorage(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* quota / private mode — silent */ }
}

const LibraryContext = createContext(null)

export function GeneratorLibraryProvider({ children }) {
  const [library, setLibrary] = useState(loadFromStorage)

  useEffect(() => { saveToStorage(library) }, [library])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return
      setLibrary(loadFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addItem = useCallback((slot, spec) => {
    if (!SLOT_KEYS.includes(slot) || !spec) return null
    const validate = VALIDATORS[slot]
    const validated = validate ? validate(spec) : spec
    if (!validated) {
      if (typeof console !== 'undefined' && import.meta?.env?.DEV) {
        console.warn(`library.${slot}: rejected invalid save`, spec)
      }
      return null
    }
    const id = newItemId()
    const item = {
      v: 1,
      id,
      savedAt: Date.now(),
      ...(typeof spec.name === 'string' ? { name: spec.name } : {}),
      ...validated,
    }
    setLibrary((prev) => ({ ...prev, [slot]: [...(prev[slot] ?? []), item] }))
    return id
  }, [])

  const removeItem = useCallback((slot, id) => {
    setLibrary((prev) => ({
      ...prev,
      [slot]: (prev[slot] ?? []).filter((it) => it.id !== id),
    }))
  }, [])

  /* Replace an existing item's fields by id. Preserves the original `id`
   * and `savedAt`, sets `updatedAt: Date.now()`. Used by phase-8 named
   * Save to overwrite a loaded preset. Routes through the slot validator
   * so an overwrite can't reintroduce a malformed spec. */
  const updateItem = useCallback((slot, id, spec) => {
    if (!SLOT_KEYS.includes(slot) || !id || !spec) return
    const validate = VALIDATORS[slot]
    const validated = validate ? validate(spec) : spec
    if (!validated) {
      if (typeof console !== 'undefined' && import.meta?.env?.DEV) {
        console.warn(`library.${slot}: rejected invalid update`, spec)
      }
      return
    }
    setLibrary((prev) => ({
      ...prev,
      [slot]: (prev[slot] ?? []).map((it) =>
        it.id === id
          ? {
              ...it,
              ...(typeof spec.name === 'string' ? { name: spec.name } : {}),
              ...validated,
              id: it.id,
              savedAt: it.savedAt,
              updatedAt: Date.now(),
            }
          : it
      ),
    }))
  }, [])

  const clearSlot = useCallback((slot) => {
    setLibrary((prev) => ({ ...prev, [slot]: [] }))
  }, [])

  const clearAll = useCallback(() => setLibrary(EMPTY), [])

  const replaceAll = useCallback((next) => setLibrary({ ...EMPTY, ...next }), [])

  /* Back-compat: read "the most recently saved item" per slot. New consumers
   * should ideally pick from the array directly via `library.<slot>[i]`. */
  const selected = useMemo(() => SLOT_KEYS.reduce((acc, k) => {
    const arr = library[k] ?? []
    acc[k] = arr.length ? arr[arr.length - 1] : null
    return acc
  }, {}), [library])

  const value = {
    library,
    selected,
    addItem,
    removeItem,
    updateItem,
    clearSlot,
    clearAll,
    replaceAll,
    savePalette: (spec) => addItem('palette', spec),
    savePattern: (spec) => addItem('pattern', spec),
    saveType:    (spec) => addItem('type',    spec),
    savePreset:  (spec) => addItem('preset',  spec),
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useGeneratorLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) {
    return {
      library:     EMPTY,
      selected:    SLOT_KEYS.reduce((acc, k) => { acc[k] = null; return acc }, {}),
      addItem:     () => null,
      removeItem:  () => {},
      updateItem:  () => {},
      clearSlot:   () => {},
      clearAll:    () => {},
      replaceAll:  () => {},
      savePalette: () => null,
      savePattern: () => null,
      saveType:    () => null,
      savePreset:  () => null,
    }
  }
  return ctx
}

export const LIBRARY_SLOT_KEYS = SLOT_KEYS
