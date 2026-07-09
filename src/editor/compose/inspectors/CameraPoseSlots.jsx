import EditorButton from '../../components/EditorButton'

/**
 * CameraPoseSlots — labs CameraPanel's save/recall pose slots + Reset
 * (kol-labs-single framework/CameraPanel.jsx), ported to the layer-param
 * model: a "pose" is the layer's camera param values (the schema params
 * sectioned 'Camera' plus the def's `camera` rail), saved into `_camSlots`
 * on the layer and recalled as ONE coalesced patch.
 *
 * Labs interaction kept: click = recall (or save when the slot is empty),
 * shift-click = overwrite. Reset patches the schema defaults back and — for
 * engine loops — asks the live engine to restore its OrbitControls rig
 * (position/target drag state no param captures) via the gl host's action
 * channel. The dynamic import keeps three out of the base bundle; the host
 * module is already loaded whenever an engine layer is live.
 */
export default function CameraPoseSlots({ layer, patch, camParams, isEngine, showHeader = false }) {
  const raw = Array.isArray(layer._camSlots) ? layer._camSlots : []
  const slots = [raw[0] ?? null, raw[1] ?? null, raw[2] ?? null]

  const save = (i) => {
    const pose = {}
    for (const p of camParams) pose[p.key] = layer[p.key] ?? p.default
    const next = [...slots]
    next[i] = pose
    patch({ _camSlots: next })
  }
  const recall = (i) => {
    if (slots[i]) patch({ ...slots[i] })
  }
  const reset = () => {
    const defaults = {}
    for (const p of camParams) defaults[p.key] = p.default
    patch(defaults)
    if (isEngine) {
      import('../../../loops/gl/host.js')
        .then((m) => m.hostAction?.(layer.id, 'resetCamera'))
        .catch(() => { /* host not loadable — engine isn't live anyway */ })
    }
  }

  return (
    <>
      {showHeader && <span className="kol-helper-10 text-meta">Camera</span>}
      <div className="flex items-center gap-1">
        {camParams.length > 0 && slots.map((s, i) => (
          <EditorButton
            key={i}
            variant={s ? 'secondary' : 'ghost'}
            size="sm"
            title={s ? 'Recall pose (shift-click = overwrite)' : 'Save pose'}
            onClick={(e) => ((e.shiftKey || !s) ? save(i) : recall(i))}
          >
            {i + 1}
          </EditorButton>
        ))}
        <EditorButton variant="primary" size="sm" className="ml-auto" onClick={reset}>
          Reset
        </EditorButton>
      </div>
    </>
  )
}
