import { useRef } from 'react'
import { ColorSwatch, PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
import { WEIGHTS } from '../../data/typography-cuts'

/**
 * TypeBlockToolbar — floating toolbar anchored above a selected TypeBlock.
 *
 * Anchored via floating-ui (`@floating-ui/react`) to the parent container
 * passed in `referenceElement`. Portal-rendered (escapes overflow), auto-
 * flips below if no room above, viewport-shifts on the cross axis. Mirrors
 * TypeBlock's `value` shape; partial patches via `onChange`.
 *
 * UX matches the prior FloatingToolbar:
 *   - 3-button alignment (left/center/right)
 *   - Weight cycle button (click to advance through WEIGHTS)
 *   - Italic toggle
 *   - ColorSwatch trigger → OS color picker via hidden input
 *   - Delete frame
 *
 * The alignment / weight / italic / delete buttons share a local
 * `ToolbarBtn` (text-absolute-white on dark chrome, brand-primary fill on
 * active). Pre-existing primitives (Button atom, ViewToggle molecule) don't
 * fit the dark-toolbar context cleanly; the local component stays minimal
 * and self-contained.
 *
 * Cut + size + tracking + line-height + case live in the sidebar
 * inspector (TypeControls), not the floating toolbar.
 */

const ALIGN_OPTIONS = [
  { value: 'left',   label: '⇤' },
  { value: 'center', label: '↔' },
  { value: 'right',  label: '⇥' },
]

const cycleWeight = (current) => {
  const idx = WEIGHTS.findIndex((w) => w.id === current)
  return WEIGHTS[(idx + 1) % WEIGHTS.length].id
}

function ToolbarBtn({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active ? true : undefined}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      className={`kol-mono-12 inline-flex items-center justify-center rounded transition-colors px-2 py-1 text-absolute-white ${
        active ? 'bg-fg-absolute-24' : 'bg-transparent hover:bg-fg-absolute-16'
      }`}
      style={{ minWidth: 24, height: 24, lineHeight: 1 }}
    >
      {children}
    </button>
  )
}

function ColorPickerSwatch({ value, onChange }) {
  const inputRef = useRef(null)
  return (
    <span className="relative inline-flex">
      <ColorSwatch
        hex={value}
        size={20}
        onClick={() => inputRef.current?.click()}
        title="Frame color"
      />
      <input
        ref={inputRef}
        type="color"
        value={value || '#FFFFFF'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 0, height: 0 }}
        aria-label="Frame color"
        tabIndex={-1}
      />
    </span>
  )
}

export default function TypeBlockToolbar({ value, onChange, onRemove, referenceElement }) {
  const weightLabel = WEIGHTS.find((w) => w.id === value.weight)?.label ?? value.weight

  /* Toolbar is always visible while mounted (consumer controls render
   * lifecycle via `selected`). `open: true` + `click: false`/`dismiss:
   * false` mean floating-ui handles only positioning, not interactions. */
  const popover = usePopover({
    open: true,
    onOpenChange: () => {},
    placement: 'top',
    offset: 12,
    click: false,
    dismiss: false,
    role: 'toolbar',
    referenceElement,
  })

  if (!referenceElement) return null

  return (
    <PopoverPanel
      popover={popover}
      panel={false}
      focus={false}
      className="inline-flex items-center gap-1 bg-fg-absolute-96 border border-fg-absolute-08 rounded px-1.5 py-1 whitespace-nowrap shadow-lg"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1"
      >
      {ALIGN_OPTIONS.map((opt) => (
        <ToolbarBtn
          key={opt.value}
          active={(value.textAlign ?? 'center') === opt.value}
          title={`Align ${opt.value}`}
          onClick={() => onChange({ textAlign: opt.value })}
        >
          {opt.label}
        </ToolbarBtn>
      ))}

      <span className="w-px h-4 bg-fg-absolute-16 mx-1" />

      <ToolbarBtn
        title={`Weight: ${weightLabel} · click to cycle`}
        onClick={() => onChange({ weight: cycleWeight(value.weight) })}
      >
        {weightLabel}
      </ToolbarBtn>

      <ToolbarBtn
        active={value.italic}
        title="Italic"
        onClick={() => onChange({ italic: !value.italic })}
      >
        I
      </ToolbarBtn>

      <span className="w-px h-4 bg-fg-absolute-16 mx-1" />

      <ColorPickerSwatch value={value.color} onChange={(hex) => onChange({ color: hex })} />

      <span className="w-px h-4 bg-fg-absolute-16 mx-1" />

      <ToolbarBtn title="Delete frame" onClick={onRemove}>
        ×
      </ToolbarBtn>
      </div>
    </PopoverPanel>
  )
}
