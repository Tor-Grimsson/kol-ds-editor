import { useState } from 'react'
import EditorButton from '../../components/EditorButton'
import { Slider, Dropdown, LabeledControl } from '@kolkrabbi/kol-component'
import { EASE_OPTIONS } from '../../../loops/gl/primitiveEasing'
import { DEFAULT_KEYFRAMES } from '../../../loops/gl/primitiveKeyframes'
import { layerCycles } from '../../../loops/gl/phase'
import { transport } from '../../params/transport'

const deg = (r) => Math.round(((r || 0) * 180) / Math.PI)
const rad = (d) => (d * Math.PI) / 180

/**
 * KeyframeEditor — labs PrimitiveScenePage's keyframe timeline editor
 * (kol-labs-single KeyframeEditor.jsx), ported to the layer-param model: the
 * track is the layer's `keyframes` param, the opaque array
 * primitiveKeyframes.sampleKeyframes consumes —
 *   { t: 0..1, rot:[x,y,z] radians, pos:[x,y,z], scale, ease }
 * kept sorted by t on add. Writes go through the panel's coalesced `patch`.
 *
 * Selecting a key pauses the transport and seeks its t (labs: the live render
 * = the pose being edited). The layer's phase runs `cycles` engine loops per
 * transport loop (phase.js duration quantization), so kf.t maps to the global
 * playhead as t/cycles — the first cycle's instance of that pose.
 *
 * Rotations are stored in radians (engine-native), edited in degrees here.
 * Timeline scrub-marks (labs Scrubber `marks`) are out of scope.
 */
export default function KeyframeEditor({ layer, patch, defaultDuration = 8 }) {
  const kfs = Array.isArray(layer.keyframes) && layer.keyframes.length ? layer.keyframes : DEFAULT_KEYFRAMES
  const [selected, setSelected] = useState(0)
  const sel = Math.min(selected, kfs.length - 1)
  const k = kfs[sel] || { rot: [0, 0, 0], pos: [0, 0, 0], scale: 1 }

  const write = (next) => patch({ keyframes: next })
  const cycles = () => layerCycles(layer.duration ?? defaultDuration, transport.getLoopSeconds())

  const onSelect = (i) => {
    setSelected(i)
    transport.pause()
    transport.seek((kfs[i].t ?? 0) / cycles())
  }
  const onAdd = () => {
    /* Layer-local phase at the global playhead (see header). */
    const u = (transport.getT() * cycles()) % 1
    const base = kfs[sel] || { rot: [0, 0, 0], pos: [0, 0, 0], scale: 1, ease: 'inout' }
    const nk = {
      t: Math.max(0, Math.min(1, u)),
      rot: [...(base.rot || [0, 0, 0])],
      pos: [...(base.pos || [0, 0, 0])],
      scale: base.scale ?? 1,
      ease: base.ease || 'inout',
    }
    const next = [...kfs, nk].sort((a, b) => a.t - b.t)
    write(next)
    setSelected(next.indexOf(nk))
  }
  const onDelete = () => {
    if (kfs.length <= 1) return
    write(kfs.filter((_, i) => i !== sel))
    setSelected((s) => Math.max(0, s - 1))
  }
  const onPatch = (p) => write(kfs.map((kf, i) => (i === sel ? { ...kf, ...p } : kf)))

  const setRot = (axis, d) => { const r = [...(k.rot || [0, 0, 0])]; r[axis] = rad(d); onPatch({ rot: r }) }
  const setPos = (axis, v) => { const p = [...(k.pos || [0, 0, 0])]; p[axis] = v; onPatch({ pos: p }) }

  const pose = (label, min, max, step, value, onChange) => (
    <LabeledControl label={label}>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
    </LabeledControl>
  )

  return (
    <>
      <span className="kol-helper-10 text-meta">Keyframes</span>
      <div className="flex flex-col gap-1">
        {kfs.map((kf, i) => (
          <EditorButton
            key={i}
            variant={i === sel ? 'primary' : 'secondary'}
            size="sm"
            className="w-full"
            style={{ justifyContent: 'space-between' }}
            onClick={() => onSelect(i)}
          >
            <span>Key {i + 1}</span>
            <span className="kol-helper-10 tabular-nums">{Math.round((kf.t ?? 0) * 100)}%</span>
          </EditorButton>
        ))}
      </div>
      <div className="flex gap-2">
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={onAdd}>
          Add @ playhead
        </EditorButton>
        <EditorButton variant="ghost" size="sm" title="Delete keyframe" onClick={onDelete} disabled={kfs.length <= 1}>
          Delete
        </EditorButton>
      </div>

      <span className="kol-helper-10 text-meta">Pose</span>
      {pose('Rotate X', -360, 360, 1, deg(k.rot?.[0]), (v) => setRot(0, v))}
      {pose('Rotate Y', -360, 360, 1, deg(k.rot?.[1]), (v) => setRot(1, v))}
      {pose('Rotate Z', -360, 360, 1, deg(k.rot?.[2]), (v) => setRot(2, v))}
      {pose('Move X', -2, 2, 0.05, k.pos?.[0] || 0, (v) => setPos(0, v))}
      {pose('Move Y', -2, 2, 0.05, k.pos?.[1] || 0, (v) => setPos(1, v))}
      {pose('Move Z', -2, 2, 0.05, k.pos?.[2] || 0, (v) => setPos(2, v))}
      {pose('Scale', 0.2, 2, 0.05, k.scale ?? 1, (v) => onPatch({ scale: v }))}
      <LabeledControl label="Ease">
        <Dropdown
          variant="subtle" size="sm" className="w-full"
          options={EASE_OPTIONS}
          value={k.ease || 'inout'}
          onChange={(v) => onPatch({ ease: v })}
        />
      </LabeledControl>
    </>
  )
}
