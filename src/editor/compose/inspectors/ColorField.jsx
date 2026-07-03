import { useState } from 'react'
import { ColorSwatch, Input, LabeledControl, PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
import { resolveColor } from '../state'

/* Palette-ref grid shown in the swatch popover. */
export const PALETTE_REFS = [
  { value: 'palette:primary',   label: 'Primary' },
  { value: 'palette:secondary', label: 'Secondary' },
  { value: 'palette:light',     label: 'Light' },
  { value: 'palette:dark',      label: 'Dark' },
  { value: 'palette:accent',    label: 'Accent' },
  { value: 'palette:bg',        label: 'Background' },
]

/**
 * ColorField — swatch button + inline hex input. The swatch shows the
 * resolved color; the hex input lets the user type a literal hex without
 * opening anything. Click the swatch to open a popover with the palette-ref
 * grid. Extracted from LayerInspector so both it and the schema-driven
 * AutoControls can consume it without an import cycle.
 */
export function ColorField({ value, onChange, palette, label = 'Color', hideLabel = false }) {
  const isPaletteRef = typeof value === 'string' && value.startsWith('palette:')
  const isNone       = value == null
  const resolved     = resolveColor(value, palette) ?? '#FFFFFF'
  const subtitle     = isNone
    ? 'None'
    : isPaletteRef
      ? (PALETTE_REFS.find((r) => r.value === value)?.label ?? value)
      : resolved.toUpperCase()
  const isStroke     = label === 'Stroke'

  const [open, setOpen] = useState(false)
  const popover = usePopover({ open, onOpenChange: setOpen, placement: 'bottom-start', offset: 4 })

  return (
    <LabeledControl label={hideLabel ? null : label}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={popover.refs.setReference}
          {...popover.getReferenceProps()}
          aria-label={`${label}: ${subtitle}`}
          className="inline-flex items-center shrink-0"
        >
          <ColorSwatch
            hex={resolved}
            size={32}
            showTransparent={isNone}
            transparentTone={isStroke ? 'error' : 'warning'}
            hoverable={false}
          />
        </button>
        {/* None shows an empty field ('# –' via placeholder), not the resolved
            fallback hex — a disabled fill claiming #FFFFFF reads as white. */}
        <Input
          variant="ghost"
          size="sm"
          prefix="#"
          chars={6}
          uppercase
          placeholder="–"
          value={isNone ? '' : resolved.replace(/^#/, '').toUpperCase()}
          onChange={(e) => onChange('#' + e.target.value.replace(/^#/, '').toUpperCase())}
        />
      </div>
      <PopoverPanel
        popover={popover}
        panel={false}
        focus={false}
        className="bg-surface-secondary border border-fg-08 rounded p-2 flex flex-col gap-2 shadow-lg"
        style={{ minWidth: 200 }}
      >
        <div className="grid grid-cols-6 gap-1">
          {PALETTE_REFS.map((ref) => (
            <ColorSwatch
              key={ref.value}
              hex={resolveColor(ref.value, palette) ?? '#000000'}
              size="fill"
              selected={value === ref.value}
              title={ref.label}
              onClick={() => { onChange(ref.value); setOpen(false) }}
            />
          ))}
        </div>
      </PopoverPanel>
    </LabeledControl>
  )
}
