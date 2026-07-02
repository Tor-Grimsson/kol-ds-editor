import { Slider, Dropdown, Input, LabeledControl } from '@kolkrabbi/kol-component'
import { useComposeState } from '../state'
import { ASPECTS } from '../../shell/aspects'
import { ColorField } from './LayerInspector'

/**
 * CanvasInspector — properties for the canvas/frame "layer".
 *
 * The canvas is the bottom-most selectable item in the layer stack (and the
 * inspector's default when nothing is selected). Owns the output size
 * (preset or custom W×H px), grid visibility, background color + hex, and
 * fill opacity. The 1080-virtual coordinate space is unchanged — W×H drive
 * the frame ratio + export resolution only.
 */
const PRESET_OPTIONS = ASPECTS.map((a) => ({ value: a.id, label: a.label }))

export default function CanvasInspector() {
  const {
    aspect, setAspect,
    canvasW, canvasH, setCanvasSize,
    showGrid, toggleGrid,
    canvasFill, setCanvasFill,
    canvasFillOpacity, setCanvasFillOpacity,
    palette,
  } = useComposeState()

  const num = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback
  }

  return (
    <div className="flex flex-col gap-4">
      <LabeledControl label="Size">
        <Dropdown
          variant="subtle"
          size="sm"
          className="w-full"
          options={PRESET_OPTIONS}
          value={aspect}
          onChange={setAspect}
        />
      </LabeledControl>

      <LabeledControl label="Dimensions">
        <div className="flex items-center gap-2">
          <SizeField label="W" value={canvasW} onCommit={(w) => setCanvasSize(w, canvasH)} num={num} />
          <span className="shrink-0 select-none" style={{ color: 'var(--kol-fg-48)' }}>×</span>
          <SizeField label="H" value={canvasH} onCommit={(h) => setCanvasSize(canvasW, h)} num={num} />
        </div>
      </LabeledControl>

      <LabeledControl label="Grid">
        <button
          type="button"
          onClick={toggleGrid}
          aria-pressed={showGrid}
          className="inline-flex items-center gap-2 kol-helper-12 rounded px-2 h-7"
          style={{
            border: '1px solid var(--kol-fg-08)',
            background: 'transparent',
            cursor: 'pointer',
            color: showGrid ? 'var(--kol-accent-primary)' : 'var(--kol-fg-48)',
          }}
        >
          {showGrid ? 'Visible' : 'Hidden'}
        </button>
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

/* Number field that commits on blur / Enter (not per-keystroke) so typing
 * "1920" doesn't reshape the canvas at "1", "19", "192". */
function SizeField({ label, value, onCommit, num }) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span
        className="shrink-0 select-none"
        style={{ fontFamily: 'var(--kol-font-family-mono)', fontSize: 10, width: 10, textAlign: 'center', color: 'var(--kol-fg-48)' }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <Input
          variant="ghost"
          size="sm"
          type="number"
          defaultValue={value}
          key={value}
          onBlur={(e) => onCommit(num(e.target.value, value))}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
      </div>
    </div>
  )
}
