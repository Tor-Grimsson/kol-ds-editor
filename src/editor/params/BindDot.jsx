import { useState } from 'react'
import { PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
import { getSources, getSource } from './sources'
import { isBinding, resolveValue } from './resolve'
import { transport } from './transport'

/**
 * BindDot — the per-field animate affordance (param-graph RFC / plan.md
 * Phase 2). Sits beside an animatable control (AutoControls' `renderAnimate`
 * seam, or hand-placed e.g. on the rotation row) and binds the layer prop to:
 *
 *   Constant   — unbind; the prop freezes at its current resolved value
 *   Keyframes  — a flat 2-key track at the current value; the timeline dock
 *                is where keys are then placed/valued
 *   <source>   — live modulation mapped onto the param's [min,max]
 *
 * The dot fills accent when bound. Color params bind to keyframes only
 * (a 0..1 source has no meaning on a color).
 */
export default function BindDot({ layer, param, setProp }) {
  const [open, setOpen] = useState(false)
  const popover = usePopover({ open, onOpenChange: setOpen, placement: 'bottom-end', offset: 4, role: 'menu' })

  const value = layer[param.key]
  const bound = isBinding(value)
  const mode = bound ? (value.bind === 'track' ? 'track' : value.source) : 'none'

  /* Current concrete value — the base a new binding starts from, and the
   * constant an unbind freezes to. */
  const current = () => {
    const v = resolveValue(value, transport.getCtx())
    if (v !== undefined && v !== null) return v
    return param.default ?? 0
  }

  const pick = (m) => {
    setOpen(false)
    if (m === 'none') {
      setProp(param.key, current())
    } else if (m === 'track') {
      const v = current()
      setProp(param.key, { bind: 'track', keys: [{ t: 0, v, easing: 'linear' }, { t: 1, v, easing: 'linear' }] })
    } else {
      const src = getSource(m)
      src?.ensure?.().catch(() => {})   /* mic permission etc. — user gesture */
      const range = param.min != null && param.max != null ? [param.min, param.max] : [0, 1]
      setProp(param.key, { bind: 'mod', source: m, transform: { range } })
    }
  }

  const entries = [
    { value: 'none',  label: 'Constant' },
    { value: 'track', label: 'Keyframes' },
    ...(param.type === 'color' ? [] : getSources().map((s) => ({ value: s.id, label: s.label }))),
  ]

  return (
    <>
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        type="button"
        aria-label={`Animate ${param.label ?? param.key}`}
        title={bound ? `Animated (${mode})` : 'Animate'}
        className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <span
          aria-hidden="true"
          className="rounded-full"
          style={{
            width: 7, height: 7,
            background: bound ? 'var(--kol-accent-primary)' : 'transparent',
            border: `1.5px solid ${bound ? 'var(--kol-accent-primary)' : 'var(--kol-fg-48)'}`,
          }}
        />
      </button>
      <PopoverPanel popover={popover} panel={false} focus={false} className="z-50 bg-surface-secondary border border-fg-08 rounded shadow-lg">
        {entries.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => pick(e.value)}
            className="w-full kol-helper-12 px-3 h-8 inline-flex items-center gap-2 text-body hover:text-emphasis text-left"
          >
            <span className="flex-1 truncate">{e.label}</span>
            <span className="kol-helper-10 text-emphasis shrink-0">{mode === e.value ? '✓' : ''}</span>
          </button>
        ))}
      </PopoverPanel>
    </>
  )
}
