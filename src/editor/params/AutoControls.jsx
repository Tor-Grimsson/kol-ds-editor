import { Fragment } from 'react'
import { Slider, Dropdown, ViewToggle, LabeledControl, Textarea } from '@kolkrabbi/kol-component'
import { visibleParams, isAnimatable, paramTab, paramSection } from './schema'
import { isBinding } from './resolve'
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
    /* A bound (animated/modulated) prop is driven by the graph — show its
     * live value read-only rather than let the slider fight the binding. */
    control = bound
      ? <div className="kol-helper-12 text-meta italic px-1">animated</div>
      : (
        <Slider
          min={p.min} max={p.max} step={p.step ?? 1}
          value={typeof value === 'number' ? value : (p.default ?? 0)}
          formatValue={p.format}
          onChange={(v) => setProp(p.key, v)}
        />
      )
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
