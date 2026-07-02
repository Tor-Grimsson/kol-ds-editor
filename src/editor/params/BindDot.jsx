import { useState } from 'react'
import { PopoverPanel, usePopover, Input, Slider, LabeledControl, ViewToggle } from '@kolkrabbi/kol-component'
import { getSources, getSource } from './sources'
import { learnCC } from './midi'
import { isBinding, resolveValue } from './resolve'
import { transport } from './transport'

/**
 * BindDot — the per-field animate affordance (param-graph RFC / Phase 2,
 * transform editor added in Phase 9). Sits beside an animatable control and
 * binds the layer prop to:
 *
 *   Constant   — unbind; the prop freezes at its current resolved value
 *   Keyframes  — a flat 2-key track at the current value (timeline edits it)
 *   <source>   — live modulation mapped onto the param's [min,max]
 *
 * When bound to a source, the popover grows a transform editor: range
 * min/max, invert, smoothing — plus rate/phase for LFOs and MIDI learn for
 * the MIDI source. All writes go through setProp (undo-safe); transform
 * edits rewrite the binding object, which also resets its smoother.
 */
/* Click-to-fill examples for the expression source — the best of labs'
 * oscilloscope reference list (pages/math/expression/data/reference.js),
 * limited to strings that stay in the normalized 0..1 source space. */
const EXPR_EXAMPLES = [
  { code: 'wave(t*2)',    desc: 'Fast sine' },
  { code: 'saw(t)*0.8',   desc: 'Ramp to 80' },
  { code: 'tri(t*0.5)',   desc: 'Slow bounce' },
  { code: 'pulse(t, 0.3)', desc: 'PWM 30%' },
  { code: 'ease(t*2, 4)', desc: 'Fast + punchy' },
  { code: 'bell(t)',      desc: 'Bell curve' },
  { code: 'step(t, 4)',   desc: '4 steps' },
  { code: 'rand()',       desc: 'Noise' },
]

export default function BindDot({ layer, param, setProp }) {
  const [open, setOpen] = useState(false)
  const [learning, setLearning] = useState(false)
  const [exprDraft, setExprDraft] = useState(null)   /* null = not editing */
  const popover = usePopover({ open, onOpenChange: setOpen, placement: 'bottom-end', offset: 4, role: 'menu' })

  const value = layer[param.key]
  const bound = isBinding(value)
  const mode = bound ? (value.bind === 'track' ? 'track' : value.source) : 'none'
  const isMod = bound && value.bind === 'mod'
  const tr = isMod ? (value.transform ?? {}) : null

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
    if (m === 'none') {
      setOpen(false)
      setProp(param.key, current())
    } else if (m === 'track') {
      setOpen(false)
      const v = current()
      setProp(param.key, { bind: 'track', keys: [{ t: 0, v, easing: 'linear' }, { t: 1, v, easing: 'linear' }] })
    } else {
      const src = getSource(m)
      src?.ensure?.().catch(() => {})   /* mic/MIDI permission — user gesture */
      setProp(param.key, { bind: 'mod', source: m, transform: { range: defaultRange() } })
      /* keep the popover open — the transform editor just appeared */
    }
  }

  /* Rewrite the binding with a transform patch (new object → smoother resets). */
  const patchTransform = (patch) => {
    setProp(param.key, { ...value, transform: { ...tr, ...patch } })
  }

  const onLearn = async () => {
    setLearning(true)
    const cc = await learnCC()
    setLearning(false)
    if (cc != null) patchTransform({ cc })
  }

  const entries = [
    { value: 'none',  label: 'Constant' },
    { value: 'track', label: 'Keyframes' },
    ...(param.type === 'color' ? [] : getSources().filter((s) => !s.hidden).map((s) => ({ value: s.id, label: s.label }))),
  ]

  const isLfo = isMod && value.source.startsWith('lfo-')
  const isMidi = isMod && value.source === 'midi'
  const isExpr = isMod && value.source === 'expr'
  const exprStr = tr?.expr ?? 'wave(t)'
  const commitExpr = (str) => {
    setExprDraft(null)
    const s = String(str).trim()
    if (s && s !== exprStr) patchTransform({ expr: s })
  }
  const range = tr?.range ?? defaultRange()
  const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback }

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

          {/* ── transform editor (bound to a source) ─────────────────── */}
          {isMod && (
            <div className="flex flex-col gap-3 px-3 py-3 border-t border-fg-08">
              <LabeledControl label="Range">
                <div className="flex items-center gap-2">
                  <Input
                    variant="filled" size="sm" type="number" chars={5}
                    value={range[0]}
                    onChange={(e) => patchTransform({ range: [num(e.target.value, range[0]), range[1]] })}
                  />
                  <span className="kol-helper-10 text-meta">to</span>
                  <Input
                    variant="filled" size="sm" type="number" chars={5}
                    value={range[1]}
                    onChange={(e) => patchTransform({ range: [range[0], num(e.target.value, range[1])] })}
                  />
                </div>
              </LabeledControl>
              <div className="grid grid-cols-2 gap-2">
                <LabeledControl label="Invert">
                  <ViewToggle
                    options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                    viewMode={tr?.invert ? 'on' : 'off'}
                    onViewChange={(v) => patchTransform({ invert: v === 'on' })}
                  />
                </LabeledControl>
                <LabeledControl label="Smooth">
                  <Slider min={0} max={0.95} step={0.05} value={tr?.smooth ?? 0} onChange={(v) => patchTransform({ smooth: v })} />
                </LabeledControl>
              </div>
              {isLfo && (
                <div className="grid grid-cols-2 gap-2">
                  <LabeledControl label="Rate · cycles">
                    <Slider min={0.25} max={16} step={0.25} value={tr?.rate ?? 1} onChange={(v) => patchTransform({ rate: v })} />
                  </LabeledControl>
                  <LabeledControl label="Phase">
                    <Slider min={0} max={1} step={0.01} value={tr?.phase ?? 0} onChange={(v) => patchTransform({ phase: v })} />
                  </LabeledControl>
                </div>
              )}
              {isExpr && (
                <>
                  <LabeledControl label="Expression">
                    <Input
                      variant="ghost" size="sm"
                      value={exprDraft ?? exprStr}
                      onChange={(e) => setExprDraft(e.target.value)}
                      onBlur={(e) => commitExpr(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                  </LabeledControl>
                  <div className="flex flex-col">
                    {EXPR_EXAMPLES.map((ex) => (
                      <button
                        key={ex.code}
                        type="button"
                        onClick={() => patchTransform({ expr: ex.code })}
                        className="w-full kol-helper-10 h-6 inline-flex items-center gap-2 text-body hover:text-emphasis text-left"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontVariantLigatures: 'none' }}
                      >
                        <span className="truncate" style={{ fontFamily: 'var(--kol-font-mono, monospace)' }}>{ex.code}</span>
                        <span className="flex-1 text-right text-meta truncate">{ex.desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {isMidi && (
                <LabeledControl label={tr?.cc != null ? `MIDI · CC ${tr.cc}` : 'MIDI · no CC yet'}>
                  <button
                    type="button"
                    onClick={onLearn}
                    className="kol-helper-12 px-2 py-1 rounded border border-fg-08 text-body hover:text-emphasis"
                    style={{ background: 'transparent', cursor: 'pointer' }}
                  >
                    {learning ? 'Move a knob…' : 'Learn'}
                  </button>
                </LabeledControl>
              )}
            </div>
          )}
        </div>
      </PopoverPanel>
    </>
  )
}
