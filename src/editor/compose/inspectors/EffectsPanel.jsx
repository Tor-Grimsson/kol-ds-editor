import { useState } from 'react'
import { Dropdown, LabeledControl, SegmentedToggle, ViewToggle } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { findLayerDeep } from '../helpers'
import { labelForLayer } from '../labels'
import { useLayerEdit } from '../useLayerEdit'
import AutoControls from '../../params/AutoControls'
import BindDot from '../../params/BindDot'
import { schemaDefaults, paramTab } from '../../params/schema'
import { loopById } from '../../../loops/registry'
import { FILTERS, filterById } from '../../../filters'
import { effectCategories, categoryOf } from './effectCategories'

/**
 * EffectsPanel — the Effects tab of the right rail (review r3: the effect
 * picker buried in Parameters → Generate made no sense). Category → Effect
 * pickers over the labs taxonomy (effectCategories.js), then the labs
 * Effect · Motion strip: Effect = the active filter's look params, Motion =
 * its `tab:'anim'` params. Inspector's effect row flips here via
 * `kol:open-effects` (SelectionPalettePanel listens).
 *
 * Same shell as ParametersPanel (46px header + .kol-compose-inspector-body)
 * and the same write path: useLayerEdit coalesced history + BindDot per
 * animatable field. Picking a filter writes its schemaDefaults (loop preset
 * semantics); 'None' clears filterId.
 */
const FX_TABS = [
  { value: 'effect', label: 'Effect' },
  { value: 'anim',   label: 'Motion' },
]
const ANIM_HINT = 'Animate any parameter via its bind dot.'

export default function EffectsPanel() {
  const { selectedId, layers } = useComposeState()
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null

  return (
    <div className="kol-compose-rail kol-compose-rail--inspector">
      {/* min-h matches InspectorRail's header so tab switches never shift
          the column. */}
      <div className="flex items-center gap-3 px-4 min-h-[46px]">
        {layer && <span className="kol-helper-12 text-emphasis">{labelForLayer(layer)}</span>}
      </div>
      <div className="kol-compose-inspector-body">
        {layer
          ? <LayerEffects key={layer.id} layer={layer} />
          : <p className="kol-helper-12 text-meta">Select a layer to edit its effect.</p>}
      </div>
    </div>
  )
}

function LayerEffects({ layer }) {
  const { updateLayer, palette } = useComposeState()
  const edit = useLayerEdit(layer.id, { history: 'coalesce' })
  const setProp = edit.setProp

  /* Catalog per host: photo gets everything incl. GL engines; other
   * effectable types canvas-only (engine filters need an image source);
   * engine loops can't host effects yet (no GL source path). */
  const engineLoop = layer.type === 'loop' && loopById(layer.loopId)?.kind === 'engine'
  const effectable = layer.type === 'photo'
    || ['shape', 'text', 'pattern', 'path'].includes(layer.type)
    || (layer.type === 'loop' && !engineLoop)
  const available = layer.type === 'photo' ? FILTERS : FILTERS.filter((f) => f.kind !== 'engine')
  const categories = effectCategories(available)

  const activeFilter = filterById(layer.filterId)
  /* Stale/foreign filterId (e.g. engine filter on a vector layer) renders
   * no params — same guard EffectFields carried. */
  const activeAllowed = activeFilter && available.some((f) => f.id === activeFilter.id)

  /* Category is a browse control — switching it never writes the layer.
   * Init from the active filter so reopening lands on its bucket; a stale
   * filterId whose bucket isn't in this layer's catalog falls back to the
   * first category. */
  const [cat, setCat] = useState(() => {
    const c = categoryOf(layer.filterId)
    return categories.some((x) => x.id === c) ? c : categories[0]?.id
  })
  const [tab, setTab] = useState('effect')

  if (!effectable) {
    return (
      <p className="kol-helper-12 text-meta">
        {engineLoop
          ? "Engine loops can't host effects yet."
          : "This layer can't host an effect."}
      </p>
    )
  }

  const catOptions = categories.map((c) => ({ value: c.id, label: c.label }))
  const catFilters = categories.find((c) => c.id === cat)?.filters ?? []
  const fxOptions = [
    { value: '', label: 'None' },
    ...catFilters.map((f) => ({ value: f.id, label: f.label })),
  ]
  /* The effect dropdown reads 'None' while browsing a category the active
   * filter doesn't live in — flipping back to its category shows it again. */
  const fxValue = activeFilter && categoryOf(activeFilter.id) === cat ? activeFilter.id : ''

  const onPick = (id) => {
    if (!id) { setProp('filterId', null); return }
    const f = filterById(id)
    if (!f) return
    updateLayer(layer.id, { filterId: id, ...schemaDefaults(f.params) })
  }

  const renderAnimate = (p) => <BindDot layer={layer} param={p} setProp={setProp} />
  const effectParams = activeAllowed ? activeFilter.params.filter((p) => paramTab(p) !== 'anim') : []

  return (
    <div className="flex flex-col gap-4">
      <LabeledControl label="Category">
        <Dropdown variant="subtle" size="sm" className="w-full" options={catOptions} value={cat} onChange={setCat} />
      </LabeledControl>
      <LabeledControl label="Effect">
        <Dropdown variant="subtle" size="sm" className="w-full" options={fxOptions} value={fxValue} onChange={onPick} />
      </LabeledControl>

      {activeAllowed && layer.imgW != null && (
        <span className="kol-helper-12 text-meta">Filters don't apply to cropped photos.</span>
      )}
      {/* Camera drag — orbit-capable engine filters (Rutt-Etra). */}
      {activeAllowed && activeFilter.orbit && (
        <LabeledControl label="Camera drag">
          <ViewToggle
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={layer.cameraDrag ? 'on' : 'off'}
            onViewChange={(v) => setProp('cameraDrag', v === 'on')}
          />
        </LabeledControl>
      )}

      {activeAllowed && (
        <>
          <SegmentedToggle value={tab} onChange={setTab} options={FX_TABS} />
          {tab === 'effect' && (
            <AutoControls schema={effectParams} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} />
          )}
          {tab === 'anim' && (
            <AutoControls schema={activeFilter.params} layer={layer} setProp={setProp} palette={palette} renderAnimate={renderAnimate} tab="anim" emptyHint={ANIM_HINT} />
          )}
        </>
      )}
    </div>
  )
}
