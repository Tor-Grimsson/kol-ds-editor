import { useRef, useState } from 'react'
import EditorIcon from '../../icons/EditorIcon'
import { PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
import { TOOL_META, useTool } from '../../state/tools'
import { useComposeState, COVER_TYPES, CANVAS_W, CANVAS_H } from '../../compose/state'
import { isBooleanable } from '../../compose/boolean-ops'

/* Toolbar metrics — sized to the editor.kolkrabbi.io reference (roomy
 * ~36px buttons, ~22px glyphs), not the previous 28/14 which read tiny. */
const BTN  = 36
const ICON = 22

/**
 * ToolPalette — horizontal tool bar mounted in `canvas.header` for Compose
 * mode. Renders above the main canvas, between the rails:
 *
 *   Select · Text · [Shape ▾] · Pattern
 *
 * The Shape entry is a popover dropdown that swaps between `rect` and
 * `ellipse`. Trigger icon reflects the last-picked variant. Clicking the
 * trigger arms the last-picked variant; opening the dropdown lets the
 * user switch.
 *
 * All buttons use `kol-btn-quiet` (dimmed at rest, brightens on hover) —
 * matches the LayerStack `+`/trash idiom. The active tool drops the
 * quiet class so it stays at full opacity, making it the only fully-lit
 * button at rest. No background fill, no brand color. Icons come from
 * the editor-scoped icon loader (`src/editor/icons/`).
 */

const SHAPE_VARIANTS = [
  { id: 'rect',     label: 'Rectangle', icon: 'tool-rect',     shortcut: 'R' },
  { id: 'ellipse',  label: 'Ellipse',   icon: 'tool-ellipse',  shortcut: 'O' },
  { id: 'triangle', label: 'Triangle',  icon: 'tool-triangle', shortcut: '' },
  { id: 'line',     label: 'Line',      icon: 'tool-line',     shortcut: '' },
  { id: 'polygon',  label: 'Polygon',   icon: 'tool-polygon',  shortcut: '' },
  { id: 'star',     label: 'Star',      icon: 'tool-star',     shortcut: '' },
]
const SHAPE_IDS = new Set(SHAPE_VARIANTS.map((v) => v.id))

function ToolButton({ id, active, onClick }) {
  const meta = TOOL_META[id]
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick()
        /* Drop focus so the canvas regains it. Some browsers don't refresh
         * the canvas cursor while a button (with its own cursor:pointer)
         * holds focus. */
        e.currentTarget.blur()
      }}
      aria-label={meta.label}
      aria-pressed={active}
      data-kol-tip={meta.shortcut ? `${meta.label} (${meta.shortcut})` : meta.label}
      className={`inline-flex items-center justify-center rounded text-emphasis ${active ? '' : 'kol-btn-quiet'}`}
      style={{ width: BTN, height: BTN, padding: 7 }}
    >
      <EditorIcon name={meta.icon} size={ICON} />
    </button>
  )
}

/* Action button — one-shot operation on the current selection (flip,
 * rotate, crop, duplicate), as opposed to a mode-arming tool. */
function ActionButton({ icon, label, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        onClick()
        e.currentTarget.blur()
      }}
      aria-label={label}
      data-kol-tip={label}
      className={`inline-flex items-center justify-center rounded text-emphasis kol-btn-quiet ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
      style={{ width: BTN, height: BTN, padding: 7 }}
    >
      <EditorIcon name={icon} size={ICON} />
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--kol-fg-08)', margin: '0 6px', flexShrink: 0 }} />
}

function ShapeDropdown({ tool, setTool }) {
  const [open, setOpen] = useState(false)
  const [lastPicked, setLastPicked] = useState('rect')
  const popover = usePopover({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    offset: 4,
    role: 'menu',
  })
  const active = SHAPE_IDS.has(tool)
  const triggerVariant = SHAPE_VARIANTS.find((v) => v.id === (active ? tool : lastPicked)) ?? SHAPE_VARIANTS[0]

  return (
    <>
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps({
          onClick: (e) => {
            /* Clicking the trigger always arms the last-picked variant.
             * Floating-ui's click handler also toggles the dropdown so
             * the user can immediately switch — both intents fire on
             * the same click. Blur after so the canvas cursor refreshes. */
            if (!active) setTool(triggerVariant.id)
            e.currentTarget.blur()
          },
        })}
        aria-label={`Shape: ${triggerVariant.label}`}
        aria-pressed={active}
        data-kol-tip={triggerVariant.shortcut ? `Shape: ${triggerVariant.label} (${triggerVariant.shortcut})` : `Shape: ${triggerVariant.label}`}
        className={`relative inline-flex items-center justify-center rounded text-emphasis ${active ? '' : 'kol-btn-quiet'}`}
        style={{ width: BTN, height: BTN, padding: 7 }}
      >
        <EditorIcon name={triggerVariant.icon} size={ICON} />
        <EditorIcon
          name="tool-fold-indicator"
          size={5}
          className="absolute opacity-70"
          style={{ right: 3, bottom: 3 }}
        />
      </button>
      <PopoverPanel popover={popover} panel={false} focus={false} className="z-50 bg-surface-secondary border border-fg-08 rounded shadow-lg">
        {SHAPE_VARIANTS.map((v) => {
          const isActive = tool === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={(e) => {
                setTool(v.id)
                setLastPicked(v.id)
                setOpen(false)
                e.currentTarget.blur()
              }}
              className="w-full kol-helper-12 px-3 h-8 inline-flex items-center gap-2 text-body hover:text-emphasis text-left"
            >
              <span className="shrink-0 w-4 inline-flex items-center justify-center">
                <EditorIcon name={v.icon} size={14} />
              </span>
              <span className="flex-1 truncate">{v.label}</span>
              <span className="kol-helper-10 text-emphasis shrink-0">{isActive ? '✓' : v.shortcut}</span>
            </button>
          )
        })}
      </PopoverPanel>
    </>
  )
}

export default function ToolPalette() {
  const { tool, setTool } = useTool()
  const {
    layers, selectedId, selectedIds,
    flipSelected, duplicateLayer, updateLayer, addLayer, booleanSelected,
  } = useComposeState()

  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null
  const hasSel   = selectedIds.some((id) => id !== 'canvas')
  const canXform = !!selectedLayer && !COVER_TYPES.includes(selectedLayer.type) && !selectedLayer.locked
  /* Booleans need ≥2 selected closed vector layers (paths / basic shapes). */
  const canBool  = layers.filter((l) => selectedIds.includes(l.id) && isBooleanable(l)).length >= 2

  /* Quarter-turn rotate on the primary selected layer. */
  const rotateBy = (delta) => {
    if (!canXform) return
    const rot = selectedLayer.rotation ?? 0
    updateLayer(selectedLayer.id, { rotation: ((Math.round(rot + delta) % 360) + 360) % 360 })
  }

  /* Image insert — hidden file input; the picked file lands as a photo
   * layer (data URL src) fit within ~720px and centered. */
  const fileRef = useRef(null)
  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''  /* allow re-picking the same file */
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) return
        const k = Math.min(1, 720 / img.naturalWidth, 720 / img.naturalHeight)
        const w = Math.round(img.naturalWidth * k)
        const h = Math.round(img.naturalHeight * k)
        addLayer('photo', {
          src: reader.result,
          x: Math.round((CANVAS_W - w) / 2),
          y: Math.round((CANVAS_H - h) / 2),
          w, h,
          fit: 'cover',
        })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex items-center gap-1 px-3 h-12">
      <ToolButton id="select"  active={tool === 'select'}  onClick={() => setTool('select')} />
      <ToolButton id="text"    active={tool === 'text'}    onClick={() => setTool('text')} />
      <ToolButton id="pen"     active={tool === 'pen'}     onClick={() => setTool('pen')} />
      <ShapeDropdown tool={tool} setTool={setTool} />
      <ToolButton id="pattern" active={tool === 'pattern'} onClick={() => setTool('pattern')} />
      <ToolButton id="zoom"    active={tool === 'zoom'}    onClick={() => setTool('zoom')} />

      <Divider />

      <ActionButton icon="flip-h"       label="Flip horizontal (⇧H)" disabled={!hasSel}   onClick={() => flipSelected('h')} />
      <ActionButton icon="flip-v"       label="Flip vertical (⇧V)"   disabled={!hasSel}   onClick={() => flipSelected('v')} />
      <ActionButton icon="rotate-left"  label="Rotate 90° left"      disabled={!canXform} onClick={() => rotateBy(-90)} />
      <ActionButton icon="rotate-right" label="Rotate 90° right"     disabled={!canXform} onClick={() => rotateBy(90)} />

      <Divider />

      <ActionButton icon="bool-unite"     label="Unite"          disabled={!canBool} onClick={() => booleanSelected('unite')} />
      <ActionButton icon="bool-subtract"  label="Subtract front" disabled={!canBool} onClick={() => booleanSelected('subtract')} />
      <ActionButton icon="bool-intersect" label="Intersect"      disabled={!canBool} onClick={() => booleanSelected('intersect')} />
      <ActionButton icon="bool-exclude"   label="Exclude"        disabled={!canBool} onClick={() => booleanSelected('exclude')} />

      <Divider />

      <ActionButton
        icon="image"
        label="Insert image"
        disabled={false}
        onClick={() => fileRef.current?.click()}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        style={{ display: 'none' }}
      />
      <ActionButton
        icon="crop"
        label="Crop image"
        disabled={selectedLayer?.type !== 'photo' || selectedLayer.locked}
        onClick={() => window.dispatchEvent(new CustomEvent('kol:enter-crop', { detail: selectedLayer.id }))}
      />
      <ActionButton
        icon="duplicate"
        label="Duplicate (⌘D)"
        disabled={!selectedLayer || selectedLayer.id === 'canvas'}
        onClick={() => duplicateLayer(selectedLayer.id)}
      />
    </div>
  )
}
