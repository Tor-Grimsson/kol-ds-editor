import { Fragment, useEffect, useState } from 'react'
import { Input, Dropdown, ViewToggle, LabeledControl, Textarea } from '@kolkrabbi/kol-component'
import { visibleParams, isAnimatable, paramTab, paramSection } from './schema'
import { isBinding, resolveValue } from './resolve'
import { useTransportCtx } from './transport'
import { compileExpr } from './expr'
import { ColorField } from '../compose/inspectors/ColorField'

/**
 * AutoControls — renders a layer's tunable params from a declared schema
 * (params/schema.js), replacing hand-wired per-type inspector JSX. One code
 * path for every layer type and, later, every imported generator/effect.
 *
 * Writes go through `setProp` (the caller's useLayerEdit path — history +
 * coalescing intact). Conditional params (`when`) hide/show live.
 *
 * `renderAnimate` (optional) is called for each animatable param and rendered
 * beside its control — the seam the timeline uses to add keyframe/modulation
 * bindings without AutoControls knowing about the transport.
 *
 * `tab` (optional) renders only params whose resolved sub-tab matches
 * ('generate' | 'style' | 'anim' — see paramTab); absent renders all.
 * Consecutive same-section params share one small header; `emptyHint`
 * renders when the filter leaves nothing (the Animation tab's hint line).
 */
export default function AutoControls({ schema, layer, setProp, palette, renderAnimate, tab, emptyHint }) {
  let params = visibleParams(schema, layer)
  if (tab) params = params.filter((p) => paramTab(p) === tab)
  if (params.length === 0) {
    return emptyHint ? <p className="kol-helper-12 text-meta">{emptyHint}</p> : null
  }
  const groups = []
  for (const p of params) {
    const section = paramSection(p)
    const last = groups[groups.length - 1]
    if (last && last.section === section) last.params.push(p)
    else groups.push({ section, params: [p] })
  }
  return (
    <>
      {groups.map((g) => (
        <Fragment key={g.params[0].key}>
          {g.section && <span className="kol-helper-10 text-meta">{g.section}</span>}
          {g.params.map((p) => {
            const bound = isBinding(layer[p.key])
            const animate = renderAnimate && isAnimatable(p) ? renderAnimate(p, bound) : null
            return (
              <ParamControl
                key={p.key}
                param={p}
                layer={layer}
                setProp={setProp}
                palette={palette}
                bound={bound}
                animate={animate}
              />
            )
          })}
        </Fragment>
      ))}
    </>
  )
}

/* RangeField — the range control with DIRECT INPUT. One editable box does it
 * all (TouchDesigner-style): type a NUMBER → constant; type an EXPRESSION like
 * `sin(t)` → binds it to the expression source (shape it further in the
 * Animation tab). While bound, the track is read-only and its thumb TRACKS the
 * live resolved value every transport tick — so you see the modulation move —
 * and the box shows the expression (editable) or the live value. Subscribes to
 * the transport only when bound, so unbound params pay nothing. */
function RangeField({ param: p, layer, setProp }) {
  const raw = layer[p.key]
  const bound = isBinding(raw)
  const boundExpr = bound && raw.bind === 'mod' && raw.source === 'expr'
  const ctx = useTransportCtx(bound)
  const live = bound ? resolveValue(raw, ctx, layer) : raw
  const numVal = typeof live === 'number' ? live : (p.default ?? 0)

  const shown = boundExpr
    ? (raw.transform?.expr ?? 'wave(t)')
    : (p.format ? String(p.format(numVal)) : (p.step && p.step < 1 ? numVal.toFixed(2) : String(Math.round(numVal))))
  const [draft, setDraft] = useState(shown)
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setDraft(shown) }, [shown, editing])

  const commit = () => {
    setEditing(false)
    const s = draft.trim()
    if (s === '') { setDraft(shown); return }
    const n = Number(s)
    if (Number.isFinite(n)) {                       /* a number → constant */
      setProp(p.key, Math.max(p.min ?? n, Math.min(p.max ?? n, n)))
      return
    }
    const compiled = compileExpr(s)                 /* else → expression binding */
    if (!compiled.ok) { setDraft(shown); return }   /* won't compile → revert */
    const range = (bound && raw.transform?.range) || (p.min != null && p.max != null ? [p.min, p.max] : [0, 1])
    setProp(p.key, { bind: 'mod', source: 'expr', transform: { ...(bound ? raw.transform : {}), expr: s, range } })
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={p.min} max={p.max} step={p.step ?? 1}
        value={numVal}
        disabled={bound}
        onChange={(e) => setProp(p.key, Number(e.target.value))}
        className="slider-black flex-1 w-full cursor-pointer"
        style={bound ? { opacity: 0.7 } : undefined}
      />
      <Input
        type="text" variant="filled" size="sm" chars={8}
        value={draft}
        title="Number sets a constant · an expression like sin(t) binds it"
        onFocus={(e) => { setEditing(true); e.target.select() }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setDraft(shown); setEditing(false); e.currentTarget.blur() }
        }}
        inputClassName="text-center"
      />
    </div>
  )
}

function ParamControl({ param: p, layer, setProp, palette, bound, animate }) {
  const raw = layer[p.key]
  const value = raw === undefined ? p.default : raw

  /* Color params route straight to ColorField (its own swatch popover). */
  if (p.type === 'color') {
    return (
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <ColorField label={p.label} value={value} onChange={(v) => setProp(p.key, v)} palette={palette} />
        </div>
        {animate}
      </div>
    )
  }

  let control = null
  if (p.type === 'range') {
    /* Direct input + live modulation readout, both in one field (RangeField):
     * type a number for a constant or an expression to bind it; a bound track
     * shows the resolved value moving. */
    control = <RangeField param={p} layer={layer} setProp={setProp} />
  } else if (p.type === 'select') {
    control = (
      <Dropdown
        variant="subtle" size="sm" className="w-full"
        options={p.options ?? []}
        value={value}
        onChange={(v) => setProp(p.key, p.numeric ? Number(v) : v)}
      />
    )
  } else if (p.type === 'segmented') {
    control = (
      <ViewToggle
        options={p.options ?? []}
        viewMode={value}
        onViewChange={(v) => setProp(p.key, v)}
      />
    )
  } else if (p.type === 'toggle') {
    /* boolean stored as-is; presented as an off/on segmented control.
     * `labels: ['Clip', 'Visible']` overrides the cell text (value stays bool). */
    const [offLabel, onLabel] = p.labels ?? ['Off', 'On']
    control = (
      <ViewToggle
        options={[{ value: 'off', label: offLabel }, { value: 'on', label: onLabel }]}
        viewMode={value ? 'on' : 'off'}
        onViewChange={(v) => setProp(p.key, v === 'on')}
      />
    )
  } else if (p.type === 'text') {
    control = (
      <Textarea
        variant="ghost" size="sm" rows={p.rows ?? 2}
        value={value ?? ''}
        onChange={(e) => setProp(p.key, e.target.value)}
        placeholder={p.placeholder}
      />
    )
  } else {
    return null
  }

  const hint = p.type === 'range' && p.format && typeof value === 'number' && !bound ? p.format(value) : undefined
  return (
    <LabeledControl label={p.label} hint={hint}>
      {animate ? <div className="flex items-center gap-2"><div className="flex-1 min-w-0">{control}</div>{animate}</div> : control}
    </LabeledControl>
  )
}
