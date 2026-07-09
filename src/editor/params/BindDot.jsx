import { useState } from 'react'
import { PopoverPanel, usePopover } from '@kolkrabbi/kol-component'
import { getSources, getSource } from './sources'
import { isGamepadSource } from './gamepad'
import { isBinding, resolveValue } from './resolve'
import { transport } from './transport'

/**
 * BindDot — the per-field modulate affordance. A tiny dot beside an animatable
 * control; its popover is a PURE SOURCE PICKER:
 *
 *   Constant   — unbind; the prop freezes at its current resolved value
 *   Keyframes  — a flat 2-key track at the current value (timeline edits it)
 *   <source>   — bind to a live modulation source (Time / Mouse / Pointer /
 *                LFO / Expression / Audio / MIDI / Joystick)
 *
 * The transform editor (range / invert / smooth / curve / expression + plot /
 * learn) lives in Parameters → Animation tab (ModulationEditor) — NOT in this
 * popover. Keeping the popover to just the picker is why it can no longer grow
 * tall enough to overflow the viewport.
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
    const v = resolveValue(value, transport.getCtx(), layer)
    if (v !== undefined && v !== null) return v
    return param.default ?? 0
  }
  const defaultRange = () =>
    param.min != null && param.max != null ? [param.min, param.max] : [0, 1]

  const pick = (m) => {
    setOpen(false)
    if (m === 'none') {
      setProp(param.key, current())
    } else if (m === 'track') {
      const v = current()
      setProp(param.key, { bind: 'track', keys: [{ t: 0, v, easing: 'linear' }, { t: 1, v, easing: 'linear' }] })
    } else {
      const src = getSource(m)
      src?.ensure?.().catch(() => {})   /* mic/MIDI permission — user gesture */
      setProp(param.key, { bind: 'mod', source: m, transform: { range: defaultRange() } })
    }
  }

  /* Collapse the ~20 individual gamepad axis/button sources into ONE
   * "Joystick" entry (binds the first pad source; re-point via Learn in the
   * Animation tab) — that list alone was what made the picker overflow. */
  const srcs = param.type === 'color' ? [] : getSources().filter((s) => !s.hidden)
  const firstPad = srcs.find((s) => isGamepadSource(s.id))
  const entries = [
    { value: 'none',  label: 'Constant' },
    { value: 'track', label: 'Keyframes' },
    ...srcs.filter((s) => !isGamepadSource(s.id)).map((s) => ({ value: s.id, label: s.label })),
    ...(firstPad ? [{ value: firstPad.id, label: 'Joystick' }] : []),
  ]

  return (
    <>
      <button
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        type="button"
        aria-label={`Modulate ${param.label ?? param.key}`}
        title={bound ? `Modulated (${mode}) — shape it in the Animation tab` : 'Modulate'}
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
      {/* Cap + scroll on the FLOATING element itself (what floating-ui
          positions) — the DS popover has no height-clamp, so the cap must
          live here, not on an inner child, or flip/shift can't keep a tall
          list on-screen. 50vh ≤ half the viewport, so flip always finds a
          side it fits on. */}
      <PopoverPanel
        popover={popover}
        panel={false}
        focus={false}
        className="z-50 bg-surface-secondary border border-fg-08 rounded shadow-lg"
        style={{ maxHeight: '50vh', overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        <div className="w-[220px]">
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
        </div>
      </PopoverPanel>
    </>
  )
}
