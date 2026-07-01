import { useState } from 'react'
import { colord } from 'colord'
import { Slider } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { SwatchStack, EyedropPick } from './SwatchControls'
import { HueStrip, SBSquare, WheelTriangle } from './SpectrumControls'
import { useColorTarget } from './useColorTarget'
import { useComposeState, resolveColor } from '../compose/state'
import { findLayerDeep } from '../compose/helpers'
import { pickFromCanvas } from './canvasEyedropper'

const MODE_OPTIONS = [
  { value: 'hue',     label: 'Hue'     },
  { value: 'wheel',   label: 'Wheel'   },
  { value: 'sliders', label: 'Sliders' },
]

/**
 * ColourPanel — Hue / Wheel / Sliders modes, all live-bound to the active
 * color target (canvas fill or selected layer's color).
 *
 * Mode picker (top-right) switches the body. Each mode reads/writes the same
 * underlying color via `useColorTarget` and the local opacity state drives
 * the layer's `opacity` (or canvas fill opacity).
 */
export function ColourBody() {
  /* Coalesce: hue strip / SB square / wheel triangle / RGB+HSL sliders all
   * fire onChange per pointermove. Without coalescing, undo would replay
   * tick-by-tick. With coalesce, all writes inside one drag collapse to a
   * single undo entry.
   *
   * useColorTarget always returns working setters now (Photoshop model —
   * app-level paint state always exists). No "no target" fallback needed. */
  const target = useColorTarget({ history: 'coalesce' })
  const [mode, setMode] = useState('hue')

  return (
    <div className="p-4 flex flex-col gap-3 h-full min-h-0">
      <TopRow mode={mode} setMode={setMode} target={target} />
      <div className="flex-1 min-h-0 flex flex-col">
        {mode === 'hue'     && <HueMode     target={target} />}
        {mode === 'wheel'   && <WheelMode   target={target} />}
        {mode === 'sliders' && <SlidersMode target={target} />}
      </div>
      <OpacityRow />
    </div>
  )
}

export default function ColourPanel() {
  return (
    <div
      className="bg-surface-primary border border-fg-08 rounded overflow-hidden"
      style={{ width: 320 }}
    >
      <ColourBody />
    </div>
  )
}

/* ────────── Top row: front swatch + eyedrop pick + mode select ────────── */

function TopRow({ mode, setMode, target }) {
  /* Read activePaint from the target (already clamped to a supported paint)
   * so SwatchStack's "front" indicator always matches what the picker
   * actually writes. */
  const { activePaint, fillHex, strokeHex, swap } = target
  /* Compose state for the eyedropper: it rasterizes the current canvas
   * (layers + palette + aspect + canvas fill) and samples one pixel. */
  const { layers, palette, aspect, customRatio, canvasFill } = useComposeState()

  const onClear = () => target.onChange(null)
  const onPickEyedrop = async () => {
    try {
      const canvasFillHex = resolveColor(canvasFill, palette) ?? null
      const hex = await pickFromCanvas({ layers, palette, aspect, customRatio, canvasFillHex })
      if (hex) target.onChange(hex)
    } catch (err) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('Eyedropper failed:', err)
      }
    }
  }
  const fillColor   = fillHex   ?? '#FFFFFF'
  const strokeColor = strokeHex ?? '#000000'
  const sampleColor = activePaint === 'stroke' ? strokeColor : fillColor

  return (
    <div className="flex items-center gap-3">
      <SwatchStack
        fillColor={fillColor}
        strokeColor={strokeColor}
        activePaint={activePaint}
        onSwap={swap}
        onClear={onClear}
      />
      <EyedropPick sampleColor={sampleColor} onPick={onPickEyedrop} />
      <div className="ml-auto">
        <Dropdown
          variant="subtle"
          size="sm"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          className="w-[110px]"
        />
      </div>
    </div>
  )
}

/* SwatchStack + EyedropPick + their internal FramedSwatch / NoneMarker
 * helpers live in `./SwatchControls.jsx` — see that file's header comment.
 * Off-limits for atom-refactor sweeps. */

/* ────────── Mode bodies ────────── */

function HueMode({ target }) {
  const hsv = colord(target.hex).toHsv()
  const setHex = (next) => target.onChange(next.toUpperCase())

  const onHue = (v) => setHex(colord({ h: v, s: hsv.s, v: hsv.v }).toHex())
  const onSV  = (s, v) => setHex(colord({ h: hsv.h, s, v }).toHex())

  return (
    <div className="flex flex-col gap-3 w-full h-full min-h-0">
      <HueStrip hue={hsv.h} onChange={onHue} />
      <div className="flex-1 min-h-0 rounded-[2px] overflow-hidden">
        <SBSquare hue={hsv.h} sat={hsv.s} val={hsv.v} onChange={onSV} />
      </div>
    </div>
  )
}

/* Classic HSB wheel + inscribed triangle picker — matches the macOS-port
 * Ref design (`ColourPanelRef`). Outer ring carries the hue conic gradient;
 * inner triangle (apex up) carries the saturation/value gradients. Handle on
 * the ring drags hue; handle in the triangle drags sat+val. */
function WheelMode({ target }) {
  const hsv = colord(target.hex).toHsv()
  const setHex = (next) => target.onChange(next.toUpperCase())
  return (
    <WheelTriangle
      hue={hsv.h} sat={hsv.s} val={hsv.v}
      onChangeHue={(h)   => setHex(colord({ h,        s: hsv.s, v: hsv.v }).toHex())}
      onChangeSV={(s, v) => setHex(colord({ h: hsv.h, s,        v        }).toHex())}
    />
  )
}

function SlidersMode({ target }) {
  const [model, setModel] = useState('hsl')
  const c = colord(target.hex)
  const setHex = (next) => target.onChange(next.toUpperCase())

  if (model === 'rgb') {
    const { r, g, b } = c.toRgb()
    return (
      <div className="flex flex-col gap-3">
        <ModelToggle model={model} setModel={setModel} />
        <SliderRow label="R" hint={`${r}`} max={255} value={r} onChange={(v) => setHex(colord({ r: v, g, b }).toHex())} />
        <SliderRow label="G" hint={`${g}`} max={255} value={g} onChange={(v) => setHex(colord({ r, g: v, b }).toHex())} />
        <SliderRow label="B" hint={`${b}`} max={255} value={b} onChange={(v) => setHex(colord({ r, g, b: v }).toHex())} />
      </div>
    )
  }

  const { h, s, l } = c.toHsl()
  return (
    <div className="flex flex-col gap-3">
      <ModelToggle model={model} setModel={setModel} />
      <SliderRow label="H" hint={`${Math.round(h)}°`} max={360} value={Math.round(h)} onChange={(v) => setHex(colord({ h: v, s, l }).toHex())} />
      <SliderRow label="S" hint={`${Math.round(s)}%`} max={100} value={Math.round(s)} onChange={(v) => setHex(colord({ h, s: v, l }).toHex())} />
      <SliderRow label="L" hint={`${Math.round(l)}%`} max={100} value={Math.round(l)} onChange={(v) => setHex(colord({ h, s, l: v }).toHex())} />
    </div>
  )
}

const MODEL_OPTIONS = [
  { value: 'hsl', label: 'HSL' },
  { value: 'rgb', label: 'RGB' },
]
function ModelToggle({ model, setModel }) {
  return (
    <div className="flex items-center">
      <SegmentedToggle value={model} onChange={setModel} options={MODEL_OPTIONS} />
    </div>
  )
}

function SliderRow({ label, hint, max, value, onChange }) {
  return (
    <LabeledControl inline label={label} hint={hint}>
      <Slider min={0} max={max} value={value} onChange={onChange} />
    </LabeledControl>
  )
}

function OpacityRow() {
  const { selectedId, layers, updateLayer, canvasFillOpacity, setCanvasFillOpacity } = useComposeState()

  const isCanvas = selectedId === 'canvas'
  const layer    = !isCanvas && selectedId ? findLayerDeep(layers, selectedId) : null

  /* Local fallback so dragging always moves the slider, even with no target. */
  const [localOpacity, setLocalOpacity] = useState(100)

  const value = isCanvas
    ? Math.round((canvasFillOpacity ?? 1) * 100)
    : layer
      ? Math.round((layer.opacity ?? 1) * 100)
      : localOpacity

  const onChange = isCanvas
    ? (v) => setCanvasFillOpacity(v / 100)
    : layer
      ? (v) => updateLayer(layer.id, { opacity: v / 100 })
      : setLocalOpacity

  return (
    <LabeledControl inline label="Opacity">
      <Slider min={0} max={100} value={value} onChange={onChange} />
    </LabeledControl>
  )
}

/* HueStrip / SBSquare / WheelTriangle and their internal Handle / SvgHandle
 * helpers live in `./SpectrumControls.jsx` — see that file's header.
 * Off-limits for atom-refactor sweeps. */
