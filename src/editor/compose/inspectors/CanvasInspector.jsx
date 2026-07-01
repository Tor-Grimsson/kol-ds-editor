import { Slider } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { ASPECTS } from '../../shell/aspects'
import { ColorField } from './LayerInspector'

/**
 * CanvasInspector — properties for the canvas/frame "layer".
 *
 * The canvas itself is the bottom-most selectable item in the layer stack
 * (and the inspector's default when nothing is selected). Shows the canvas
 * dimensions/aspect, its background color + hex, and fill opacity. Aspect +
 * view live in the topbar Canvas menu (same control shouldn't have two
 * surfaces).
 */
export default function CanvasInspector() {
  const {
    aspect,
    canvasFill, setCanvasFill,
    canvasFillOpacity, setCanvasFillOpacity,
    palette,
  } = useComposeState()

  const a = ASPECTS.find((x) => x.id === aspect) ?? ASPECTS[0]
  const w = 1080
  const h = Math.round(1080 / (a.ratio ?? 1))

  return (
    <div className="flex flex-col gap-4">
      <LabeledControl label="Canvas">
        <div className="flex items-center justify-between kol-helper-12 text-meta">
          <span>{a.label}</span>
          <span style={{ fontFamily: 'var(--kol-font-family-mono)' }}>{w} × {h}</span>
        </div>
      </LabeledControl>
      <ColorField
        label="Background"
        value={canvasFill}
        onChange={setCanvasFill}
        palette={palette}
      />
      <LabeledControl label="Fill opacity">
        <Slider
          min={0}
          max={100}
          value={Math.round((canvasFillOpacity ?? 1) * 100)}
          onChange={(v) => setCanvasFillOpacity(v / 100)}
        />
      </LabeledControl>
    </div>
  )
}
