import { Dropdown, LabeledControl } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { useComposeState } from '../state'
import { visibleParams } from '../../params/schema'
import { loopById } from '../../../loops/registry'
import XYPad from './XYPad'

/**
 * ParatypeTools — the paratype loop's extra control surface, mounted once in
 * ParametersPanel's LoopFields (it self-gates on the loop id, so the mount
 * costs nothing for every other loop):
 *
 *   Generate → "Flatten to vector" (state.jsx flattenParatype — the
 *              text/pattern Flatten precedent, but emitting REAL engine
 *              paths as shape layers instead of a raster).
 *   Style    → the labs XY explore pad (ParaTypePage XYTab:130-163): two
 *              axis pickers over the loop's visible numeric params + a 2D
 *              pad writing both in one coalesced patch.
 *
 * Axis choices persist on the layer as `_xyX` / `_xyY` (the `_framePreset`
 * off-schema idiom) so they survive reselection.
 */
export default function ParatypeTools({ layer, patch, tab }) {
  if (layer?.loopId !== 'paratype-glyph') return null
  if (tab === 'generate') return <FlattenAction layer={layer} />
  if (tab === 'style') return <ExplorePad layer={layer} patch={patch} />
  return null
}

function FlattenAction({ layer }) {
  const { flattenParatype } = useComposeState()
  if (!flattenParatype) return null
  return (
    <EditorButton
      variant="secondary" size="sm" className="w-full"
      onClick={() => flattenParatype(layer.id)}
      title="Flatten the glyph(s) to vector shape layers (one-way)"
    >
      Flatten to vector
    </EditorButton>
  )
}

function ExplorePad({ layer, patch }) {
  const loop = loopById(layer.loopId)
  const axes = visibleParams(loop?.params ?? [], layer).filter((q) => q.type === 'range')
  if (axes.length < 2) return null

  /* Wanted key if it's an available axis (and not the other one), else the
   * first free axis — keeps the pad valid when `when` gates hide a param. */
  const pick = (want, taken) =>
    axes.some((a) => a.key === want) && want !== taken
      ? want
      : (axes.find((a) => a.key !== taken)?.key)
  const xKey = pick(layer._xyX ?? 'stemWidth', null)
  const yKey = pick(layer._xyY ?? 'oWidth', xKey)
  const xDef = axes.find((a) => a.key === xKey)
  const yDef = axes.find((a) => a.key === yKey)
  if (!xDef || !yDef) return null

  const val = (key, def) => (typeof layer[key] === 'number' ? layer[key] : def.default)
  const snap = (v, def) => {
    const st = def.step ?? 1
    return st < 1 ? Number((Math.round(v / st) * st).toFixed(4)) : Math.round(v)
  }
  const options = axes.map((a) => ({ value: a.key, label: a.label }))

  return (
    <>
      <span className="kol-helper-10 text-meta">Explore</span>
      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="X axis">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={options} value={xKey}
            onChange={(v) => patch({ _xyX: v })}
          />
        </LabeledControl>
        <LabeledControl label="Y axis">
          <Dropdown
            variant="subtle" size="sm" className="w-full"
            options={options} value={yKey}
            onChange={(v) => patch({ _xyY: v })}
          />
        </LabeledControl>
      </div>
      <XYPad
        xValue={val(xKey, xDef)} yValue={val(yKey, yDef)}
        xMin={xDef.min ?? 0} xMax={xDef.max ?? 1}
        yMin={yDef.min ?? 0} yMax={yDef.max ?? 1}
        xLabel={xDef.label} yLabel={yDef.label}
        onChange={(x, y) => patch({ [xKey]: snap(x, xDef), [yKey]: snap(y, yDef) })}
      />
    </>
  )
}
